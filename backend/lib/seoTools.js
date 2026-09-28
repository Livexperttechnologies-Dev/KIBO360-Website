import dns from "dns/promises";
import http from "http";
import https from "https";
import net from "net";
import { isPrivateAddress, clampStr } from "./security.js";
import { analyzeRedirects, normSeoDoc } from "./schema.js";

// ---------------------------------------------------------------------------
// SEO tooling that needs the server:
// - External broken-link checking (SSRF-safe: only http/https on 80/443,
//   every hop's DNS answer checked against private ranges, redirects are
//   followed manually so a public URL can't bounce us into the LAN).
// - Stored results of the in-browser page scan (dashboard "SEO issues").
// - Redirect validation and IndexNow submission.
// ---------------------------------------------------------------------------

const SCAN = "seo-scan.json";
const LINKCACHE = new Map(); // url -> { at, result }

async function assertPublicHost(u) {
  if (!/^https?:$/.test(u.protocol)) throw new Error("unsupported protocol");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("non-standard port");
  if (u.username || u.password) throw new Error("credentials in URL");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("private host");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true, verbatim: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("private address");
}

/**
 * DNS lookup used for the actual connection: every answer is validated, so a
 * hostname can't pass the check and then resolve to a private address
 * (DNS rebinding) when the socket connects.
 */
function safeLookup(hostname, options, cb) {
  const opts = typeof options === "object" && options ? options : {};
  dns.lookup(hostname, { all: true, verbatim: true }).then((addrs) => {
    const ok = addrs.filter((a) => !isPrivateAddress(a.address));
    if (!ok.length || ok.length !== addrs.length) return cb(Object.assign(new Error("private address"), { code: "EPRIVATE" }));
    if (opts.all) return cb(null, ok);
    cb(null, ok[0].address, ok[0].family);
  }, (e) => cb(e));
}

/** One HEAD/GET request (headers only - the body is never downloaded). */
function probe(url, method) {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(url, {
      method,
      lookup: safeLookup,
      timeout: 8000,
      headers: { "User-Agent": "KIBO360-LinkChecker/1.0 (+https://kibo360.in)", Accept: "text/html,*/*;q=0.8", ...(method === "GET" ? { Range: "bytes=0-2047" } : {}) },
    }, (res) => {
      resolve({ status: res.statusCode, location: res.headers.location || null });
      res.destroy();
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("Timed out"), { name: "AbortError" })));
    req.on("error", reject);
    req.end();
  });
}

