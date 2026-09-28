import { useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { BUILTIN_REDIRECTS } from "../../cms/pageMeta.js";
import { analyzePage, buildLlms, buildRobots, buildSitemap, computeSeo, effectiveRedirects, matchRedirect, mergedSeo, siteEntries } from "../../cms/seo.js";
import { api, mediaUrl } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { useContent } from "../store.jsx";
import { Alert, Badge, Button, Card, CopyButton, Counter, Empty, ErrorBox, Field, I, IconButton, Input, PageHead, Select, Spinner, Textarea, Toggle, fmtDate, timeAgo, useConfirm, useLoad, useToast } from "../ui.jsx";
import { imageValue, siteSection } from "../docOps.js";
import DocBar from "../DocBar.jsx";
import SeoPanel, { collectDom, pageMetaFor, scoreTone } from "../SeoPanel.jsx";
import { MediaPicker } from "./Media.jsx";

// ---------------------------------------------------------------------------
// SEO Management: health scan, per-page SEO, global defaults, redirects,
// robots.txt, sitemap, schema, llms.txt, IndexNow and verification.
// ---------------------------------------------------------------------------

const TABS = [
  { id: "", label: "Health check", icon: "search" },
  { id: "pages", label: "Pages", icon: "pages" },
  { id: "global", label: "Defaults", icon: "globe" },
  { id: "redirects", label: "Redirects", icon: "redirect" },
  { id: "robots", label: "Robots.txt", icon: "robot" },
  { id: "sitemap", label: "Sitemap", icon: "map" },
  { id: "schema", label: "Schema", icon: "code" },
  { id: "advanced", label: "AI & indexing", icon: "bolt" },
];

export default function Seo() {
  const store = useContent();
  const { can } = useAuth();
  const tab = (useParams()["*"] || "").split("/")[0];
  if (!store?.loaded) return <div className="a-page"><Spinner /></div>;
  if (store.error) return <div className="a-page"><ErrorBox error={store.error} onRetry={store.load} /></div>;
  const ro = !can("seo.edit");
  return (
    <div className="a-page">
      <PageHead title="SEO Management" subtitle="Everything search engines and social networks see - from titles and descriptions to redirects, sitemaps, structured data and AI crawler rules." />
      <div className="a-tabs" role="tablist">
        {TABS.map((t) => (
          <NavLink key={t.id} to={`/admin/seo${t.id ? `/${t.id}` : ""}`} end className={({ isActive }) => `a-tab ${isActive ? "active" : ""}`}>
            <I n={t.icon} size={15} />{t.label}
          </NavLink>
        ))}
      </div>
      {tab !== "" && tab !== "pages" && <DocBar docIds={tab === "advanced" ? ["seo", "site"] : ["seo"]} />}
      {tab === "" && <Health />}
      {tab === "pages" && <PagesSeo ro={!can(["seo.edit", "pages.edit"])} />}
      {tab === "global" && <Global ro={ro} />}
      {tab === "redirects" && <Redirects ro={ro} />}
      {tab === "robots" && <Robots ro={ro} />}
      {tab === "sitemap" && <Sitemap ro={ro} />}
      {tab === "schema" && <Schema ro={ro} />}
      {tab === "advanced" && <Advanced ro={ro} />}
    </div>
  );
}

function useSeoDoc(ro) {
  const store = useContent();
  const g = mergedSeo(store.working);
  const set = (section, value, label = "Edit SEO settings") => {
    if (ro) return;
    store.update("seo", (d) => ({ ...(d || {}), [section]: value }), { label, coalesce: `seo|${section}` });
  };
  return { g, set, store };
}

// ------------------------------------------------------------ health scan
function frameUrl(path) { return `${path}?kibo_editor=1`; }

/** Render every page in a hidden editor frame (read only) and audit it. */
async function scanSite({ entries, docs, onProgress }) {
  const frame = document.createElement("iframe");
  frame.className = "a-scan-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.src = frameUrl(entries[0].path);
  const origin = window.location.origin;
  let routeWaiter = null;
  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  const onMsg = (e) => {
    if (e.source !== frame.contentWindow || e.origin !== origin || e.data?.source !== "kibo-editor") return;
    if (e.data.type === "ready") {
      frame.contentWindow.postMessage({ source: "kibo-admin", type: "docs", docs }, origin);
      frame.contentWindow.postMessage({ source: "kibo-admin", type: "config", readonly: true, pages: [] }, origin);
      readyResolve();
    }
    if (e.data.type === "route" && routeWaiter) routeWaiter(e.data.path);
  };
  window.addEventListener("message", onMsg);
  document.body.appendChild(frame);
  const results = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await Promise.race([ready, wait(15000)]);
    await wait(500);
    const all = entries.map((e) => { const pm = pageMetaFor(e, docs); return pm ? computeSeo({ page: pm, docs, path: e.path }) : null; });
    const titles = all.filter(Boolean).map((x) => x.title);
    const descs = all.filter(Boolean).map((x) => x.description);
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      onProgress?.(i, entries.length, e);
      if (i > 0) {
        const arrived = new Promise((r) => { routeWaiter = (p) => { if (p === e.path) r(); }; });
        frame.contentWindow.postMessage({ source: "kibo-admin", type: "navigate", path: e.path }, origin);
        await Promise.race([arrived, wait(6000)]);
        routeWaiter = null;
      }
      await wait(700);
      const dom = collectDom(frame.contentDocument);
      const seo = all[i];
      if (!seo) continue;
      const res = analyzePage({ seo: { ...seo, jsonLd: dom?.jsonLd?.length ? dom.jsonLd : seo.jsonLd }, dom, path: e.path, allTitles: titles, allDescriptions: descs });
      results.push({ entry: e, docId: `page:${e.id}`, seo, dom, ...res });
    }
  } finally {
    window.removeEventListener("message", onMsg);
    frame.remove();
  }
  return results;
}

