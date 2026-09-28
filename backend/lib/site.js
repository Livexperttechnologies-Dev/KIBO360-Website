import fs from "fs";
import path from "path";
import express from "express";
import { pathToFileURL } from "url";
import { sha256 } from "./security.js";
import { publicData } from "./content.js";

// ---------------------------------------------------------------------------
// Site server (optional "SSR mode"): serves the public website from this Node
// process, rendering every page per request with the CURRENTLY PUBLISHED
// content. Compared with static hosting this gives:
//   - publish = instantly live HTML for visitors AND search engines
//   - real 301/302/410 responses for the redirect manager
//   - live robots.txt / sitemap.xml / llms.txt / IndexNow key file
//   - secure preview links rendered server-side (noindex, no-store)
//   - clickjacking protection (frame-ancestors 'self')
// Rendered HTML is cached per path and dropped on every publish.
// ---------------------------------------------------------------------------

export async function createSite({ siteDist, content }) {
  const ssrPath = path.resolve(siteDist, "../dist-server/entry-server.js");
  const templatePath = path.resolve(siteDist, "../dist-server/template.html");
  if (!fs.existsSync(ssrPath) || !fs.existsSync(templatePath)) {
    console.warn(`[site] ${ssrPath} or template.html missing - run "npm run build" in frontend/. Serving API only.`);
    return null;
  }
  const ssr = await import(pathToFileURL(ssrPath).href);
  const template = fs.readFileSync(templatePath, "utf8");
  const cache = new Map(); // key -> { status, html, headers }

  const published = () => {
    const pub = content.loadPublished();
    const docs = {};
    for (const [id, d] of Object.entries(pub.docs)) docs[id] = publicData(id, d.data);
    return { docs, version: pub.version || 0, updatedAt: pub.updatedAt };
  };

  // Replacer functions: "$&", "$'" etc. in CMS text must never be expanded.
  const inject = (r, route) =>
    template
      .replace("<!--kibo-head-->", () => r.head || "")
      .replace('<div id="root"></div>', () => `<div id="root" data-prerendered-route="${route.replace(/"/g, "")}">${r.html || ""}</div>`)
      .replace("<!--kibo-data-->", () => `<script id="kibo-data" type="application/json">${r.data}</script>`);

  const shell = template.replace("<!--kibo-head-->", '<meta name="robots" content="noindex, nofollow" />').replace("<!--kibo-data-->", "");

  function siteHeaders(req, res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  function mount(app) {
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
      siteHeaders(req, res);
      next();
    });

    // ---- SEO files, always generated from the live content ----
    app.get("/robots.txt", (_req, res) => {
      res.type("text/plain").setHeader("Cache-Control", "public, max-age=300");
      res.send(ssr.buildRobots(published().docs));
    });
    app.get("/sitemap.xml", (_req, res) => {
      const p = published();
      res.type("application/xml").setHeader("Cache-Control", "public, max-age=300");
      res.send(ssr.buildSitemap(p.docs, { lastmod: (p.updatedAt || new Date().toISOString()).slice(0, 10) }));
    });
    app.get("/llms.txt", (_req, res, next) => {
      const txt = ssr.buildLlms(published().docs);
      if (!txt) return next();
      res.type("text/plain").setHeader("Cache-Control", "public, max-age=300");
      res.send(txt);
    });
    app.get(/^\/([a-f0-9]{16,64})\.txt$/, (req, res, next) => {
      const g = ssr.mergedSeo(published().docs);
      if (!g.indexNow?.enabled || g.indexNow.key !== req.params[0]) return next();
      res.type("text/plain").send(g.indexNow.key);
    });

    // ---- static build assets (never the prerendered .html files) ----
    const staticFiles = express.static(siteDist, {
      index: false,
      redirect: false, // never auto-redirect directories (prerender stub folders)
      dotfiles: "ignore",
      setHeaders: (res, filePath) => {
        const hashed = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader("Cache-Control", hashed ? "public, max-age=31536000, immutable" : "public, max-age=3600");
      },
    });
    app.use((req, res, next) => (req.path.endsWith(".html") ? next() : staticFiles(req, res, next)));

    // ---- pages ----
    app.get(/.*/, async (req, res, next) => {
      if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
      try {
        // canonical URLs: no trailing slash
        if (req.path.length > 1 && req.path.endsWith("/")) {
          const q = req.originalUrl.slice(req.path.length);
          return res.redirect(301, req.path.replace(/\/+$/, "") + q);
        }
        // Admin app and the editor iframe are client-rendered and never indexed.
        if (req.path === "/admin" || req.path.startsWith("/admin/") || req.query.kibo_editor === "1") {
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Robots-Tag", "noindex, nofollow");
          return res.type("html").send(shell);
        }
        // Secure preview links: drafts, rendered server-side, never cached/indexed.
        const token = typeof req.query.kibo_preview === "string" ? req.query.kibo_preview : null;
        if (token && /^[a-f0-9]{64}$/.test(token)) {
          const found = content.loadPreviews().find((p) => p.tokenHash === sha256(token));
          if (found) {
            const r = await ssr.render(req.originalUrl, { docs: content.previewDocs(), version: "preview", mode: "preview", previewInfo: { label: found.label, expiresAt: found.exp } });
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Robots-Tag", "noindex, nofollow");
            if (r.redirect) return res.redirect(302, r.redirect.to);
            return res.status(r.status === 404 ? 404 : 200).type("html").send(inject(r, req.path));
          }
        }

        const p = published();
        const key = `${p.version}:${req.path}`;
        let hit = cache.get(key);
        if (!hit) {
          const r = await ssr.render(req.path, { docs: p.docs, version: p.version, mediaBase: "" });
          if (r.redirect) {
            hit = r.redirect.type === 410 ? { status: 410, html: null } : { status: [301, 302, 307, 308].includes(r.redirect.type) ? r.redirect.type : 301, location: r.redirect.to };
          } else {
            hit = { status: r.status, html: inject(r, req.path) };
          }
          if (cache.size > 500) cache.clear();
          cache.set(key, hit);
        }
        if (hit.location) return res.redirect(hit.status, hit.location);
        if (hit.status === 410) {
          const nf = await ssr.render("/__kibo-not-found__", { docs: p.docs, version: p.version });
          return res.status(410).type("html").send(inject(nf, "/404"));
        }
        res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        res.setHeader("ETag", `"${sha256(key).slice(0, 16)}"`);
        if (req.headers["if-none-match"] === res.getHeader("ETag") && hit.status === 200) return res.status(304).end();
        res.status(hit.status).type("html").send(hit.html);
      } catch (e) {
        next(e);
      }
    });
  }

  function invalidate() { cache.clear(); }

  console.log(`[site] serving ${siteDist} with server-side rendering`);
  return { mount, invalidate };
}