async function checkUrl(raw) {
  const cached = LINKCACHE.get(raw);
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.result;
  let url;
  try { url = new URL(raw); } catch { return { url: raw, ok: false, status: 0, error: "Invalid URL" }; }
  let result;
  try {
    let hops = 0;
    let method = "HEAD";
    for (;;) {
      await assertPublicHost(url);
      const r = await probe(url, method);
      if ([405, 403, 501].includes(r.status) && method === "HEAD") { method = "GET"; continue; }
      if (r.status >= 300 && r.status < 400 && r.location) {
        if (++hops > 5) { result = { url: raw, ok: false, status: r.status, error: "Too many redirects" }; break; }
        url = new URL(r.location, url);
        method = "HEAD";
        continue;
      }
      result = { url: raw, ok: r.status < 400, status: r.status, finalUrl: hops ? url.toString() : undefined, redirects: hops || undefined };
      break;
    }
  } catch (e) {
    result = { url: raw, ok: false, status: 0, error: e.name === "AbortError" ? "Timed out" : e.code === "EPRIVATE" || /private|protocol|port|credentials/.test(e.message) ? "Blocked: not a public address" : e.code === "ENOTFOUND" ? "Domain not found" : "Could not connect" };
  }
  LINKCACHE.set(raw, { at: Date.now(), result });
  if (LINKCACHE.size > 5000) LINKCACHE.clear();
  return result;
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

export function createSeoTools({ store, audit, requireAuth, content }) {
  function registerRoutes(app) {
    app.post("/api/admin/seo/check-links", requireAuth("seo.view"), async (req, res, next) => {
      try {
        const urls = [...new Set((Array.isArray(req.body?.urls) ? req.body.urls : []).map((u) => String(u).trim()).filter((u) => /^https?:\/\//i.test(u)))].slice(0, 150);
        const results = await pool(urls, 6, checkUrl);
        res.json({ ok: true, results });
      } catch (e) { next(e); }
    });

    app.get("/api/admin/seo/scan", requireAuth("seo.view"), (_req, res) => {
      res.json({ ok: true, scan: store.readJson(SCAN, null) });
    });
    app.post("/api/admin/seo/scan", requireAuth("seo.view"), (req, res) => {
      const b = req.body || {};
      const pages = (Array.isArray(b.pages) ? b.pages : []).slice(0, 200).map((p) => ({
        docId: clampStr(p.docId, 80), path: clampStr(p.path, 200), label: clampStr(p.label, 120),
        score: Math.max(0, Math.min(100, Number(p.score) || 0)),
        issues: (Array.isArray(p.issues) ? p.issues : []).slice(0, 60).map((i) => ({ level: ["error", "warning", "info"].includes(i.level) ? i.level : "info", code: clampStr(i.code, 40), message: clampStr(i.message, 300) })),
      }));
      const scan = {
        at: new Date().toISOString(), by: req.user.name, mode: b.mode === "draft" ? "draft" : "live", pages,
        totals: { errors: pages.reduce((n, p) => n + p.issues.filter((i) => i.level === "error").length, 0), warnings: pages.reduce((n, p) => n + p.issues.filter((i) => i.level === "warning").length, 0), avgScore: pages.length ? Math.round(pages.reduce((n, p) => n + p.score, 0) / pages.length) : null },
        brokenLinks: (Array.isArray(b.brokenLinks) ? b.brokenLinks : []).slice(0, 300).map((l) => ({ url: clampStr(l.url, 500), status: Number(l.status) || 0, error: clampStr(l.error, 120), pages: (Array.isArray(l.pages) ? l.pages : []).slice(0, 20).map((x) => clampStr(x, 200)) })),
      };
      store.writeJson(SCAN, scan);
      audit.log(req, { action: "seo.scan", target: scan.mode, details: scan.totals });
      res.json({ ok: true, scan });
    });

    app.post("/api/admin/seo/validate-redirects", requireAuth("seo.view"), (req, res) => {
      const doc = normSeoDoc({ redirects: req.body?.redirects || [] });
      const known = Array.isArray(req.body?.knownPaths) ? new Set(req.body.knownPaths.map(String)) : null;
      res.json({ ok: true, redirects: doc.redirects || [], issues: analyzeRedirects(doc.redirects || [], { knownPaths: known }) });
    });

    // IndexNow: tell Bing/Yandex/Seznam/Naver about changed URLs instantly.
    app.post("/api/admin/seo/indexnow", requireAuth(["pages.publish", "seo.publish"]), async (req, res) => {
      const seo = content.loadPublished().docs.seo?.data || {};
      const cfg = seo.indexNow || {};
      if (!cfg.enabled || !cfg.key) return res.status(400).json({ ok: false, error: "IndexNow is not enabled (SEO → Advanced)" });
      const site = new URL(seo.global?.siteUrl || "https://kibo360.in");
      const urls = [...new Set((Array.isArray(req.body?.urls) ? req.body.urls : []).map(String))]
        .map((u) => { try { return new URL(u, site).toString(); } catch { return null; } })
        .filter((u) => u && new URL(u).host === site.host).slice(0, 1000);
      if (!urls.length) return res.status(400).json({ ok: false, error: "No site URLs to submit" });
      try {
        const r = await fetch("https://api.indexnow.org/indexnow", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ host: site.host, key: cfg.key, keyLocation: `${site.origin}/${cfg.key}.txt`, urlList: urls }),
        });
        audit.log(req, { action: "seo.indexnow", target: site.host, details: { urls: urls.length, status: r.status } });
        res.json({ ok: r.status < 300, status: r.status, submitted: urls.length });
      } catch (e) {
        res.status(502).json({ ok: false, error: `IndexNow request failed: ${e.message}` });
      }
    });
  }

  return { registerRoutes };
}