function Health() {
  const store = useContent();
  const toast = useToast();
  const [mode, setMode] = useState("live");
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);
  const [links, setLinks] = useState(null);
  const [last, { reload }] = useLoad(() => api("/api/admin/seo/scan").then((r) => r.scan), []);

  const run = async () => {
    const docs = mode === "live" ? store.published : store.working;
    const entries = siteEntries(docs).filter((e) => !e.noindex);
    setResults(null); setLinks(null);
    setProgress({ i: 0, n: entries.length, label: entries[0]?.label });
    try {
      const res = await scanSite({ entries, docs, onProgress: (i, n, e) => setProgress({ i, n, label: e.label }) });
      setResults(res);
      // links: internal targets must exist; external ones are checked by the server
      const known = new Set([...siteEntries(docs).map((e) => e.path), ...effectiveRedirects(docs).map((r) => r.from)]);
      const internal = new Map();
      const external = new Map();
      for (const r of res) {
        for (const l of r.dom?.links || []) {
          const href = l.href.trim();
          if (href.startsWith("/") && !href.startsWith("//")) {
            const p = (href.split(/[?#]/)[0].replace(/\/+$/, "") || "/");
            if (p.startsWith("/uploads/") || p.startsWith("/admin")) continue;
            if (!known.has(p)) internal.set(p, [...new Set([...(internal.get(p) || []), r.entry.path])]);
          } else if (/^https?:\/\//i.test(href)) {
            external.set(href, [...new Set([...(external.get(href) || []), r.entry.path])]);
          }
        }
      }
      setProgress({ i: entries.length, n: entries.length, label: `Checking ${external.size} external link(s)…` });
      let checked = [];
      if (external.size) {
        try { checked = (await api("/api/admin/seo/check-links", { method: "POST", body: { urls: [...external.keys()].slice(0, 150) } })).results; } catch (e) { toast(`Link check: ${e.message}`, { tone: "error" }); }
      }
      const broken = [
        ...[...internal.entries()].map(([url, pages]) => ({ url, status: 404, error: "Page not found on this site", pages })),
        ...checked.filter((c) => !c.ok).map((c) => ({ url: c.url, status: c.status, error: c.error || `HTTP ${c.status}`, pages: external.get(c.url) || [] })),
      ];
      const redirected = checked.filter((c) => c.ok && c.redirects);
      setLinks({ broken, redirected, checked: checked.length, internal: internal.size });
      await api("/api/admin/seo/scan", { method: "POST", body: { mode, pages: res.map((r) => ({ docId: r.docId, path: r.entry.path, label: r.entry.label, score: r.score, issues: r.issues.map(({ level, code, message }) => ({ level, code, message })) })), brokenLinks: broken } });
      reload();
      toast("SEO check finished");
    } catch (e) { toast(e.message, { tone: "error" }); } finally { setProgress(null); }
  };

  const shown = results
    ? results.map((r) => ({ path: r.entry.path, label: r.entry.label, score: r.score, issues: r.issues, words: r.dom?.text.split(/\s+/).filter(Boolean).length }))
    : last?.pages?.map((p) => ({ ...p })) || null;
  const errors = shown?.reduce((n, p) => n + p.issues.filter((i) => i.level === "error").length, 0) || 0;
  const warnings = shown?.reduce((n, p) => n + p.issues.filter((i) => i.level === "warning").length, 0) || 0;
  const avg = shown?.length ? Math.round(shown.reduce((n, p) => n + p.score, 0) / shown.length) : null;
  const broken = links?.broken || (!results ? last?.brokenLinks : null) || [];

  return (
    <div className="a-stack">
      <Card title="Site-wide SEO check" subtitle="Renders every page exactly as visitors see it and checks titles, descriptions, headings, image alt text, content length, internal and external links, structured data and social cards.">
        <div className="a-row">
          <Select value={mode} onChange={setMode} options={[{ value: "live", label: "Check the live website" }, { value: "draft", label: "Check with my drafts" }]} style={{ maxWidth: 260 }} />
          <Button variant="primary" icon="search" busy={!!progress} onClick={run}>{progress ? "Checking…" : "Run SEO check"}</Button>
          {progress && <span className="a-small a-muted">{progress.i < progress.n ? `Page ${progress.i + 1} of ${progress.n}: ${progress.label}` : progress.label}</span>}
          {!progress && last && !results && <span className="a-small a-muted">Last check {timeAgo(last.at)} by {last.by} ({last.mode})</span>}
        </div>
      </Card>
      {shown && (
        <>
          <div className="a-stats">
            <div className="a-stat"><div className="a-stat-top">Average score</div><strong style={{ color: avg >= 80 ? "var(--a-green)" : avg >= 55 ? "var(--a-amber)" : "var(--a-red)" }}>{avg ?? "–"}</strong><small>{shown.length} pages checked</small></div>
            <div className="a-stat"><div className="a-stat-top">Errors</div><strong style={{ color: errors ? "var(--a-red)" : undefined }}>{errors}</strong><small>fix these first</small></div>
            <div className="a-stat"><div className="a-stat-top">Warnings</div><strong style={{ color: warnings ? "var(--a-amber)" : undefined }}>{warnings}</strong><small>worth improving</small></div>
            <div className="a-stat"><div className="a-stat-top">Broken links</div><strong style={{ color: broken.length ? "var(--a-red)" : undefined }}>{broken.length}</strong><small>{links ? `${links.checked} external checked` : "from last check"}</small></div>
          </div>
          <Card title="Pages" pad={false}>
            <div className="a-table-wrap">
              <table className="a-table a-seo-table">
                <thead><tr><th>Score</th><th>Page</th><th>Issues</th><th /></tr></thead>
                <tbody>
                  {shown.slice().sort((a, b) => a.score - b.score).map((p) => (
                    <tr key={p.path}>
                      <td><span className={`a-scorechip ${scoreTone(p.score)}`}>{p.score}</span></td>
                      <td><strong>{p.label}</strong><div className="a-small a-muted">{p.path}{p.words ? ` · ${p.words} words` : ""}</div></td>
                      <td>
                        {p.issues.filter((i) => i.level !== "info").slice(0, 4).map((i, n) => <div key={n} className="a-issue a-small"><span className={`a-dot ${i.level === "error" ? "red" : "amber"}`} />{i.message}</div>)}
                        {p.issues.filter((i) => i.level !== "info").length > 4 && <div className="a-small a-muted">+{p.issues.filter((i) => i.level !== "info").length - 4} more</div>}
                        {!p.issues.some((i) => i.level !== "info") && <span className="a-small a-muted">No problems{p.issues.length ? ` · ${p.issues.length} suggestion(s)` : ""}</span>}
                      </td>
                      <td className="actions"><NavLink className="a-btn a-btn-sm" to={`/admin/editor?path=${encodeURIComponent(p.path)}&panel=seo`}>Fix</NavLink></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Broken links" subtitle="Links that lead to missing pages or failing websites.">
            {!broken.length ? <Empty icon="check" text="No broken links found." /> : (
              <div className="a-list">
                {broken.map((b) => (
                  <div key={b.url} className="a-list-row">
                    <Badge tone="red">{b.status || "error"}</Badge>
                    <div className="a-grow"><code className="a-ellipsis" style={{ display: "block" }}>{b.url}</code><div className="a-small a-muted">{b.error} · on {b.pages.join(", ")}</div></div>
                    {b.url.startsWith("/") && <NavLink className="a-btn a-btn-sm" to="/admin/seo/redirects">Add redirect</NavLink>}
                  </div>
                ))}
              </div>
            )}
            {links?.redirected?.length > 0 && <p className="a-hint" style={{ marginTop: 8 }}>{links.redirected.length} external link(s) redirect somewhere else - consider linking to the final address.</p>}
          </Card>
        </>
      )}
      {!shown && !progress && <Empty icon="search" title="No SEO check yet" text="Run a check to get a score and a to-do list for every page." />}
    </div>
  );
}

// -------------------------------------------------------------- per page
function PagesSeo({ ro }) {
  const store = useContent();
  const entries = useMemo(() => siteEntries(store.working), [store.working]);
  const [sel, setSel] = useState(entries[0]?.path);
  const entry = entries.find((e) => e.path === sel) || entries[0];
  const rows = entries.map((e) => {
    const pm = pageMetaFor(e, store.working);
    const s = computeSeo({ page: pm, docs: store.working, path: e.path });
    return { e, s };
  });
  return (
    <div className="a-split">
      <div className="a-card" style={{ padding: 8 }}>
        <div className="a-side-list">
          {rows.map(({ e, s }) => {
            const tl = s.rawTitle.length;
            const dl = s.description.length;
            const warn = !dl || tl > 60 || dl > 160 || dl < 70;
            return (
              <button key={e.path} type="button" className={`a-side-item ${entry?.path === e.path ? "active" : ""}`} onClick={() => setSel(e.path)}>
                <span className={`a-dot ${s.noindex ? "" : warn ? "amber" : "green"}`} />
                <span style={{ flex: 1, minWidth: 0 }}><span className="a-ellipsis" style={{ display: "block" }}>{e.label}</span><small className="a-muted">{e.path}</small></span>
                {store.isDirty(`page:${e.id}`) && <Badge tone="amber">draft</Badge>}
              </button>
            );
          })}
        </div>
      </div>
      {entry && (
        <div>
          <DocBar docIds={[`page:${entry.id}`]} previewPath={entry.path} />
          <Card title={entry.label} subtitle={entry.path} actions={<NavLink className="a-btn a-btn-sm" to={`/admin/editor?path=${encodeURIComponent(entry.path)}&panel=seo`}><I n="edit" size={14} /> Open in visual editor</NavLink>}>
            <SeoPanel key={entry.path} docId={`page:${entry.id}`} entry={entry} readonly={ro} />
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- global
function Global({ ro }) {
  const { g, set } = useSeoDoc(ro);
  const [media, setMedia] = useState(false);
  const gl = g.global;
  const up = (patch) => set("global", { ...gl, ...patch }, "Edit SEO defaults");
  const tplOk = !gl.titleTemplate || gl.titleTemplate.includes("%s");
  return (
    <Card title="Defaults for every page" subtitle="Pages without their own SEO settings use these.">
      <div className="a-stack">
        <div className="a-grid-2">
          <Field label="Site name"><Input value={gl.siteName} disabled={ro} onChange={(v) => up({ siteName: v })} /></Field>
          <Field label="Title template" error={tplOk ? null : "Must contain %s (the page title)"} hint={`Example: “${(gl.titleTemplate || "%s").replace("%s", "About Us")}”`}><Input value={gl.titleTemplate} disabled={ro} onChange={(v) => up({ titleTemplate: v })} placeholder="%s | KIBO360" /></Field>
        </div>
        <Field label="Default meta description" counter={<Counter value={gl.defaultDescription} min={70} max={160} />}><Textarea value={gl.defaultDescription} disabled={ro} onChange={(v) => up({ defaultDescription: v })} /></Field>
        <Field label="Default keywords (optional)"><Input value={gl.keywords} disabled={ro} onChange={(v) => up({ keywords: v })} /></Field>
        <div className="a-grid-3">
          <Field label="Website address" hint="Used for canonical URLs, sitemap and schema"><Input value={gl.siteUrl} disabled={ro} onChange={(v) => up({ siteUrl: v })} placeholder="https://kibo360.in" /></Field>
          <Field label="Language / region"><Select value={gl.locale} disabled={ro} onChange={(v) => up({ locale: v })} options={[{ value: "en_IN", label: "English (India)" }, { value: "en_US", label: "English (US)" }, { value: "en_GB", label: "English (UK)" }, { value: "hi_IN", label: "Hindi (India)" }]} /></Field>
          <Field label="X (Twitter) handle"><Input value={gl.twitterHandle} disabled={ro} onChange={(v) => up({ twitterHandle: v })} placeholder="@kibo360" /></Field>
        </div>
        <Field label="Default share image" hint="Used when a page has no share image of its own (1200 × 630 px recommended).">
          <div className="a-row">
            {gl.defaultOgImage?.src && <img src={mediaUrl(gl.defaultOgImage.src)} alt="" style={{ height: 60, borderRadius: 8, border: "1px solid var(--a-line)" }} />}
            <Button size="sm" icon="image" disabled={ro} onClick={() => setMedia(true)}>Change image</Button>
          </div>
        </Field>
      </div>
      {media && <MediaPicker kind="image" onClose={() => setMedia(false)} onSelect={(item) => { up({ defaultOgImage: imageValue(item) }); setMedia(false); }} />}
    </Card>
  );
}

// ------------------------------------------------------------- redirects
const rid = () => `rd_${Math.random().toString(36).slice(2, 10)}`;
function Redirects({ ro }) {
  const { g, set, store } = useSeoDoc(ro);
  const toast = useToast();
  const confirm = useConfirm();
  const list = g.redirects || [];
  const [issues, setIssues] = useState([]);
  const [test, setTest] = useState("");
  const [bulk, setBulk] = useState(null);
  const [q, setQ] = useState("");
  const known = useMemo(() => [...siteEntries(store.working).map((e) => e.path), ...BUILTIN_REDIRECTS.map((r) => r.from)], [store.working]);
  const save = (next, label = "Edit redirects") => set("redirects", next, label);
  const upd = (id, patch) => save(list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // validate with the server's analyser (loops, duplicates, chains, bad targets)
  const key = JSON.stringify(list);
  useEffect(() => {
    const t = setTimeout(() => {
      api("/api/admin/seo/validate-redirects", { method: "POST", body: { redirects: list, knownPaths: known } }).then((r) => setIssues(r.issues)).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = (id) => issues.filter((i) => i.id === id);
  const hit = test.trim() ? matchRedirect(store.working, test.trim().startsWith("/") ? test.trim() : `/${test.trim()}`) : null;
  const shown = list.filter((r) => !q || `${r.from} ${r.to} ${r.note}`.toLowerCase().includes(q.toLowerCase()));
  const errors = issues.filter((i) => i.level === "error");

  const importBulk = () => {
    const rows = bulk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/[,\t]| -> | → /).map((x) => x.trim()));
    const add = rows.filter((r) => r[0]?.startsWith("/")).map(([from, to, type]) => ({ id: rid(), from, to: to || "", type: [301, 302, 307, 308, 410].includes(Number(type)) ? Number(type) : to ? 301 : 410, enabled: true, note: "Imported" }));
    if (!add.length) { toast("No rows found - use one redirect per line: /old-page, /new-page, 301", { tone: "error" }); return; }
    save([...list, ...add], "Import redirects");
    setBulk(null);
    toast(`${add.length} redirect(s) added to the draft`);
  };

  return (
    <div className="a-stack">
      {errors.length > 0 && <Alert tone="error">{errors.length} redirect problem(s) must be fixed before SEO settings can be published.</Alert>}
      <Card
        title="Redirects"
        subtitle="Send old or changed addresses to the right page. 301 = moved permanently (passes SEO value), 302/307 = temporary, 410 = gone for good."
        actions={!ro && (
          <>
            <Button size="sm" icon="upload" onClick={() => setBulk("")}>Bulk import</Button>
            <Button size="sm" variant="primary" icon="plus" onClick={() => save([{ id: rid(), from: "/", to: "/", type: 301, enabled: true, note: "" }, ...list], "Add redirect")}>Add redirect</Button>
          </>
        )}
      >
        <div className="a-row" style={{ marginBottom: 12 }}>
          <Input value={q} onChange={setQ} placeholder="Search redirects…" style={{ maxWidth: 260 }} />
          <span className="a-spacer" />
          <span className="a-small a-muted">{list.length} rule(s) · {list.filter((r) => r.enabled).length} active</span>
        </div>
        {!list.length && <Empty icon="redirect" text="No custom redirects yet." />}
        <div className="a-rows">
          {shown.map((r) => {
            const iss = byId(r.id);
            return (
              <div key={r.id} className={`a-rowcard ${r.enabled ? "" : "muted"}`}>
                <div className="a-redirect-row">
                  <Input value={r.from} disabled={ro} onChange={(v) => upd(r.id, { from: v.trim() })} placeholder="/old-page" aria-label="From" />
                  <Input value={r.type === 410 ? "" : r.to} disabled={ro || r.type === 410} onChange={(v) => upd(r.id, { to: v.trim() })} placeholder={r.type === 410 ? "(no destination - page is gone)" : "/new-page or https://…"} list="seo-known" aria-label="To" />
                  <Select value={String(r.type)} disabled={ro} onChange={(v) => upd(r.id, { type: Number(v) })} options={[{ value: "301", label: "301 permanent" }, { value: "308", label: "308 permanent" }, { value: "302", label: "302 temporary" }, { value: "307", label: "307 temporary" }, { value: "410", label: "410 gone" }]} />
                  <Toggle checked={r.enabled} disabled={ro} onChange={(v) => upd(r.id, { enabled: v })} label="" />
                  {!ro && <IconButton icon="trash" className="danger" label="Delete redirect" onClick={async () => { if (await confirm({ title: "Delete redirect?", message: `${r.from} will no longer redirect once published.`, confirmLabel: "Delete", danger: true })) save(list.filter((x) => x.id !== r.id), "Delete redirect"); }} />}
                </div>
                <Input value={r.note} disabled={ro} onChange={(v) => upd(r.id, { note: v })} placeholder="Note (why this redirect exists)" style={{ marginTop: 8, fontSize: 12.5, padding: "5px 9px" }} />
                {iss.map((i, n) => <div key={n} className="a-issue a-small"><span className={`a-dot ${i.level === "error" ? "red" : "amber"}`} />{i.message}</div>)}
              </div>
            );
          })}
        </div>
        <datalist id="seo-known">{known.map((p) => <option key={p} value={p} />)}</datalist>
      </Card>
      <div className="a-two">
        <Card title="Test an address">
          <Field hint="Type a path to see what happens when someone visits it."><Input value={test} onChange={setTest} placeholder="/products/hms" /></Field>
          {test.trim() && (hit ? <Alert tone="ok">{hit.type === 410 ? "Returns 410 Gone" : <>Redirects ({hit.type}) to <code>{hit.to}</code></>}</Alert> : known.includes(test.trim()) ? <Alert tone="info">This is a page - no redirect.</Alert> : <Alert tone="warn">No redirect - visitors would see the 404 page.</Alert>)}
        </Card>
        <Card title="Built-in redirects" subtitle="Short and old addresses that always work.">
          {BUILTIN_REDIRECTS.map((r) => <div key={r.from} className="a-list-row a-small"><code>{r.from}</code><I n="chevronRight" size={12} /><code>{r.to}</code><Badge tone="gray">301</Badge></div>)}
        </Card>
      </div>
      {bulk !== null && (
        <div className="a-modal-back" onMouseDown={(e) => e.target === e.currentTarget && setBulk(null)}>
          <div className="a-modal" style={{ maxWidth: 560 }}>
            <header className="a-modal-head"><h2>Bulk import redirects</h2><IconButton icon="x" label="Close" onClick={() => setBulk(null)} /></header>
            <div className="a-modal-body">
              <p className="a-muted">One per line: <code>/old-address, /new-address, 301</code>. Leave the destination empty for 410 Gone.</p>
              <textarea className="a-code" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"/old-page, /new-page, 301\n/summer-offer, /products, 302\n/discontinued"} />
            </div>
            <footer className="a-modal-foot"><Button onClick={() => setBulk(null)}>Cancel</Button><Button variant="primary" onClick={importBulk}>Import</Button></footer>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- robots
const AI_BOTS = ["GPTBot", "ChatGPT-User", "Google-Extended", "CCBot", "anthropic-ai", "ClaudeBot", "PerplexityBot", "Bytespider", "Applebot-Extended", "meta-externalagent"];
function Robots({ ro }) {
  const { g, set, store } = useSeoDoc(ro);
  const r = g.robots;
  const up = (patch) => set("robots", { ...r, ...patch }, "Edit robots.txt");
  const preview = buildRobots(store.working);
  const [dis, setDis] = useState((r.disallow || []).join("\n"));
  return (
    <div className="a-two">
      <Card title="robots.txt" subtitle="Tells crawlers which parts of the site they may visit. The admin area, API and preview links are always blocked.">
        <div className="a-stack">
          <Field label="Mode"><Select value={r.mode} disabled={ro} onChange={(v) => up({ mode: v, custom: v === "custom" && !r.custom ? preview : r.custom })} options={[{ value: "auto", label: "Automatic (recommended)" }, { value: "custom", label: "Custom file (advanced)" }]} /></Field>
          {r.mode === "auto" ? (
            <>
              <Field label="Also block these paths (one per line)" hint="e.g. /thank-you or /landing/internal-offer">
                <Textarea value={dis} disabled={ro} rows={4} onChange={(v) => { setDis(v); up({ disallow: v.split("\n").map((x) => x.trim()).filter((x) => x.startsWith("/")) }); }} />
              </Field>
              <Toggle checked={r.blockAiTraining} disabled={ro} onChange={(v) => up({ blockAiTraining: v })} label="Block AI training crawlers" hint={`Blocks ${AI_BOTS.slice(0, 5).join(", ")}… Search engines (Google, Bing) are not affected.`} />
              <Field label="Crawl delay (seconds, optional)" hint="Only honoured by some crawlers (Bing, Yandex). Leave 0 unless your server struggles."><Input type="number" min="0" max="60" value={r.crawlDelay || 0} disabled={ro} onChange={(v) => up({ crawlDelay: Number(v) || 0 })} /></Field>
            </>
          ) : (
            <Field label="robots.txt content" hint="The sitemap line and admin/API blocks are added automatically if missing.">
              <textarea className="a-code" disabled={ro} value={r.custom} onChange={(e) => up({ custom: e.target.value })} />
            </Field>
          )}
          {r.mode === "custom" && /Disallow:\s*\/\s*$/m.test(r.custom) && <Alert tone="error">This file blocks the whole website from search engines.</Alert>}
        </div>
      </Card>
      <Card title="Preview" actions={<><CopyButton text={preview} /><a className="a-btn a-btn-sm" href="/robots.txt" target="_blank" rel="noopener noreferrer"><I n="external" size={14} /> Live file</a></>}>
        <pre className="a-code">{preview}</pre>
        <p className="a-hint">This is what /robots.txt returns after you publish.</p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- sitemap
function Sitemap({ ro }) {
  const { g, set, store } = useSeoDoc(ro);
  const sm = g.sitemap;
  const up = (patch) => set("sitemap", { ...sm, ...patch }, "Edit sitemap");
  const xml = buildSitemap(store.working, { lastmod: new Date().toISOString().slice(0, 10) });
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const [ex, setEx] = useState((sm.exclude || []).join("\n"));
  return (
    <div className="a-two">
      <Card title="XML sitemap" subtitle="Lists every public page so search engines find new and updated content quickly.">
        <div className="a-stack">
          <Toggle checked={sm.enabled} disabled={ro} onChange={(v) => up({ enabled: v })} label="Publish sitemap.xml" hint="Linked from robots.txt automatically" />
          <Toggle checked={sm.includeImages} disabled={ro} onChange={(v) => up({ includeImages: v })} label="Include page images (image sitemap)" />
          <Field label="Leave out these paths (one per line)" hint="Pages set to noindex are always left out. Per-page priority is under SEO → Pages."><Textarea rows={4} value={ex} disabled={ro} onChange={(v) => { setEx(v); up({ exclude: v.split("\n").map((x) => x.trim()).filter((x) => x.startsWith("/")) }); }} /></Field>
          <Alert tone="info">Submit <code>{`${g.global.siteUrl.replace(/\/$/, "")}/sitemap.xml`}</code> once in Google Search Console and Bing Webmaster Tools - they re-read it automatically after that.</Alert>
        </div>
      </Card>
      <Card title={`Preview · ${urls.length} URLs`} actions={<><CopyButton text={xml} /><a className="a-btn a-btn-sm" href="/sitemap.xml" target="_blank" rel="noopener noreferrer"><I n="external" size={14} /> Live file</a></>}>
        {sm.enabled ? <div className="a-list">{urls.map((u) => <div key={u} className="a-list-row a-small"><I n="check" size={13} /><code className="a-ellipsis">{u}</code></div>)}</div> : <Alert tone="warn">The sitemap is switched off.</Alert>}
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------- schema
function Schema({ ro }) {
  const { g, set } = useSeoDoc(ro);
  const s = g.schema;
  const up = (patch) => set("schema", { ...s, ...patch }, "Edit schema");
  const org = s.organization;
  const lb = s.localBusiness;
  const [same, setSame] = useState((org.sameAs || []).join("\n"));
  return (
    <div className="a-two">
      <Card title="Organisation" subtitle="Helps Google show the KIBO360 knowledge panel, logo and contact details.">
        <div className="a-stack">
          <Toggle checked={org.enabled} disabled={ro} onChange={(v) => up({ organization: { ...org, enabled: v } })} label="Add Organization schema to every page" />
          <div className="a-grid-2">
            <Field label="Type"><Select value={org.type} disabled={ro} onChange={(v) => up({ organization: { ...org, type: v } })} options={["Organization", "Corporation", "SoftwareCompany", "LocalBusiness", "MedicalBusiness"]} /></Field>
            <Field label="Founded (YYYY or YYYY-MM-DD)"><Input value={org.foundingDate} disabled={ro} onChange={(v) => up({ organization: { ...org, foundingDate: v } })} /></Field>
          </div>
          <div className="a-grid-2">
            <Field label="Name"><Input value={org.name} disabled={ro} onChange={(v) => up({ organization: { ...org, name: v } })} /></Field>
            <Field label="Legal name"><Input value={org.legalName} disabled={ro} onChange={(v) => up({ organization: { ...org, legalName: v } })} /></Field>
          </div>
          <Field label="Description"><Textarea value={org.description} disabled={ro} onChange={(v) => up({ organization: { ...org, description: v } })} /></Field>
          <Field label="Profiles (sameAs) - one URL per line" hint="LinkedIn, Crunchbase, Wikipedia… Social links from Website Settings are added automatically.">
            <Textarea value={same} disabled={ro} onChange={(v) => { setSame(v); up({ organization: { ...org, sameAs: v.split("\n").map((x) => x.trim()).filter((x) => /^https?:\/\//.test(x)) } }); }} />
          </Field>
          <Toggle checked={s.website?.enabled !== false} disabled={ro} onChange={(v) => up({ website: { enabled: v } })} label="Add WebSite schema on the homepage" />
        </div>
      </Card>
      <Card title="Local business" subtitle="Shown on the homepage and contact page - helps local search and Google Maps.">
        <div className="a-stack">
          <Toggle checked={lb.enabled} disabled={ro} onChange={(v) => up({ localBusiness: { ...lb, enabled: v } })} label="Add LocalBusiness schema" />
          <Field label="Street address"><Input value={lb.streetAddress} disabled={ro} onChange={(v) => up({ localBusiness: { ...lb, streetAddress: v } })} /></Field>
          <div className="a-grid-3">
            <Field label="City"><Input value={lb.locality} disabled={ro} onChange={(v) => up({ localBusiness: { ...lb, locality: v } })} /></Field>
            <Field label="State"><Input value={lb.region} disabled={ro} onChange={(v) => up({ localBusiness: { ...lb, region: v } })} /></Field>
            <Field label="PIN code"><Input value={lb.postalCode} disabled={ro} onChange={(v) => up({ localBusiness: { ...lb, postalCode: v } })} /></Field>
          </div>
          <div className="a-grid-3">
            <Field label="Country code"><Input value={lb.country} disabled={ro} onChange={(v) => up({ localBusiness: { ...lb, country: v.toUpperCase().slice(0, 2) } })} /></Field>
            <Field label="Latitude"><Input value={lb.latitude ?? ""} disabled={ro} onChange={(v) => up({ localBusiness: { ...lb, latitude: v === "" ? null : Number(v) } })} /></Field>
            <Field label="Longitude"><Input value={lb.longitude ?? ""} disabled={ro} onChange={(v) => up({ localBusiness: { ...lb, longitude: v === "" ? null : Number(v) } })} /></Field>
          </div>
          <Field label="Opening hours" hint="schema.org format, e.g. Mo-Sa 09:30-18:30"><Input value={lb.openingHours} disabled={ro} onChange={(v) => up({ localBusiness: { ...lb, openingHours: v } })} /></Field>
          <Alert tone="info">Page-specific schema (FAQ, software product, breadcrumbs) is generated automatically; extra JSON-LD can be added per page under SEO → Pages → Structured data.</Alert>
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------ AI + indexing
function Advanced({ ro }) {
  const { g, set, store } = useSeoDoc(ro);
  const { can } = useAuth();
  const toast = useToast();
  const llms = g.llms;
  const inow = g.indexNow;
  const siteRo = !can("site.edit");
  const settings = siteSection(store.working.site, "settings");
  const ver = settings.verification || {};
  const setVer = (patch) => { if (!siteRo) store.update("site", (d) => ({ ...(d || {}), settings: { ...settings, verification: { ...ver, ...patch } } }), { label: "Edit verification", coalesce: "site|ver" }); };
  const [busy, setBusy] = useState(false);
  const llmsPreview = buildLlms(store.working) || "";
  const pubIndexNow = mergedSeo(store.published).indexNow;
  const submit = async () => {
    setBusy(true);
    try {
      const urls = siteEntries(store.published).filter((e) => !e.noindex).map((e) => e.path);
      const r = await api("/api/admin/seo/indexnow", { method: "POST", body: { urls } });
      toast(r.ok ? `Submitted ${r.submitted} URLs to IndexNow (Bing, Yandex, Seznam, Naver)` : `IndexNow answered ${r.status}`, { tone: r.ok ? "ok" : "error" });
    } catch (e) { toast(e.message, { tone: "error" }); } finally { setBusy(false); }
  };
  return (
    <div className="a-stack">
      <div className="a-two">
        <Card title="llms.txt (AI assistants)" subtitle="A plain-text summary of the site for ChatGPT, Claude, Perplexity and other AI tools - helps them describe KIBO360 accurately.">
          <div className="a-stack">
            <Toggle checked={llms.enabled} disabled={ro} onChange={(v) => set("llms", { ...llms, enabled: v }, "Edit llms.txt")} label="Publish /llms.txt" />
            <Field label="Content"><Select value={llms.mode} disabled={ro} onChange={(v) => set("llms", { ...llms, mode: v, custom: v === "custom" && !llms.custom ? llmsPreview : llms.custom }, "Edit llms.txt")} options={[{ value: "auto", label: "Generated from the site (recommended)" }, { value: "custom", label: "Write my own" }]} /></Field>
            {llms.mode === "custom" ? <textarea className="a-code" disabled={ro} value={llms.custom} onChange={(e) => set("llms", { ...llms, custom: e.target.value }, "Edit llms.txt")} /> : <pre className="a-code">{llmsPreview}</pre>}
          </div>
        </Card>
        <div className="a-stack">
          <Card title="IndexNow" subtitle="Instantly tells Bing, Yandex, Seznam and Naver when pages change (Google uses the sitemap instead).">
            <div className="a-stack">
              <Toggle checked={inow.enabled} disabled={ro} onChange={(v) => set("indexNow", { ...inow, enabled: v, key: inow.key || [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("") }, "Edit IndexNow")} label="Enable IndexNow" />
              {inow.key && <Field label="Key" hint="Served at /<key>.txt to prove ownership"><div className="a-input-group"><Input value={inow.key} disabled /><CopyButton text={inow.key} /></div></Field>}
              {can(["pages.publish", "seo.publish"]) && <Button icon="bolt" busy={busy} disabled={!pubIndexNow.enabled || !pubIndexNow.key} onClick={submit}>Submit all pages now</Button>}
              {inow.enabled && !pubIndexNow.enabled && <p className="a-hint">Publish the SEO settings first, then submit.</p>}
            </div>
          </Card>
          <Card title="Search engine verification" subtitle="Paste only the code from each tool's HTML-tag method (the content value). Part of Website Settings.">
            <div className="a-stack tight">
              {[["google", "Google Search Console"], ["bing", "Bing Webmaster Tools"], ["yandex", "Yandex Webmaster"], ["pinterest", "Pinterest"], ["facebook", "Facebook domain verification"]].map(([k, label]) => (
                <Field key={k} label={label}><Input value={ver[k]} disabled={siteRo} onChange={(v) => setVer({ [k]: v.replace(/^.*content=["']?([^"'>\s]+).*$/i, "$1").trim() })} placeholder="verification code" /></Field>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <p className="a-hint">Last published SEO settings: {store.status.seo?.publishedAt ? fmtDate(store.status.seo.publishedAt) : "never (defaults in use)"}.</p>
    </div>
  );
}

