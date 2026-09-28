import { useMemo, useState } from "react";
import { pageById } from "../cms/pageMeta.js";
import { analyzePage, computeSeo, siteEntries } from "../cms/seo.js";
import { useContent } from "./store.jsx";
import { mediaUrl } from "./api.js";
import { Alert, Badge, Button, Counter, Field, I, Input, Select, Textarea, Toggle } from "./ui.jsx";
import { imageValue } from "./docOps.js";
import { MediaPicker } from "./modules/Media.jsx";

// ---------------------------------------------------------------------------
// Per-page SEO editor: search snippet, indexing, canonical, social cards,
// structured data, breadcrumbs, sitemap - with a live Google preview and an
// on-page audit of the real rendered page.
// ---------------------------------------------------------------------------

/** Registry entry used by the SEO engine for any page (built-in or custom). */
export function pageMetaFor(entry, docs) {
  if (!entry) return null;
  if (entry.builtin) return pageById(entry.id);
  const d = docs?.[`page:${entry.id}`];
  return { id: entry.id, path: entry.path, label: d?.meta?.label || entry.label, title: d?.meta?.label || entry.label, description: "" };
}

/** Collect what an SEO audit needs from a rendered page document. */
export function collectDom(doc) {
  const root = doc?.querySelector("main");
  if (!root) return null;
  const main = root.cloneNode(true);
  main.querySelectorAll('.kibo-hidden-section, [data-kibo-hidden="1"], script, style, noscript').forEach((n) => n.remove());
  const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
  const headings = [...main.querySelectorAll("h1, h2, h3, h4, h5, h6")].map((h) => ({ level: Number(h.tagName[1]), text: txt(h) }));
  return {
    h1s: headings.filter((h) => h.level === 1).map((h) => h.text),
    headings,
    images: [...main.querySelectorAll("img")].map((i) => ({ src: i.getAttribute("src") || "", alt: (i.getAttribute("alt") || "").trim(), decorative: i.getAttribute("alt") === "" || !!i.closest('[aria-hidden="true"]') })),
    links: [...doc.querySelectorAll("a[href]")].filter((a) => main.contains(a) || root.contains(a)).map((a) => {
      const href = a.getAttribute("href") || "";
      return { href, text: txt(a), label: a.getAttribute("aria-label") || a.getAttribute("title") || a.querySelector("img[alt]")?.getAttribute("alt") || "", internal: href.startsWith("/") && !href.startsWith("//") };
    }),
    text: txt(main),
    jsonLd: [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
  };
}

export function scoreTone(score) { return score >= 80 ? "good" : score >= 55 ? "ok" : "bad"; }

export default function SeoPanel({ docId, entry, frame, readonly, compact = false }) {
  const store = useContent();
  const [media, setMedia] = useState(null);
  const [audit, setAudit] = useState(null);
  const [open, setOpen] = useState({ search: true, index: !compact, social: false, schema: false, sitemap: false });
  const docs = store.working;
  const page = pageMetaFor(entry, docs);
  const s = docs[docId]?.seo || {};
  const seo = useMemo(() => (page ? computeSeo({ page, docs, path: entry.path }) : null), [page, docs, entry?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!page || !seo) return <Alert tone="warn">No SEO settings for this address.</Alert>;

  const set = (patch, label = "Edit SEO", field = "x") => {
    if (readonly) return;
    store.update(docId, (d) => ({ ...(d || {}), seo: clean({ ...(d?.seo || {}), ...patch }) }), { label, coalesce: `seo|${docId}|${field}` });
  };
  const robots = s.robots || { index: !page.noindex, follow: !page.noindex };
  const setRobots = (patch) => set({ robots: { ...robots, ...patch } }, "Edit indexing", "robots");
  const og = s.og || {};
  const tw = s.twitter || {};
  const schema = s.schema || { auto: true };
  const sm = s.sitemap || { include: true };
  const pickImage = (onPick) => setMedia({ onPick });

  const runAudit = () => {
    const doc = frame?.()?.contentDocument;
    const dom = collectDom(doc);
    const entries = siteEntries(docs);
    const all = entries.map((e) => { const pm = pageMetaFor(e, docs); return pm ? computeSeo({ page: pm, docs, path: e.path }) : null; }).filter(Boolean);
    const res = analyzePage({ seo: { ...seo, jsonLd: dom?.jsonLd?.length ? dom.jsonLd : seo.jsonLd }, dom, path: entry.path, allTitles: all.map((x) => x.title), allDescriptions: all.map((x) => x.description) });
    setAudit({ ...res, at: Date.now(), words: dom ? dom.text.split(/\s+/).filter(Boolean).length : null });
  };

  let customError = null;
  if (typeof schema.custom === "string" && schema.custom.trim()) { try { JSON.parse(schema.custom); } catch (e) { customError = e.message; } }
  if (schema.customInvalid) customError = customError || "Invalid JSON";

  const section = (id, title, icon, children) => (
    <div className="a-rowcard">
      <button type="button" className="a-row nowrap" style={{ all: "unset", display: "flex", alignItems: "center", gap: 8, width: "100%", cursor: "pointer" }} onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))} aria-expanded={!!open[id]}>
        <I n={icon} size={15} /><strong style={{ flex: 1, color: "var(--a-ink)" }}>{title}</strong><I n={open[id] ? "chevronDown" : "chevronRight"} size={14} />
      </button>
      {open[id] && <div className="a-rowcard-body">{children}</div>}
    </div>
  );

  return (
    <div className="a-stack">
      {frame && (
        <div className="a-row nowrap">
          {audit ? <div className={`a-score ${scoreTone(audit.score)}`} title="SEO score">{audit.score}</div> : <div className="a-score ok" style={{ background: "#c9c3d8" }}>?</div>}
          <div style={{ flex: 1 }}>
            <strong style={{ color: "var(--a-ink)" }}>On-page SEO check</strong>
            <div className="a-small a-muted">{audit ? `${audit.issues.filter((i) => i.level !== "info").length} issue(s)${audit.words != null ? ` · ${audit.words} words` : ""}` : "Checks the page as it is on screen"}</div>
          </div>
          <Button size="sm" icon="refresh" onClick={runAudit}>{audit ? "Re-check" : "Check"}</Button>
        </div>
      )}
      {audit && (
        <div className="a-stack tight">
          {audit.issues.length === 0 && <Alert tone="ok">No issues found - nice work.</Alert>}
          {audit.issues.map((i, n) => (
            <div key={n} className="a-issue"><span className={`a-dot ${i.level === "error" ? "red" : i.level === "warning" ? "amber" : ""}`} /><span>{i.message}</span></div>
          ))}
        </div>
      )}

      <div className="serp" aria-label="Google search preview">
        <div className="serp-site">
          <img src={mediaUrl(seo.favicon)} alt="" />
          <div><div>{seo.og.siteName}</div><small>{seo.canonical.replace(/^https?:\/\//, "").replace(/\/$/, "")}</small></div>
        </div>
        <div className="serp-title">{seo.title.length > 62 ? `${seo.title.slice(0, 60)}…` : seo.title}</div>
        <div className="serp-desc">{seo.description.length > 162 ? `${seo.description.slice(0, 158)}…` : seo.description || <em>No description - Google will pick text from the page.</em>}</div>
      </div>
      {seo.noindex && <Alert tone="warn">This page is hidden from search engines (noindex).</Alert>}

      {section("search", "Search appearance", "search", (
        <>
          <Field label="SEO title" counter={<Counter value={s.title || page.title} min={30} max={60} />} hint={`Shown in Google and the browser tab. The site name is added automatically: “${seo.title}”.`}>
            <Input value={s.title} disabled={readonly} placeholder={page.title} onChange={(v) => set({ title: v }, "Edit SEO title", "title")} />
          </Field>
          <Field label="Meta description" counter={<Counter value={s.description || page.description} min={70} max={160} />} hint="A persuasive summary - Google shows it under the title.">
            <Textarea value={s.description} disabled={readonly} rows={3} placeholder={page.description} onChange={(v) => set({ description: v }, "Edit meta description", "description")} />
          </Field>
          <Field label="Focus keyword" hint="The main phrase people search for. Used for the on-page check (title, H1, URL, description).">
            <Input value={s.focusKeyword} disabled={readonly} placeholder={page.focusKeyword || "e.g. hospital management software"} onChange={(v) => set({ focusKeyword: v }, "Edit focus keyword", "kw")} />
          </Field>
          <Field label="Meta keywords (optional)" hint="Ignored by Google; some other engines still read it.">
            <Input value={s.keywords} disabled={readonly} placeholder={page.keywords || ""} onChange={(v) => set({ keywords: v }, "Edit keywords", "keywords")} />
          </Field>
        </>
      ))}

      {section("index", "Indexing & canonical", "robot", (
        <>
          <Toggle checked={robots.index !== false} disabled={readonly} onChange={(v) => setRobots({ index: v })} label="Show this page in search results" hint="Off = noindex (also removed from the sitemap)" />
          <Toggle checked={robots.follow !== false} disabled={readonly} onChange={(v) => setRobots({ follow: v })} label="Let search engines follow links on this page" />
          <Toggle checked={!!robots.noarchive} disabled={readonly} onChange={(v) => setRobots({ noarchive: v || undefined })} label="No cached copy (noarchive)" />
          <Toggle checked={!!robots.nosnippet} disabled={readonly} onChange={(v) => setRobots({ nosnippet: v || undefined })} label="No text snippet (nosnippet)" hint="Also stops AI overviews quoting the page" />
          <Field label="Image preview size in results">
            <Select value={robots.maxImagePreview || "large"} disabled={readonly} onChange={(v) => setRobots({ maxImagePreview: v })} options={[{ value: "large", label: "Large (recommended)" }, { value: "standard", label: "Standard" }, { value: "none", label: "None" }]} />
          </Field>
          <Field label="Canonical URL" hint="Leave empty to use this page's own address. Set it only if another URL is the main version of this content.">
            <Input value={s.canonical} disabled={readonly} placeholder={seo.canonical} onChange={(v) => set({ canonical: v }, "Edit canonical", "canonical")} />
          </Field>
          <Field label="Breadcrumb label" hint="Short name used in breadcrumbs and breadcrumb schema.">
            <Input value={s.breadcrumb} disabled={readonly} placeholder={page.label} onChange={(v) => set({ breadcrumb: v }, "Edit breadcrumb", "bc")} />
          </Field>
        </>
      ))}

      {section("social", "Social sharing (Open Graph & X)", "send", (
        <>
          <div className="social-card">
            <div className="sc-img" style={seo.og.image ? { backgroundImage: `url("${seo.og.image}")` } : undefined}>{!seo.og.image && <I n="image" size={26} />}</div>
            <div className="sc-body"><small>{seo.canonical.replace(/^https?:\/\//, "").split("/")[0]}</small><strong>{seo.og.title}</strong><p>{seo.og.description.slice(0, 110)}</p></div>
          </div>
          <Field label="Share image" hint="1200 × 630 px works best on LinkedIn, WhatsApp, Facebook and X.">
            <div className="a-row">
              {og.image?.src && <img src={mediaUrl(og.image.src)} alt="" style={{ height: 44, borderRadius: 6 }} />}
              <Button size="sm" icon="image" disabled={readonly} onClick={() => pickImage((item) => set({ og: { ...og, image: imageValue(item) } }, "Set share image", "ogimg"))}>{og.image ? "Change" : "Choose image"}</Button>
              {og.image && <Button size="sm" variant="ghost" disabled={readonly} onClick={() => { const { image, ...rest } = og; set({ og: rest }, "Remove share image", "ogimg"); }}>Use site default</Button>}
            </div>
          </Field>
          <Field label="Share title" counter={<Counter value={og.title} max={70} />}><Input value={og.title} disabled={readonly} placeholder={seo.og.title} onChange={(v) => set({ og: { ...og, title: v } }, "Edit share title", "ogt")} /></Field>
          <Field label="Share description" counter={<Counter value={og.description} max={200} />}><Textarea rows={2} value={og.description} disabled={readonly} placeholder={seo.og.description} onChange={(v) => set({ og: { ...og, description: v } }, "Edit share description", "ogd")} /></Field>
          <Field label="Content type"><Select value={og.type || "website"} disabled={readonly} onChange={(v) => set({ og: { ...og, type: v } }, "Edit og:type", "ogtype")} options={["website", "article", "product"]} /></Field>
          <div className="a-section-title">X (Twitter)</div>
          <Field label="Card style"><Select value={tw.card || "summary_large_image"} disabled={readonly} onChange={(v) => set({ twitter: { ...tw, card: v } }, "Edit X card", "twc")} options={[{ value: "summary_large_image", label: "Large image" }, { value: "summary", label: "Small square image" }]} /></Field>
          <Field label="X title (optional)"><Input value={tw.title} disabled={readonly} placeholder={seo.twitter.title} onChange={(v) => set({ twitter: { ...tw, title: v } }, "Edit X title", "twt")} /></Field>
          <Field label="X description (optional)"><Textarea rows={2} value={tw.description} disabled={readonly} placeholder={seo.twitter.description} onChange={(v) => set({ twitter: { ...tw, description: v } }, "Edit X description", "twd")} /></Field>
        </>
      ))}

      {section("schema", "Structured data (schema.org)", "code", (
        <>
          <Toggle checked={schema.auto !== false} disabled={readonly} onChange={(v) => set({ schema: { ...schema, auto: v } }, "Edit schema", "schema")} label="Automatic schema" hint="Breadcrumbs plus this page's built-in schema (FAQ, software product…). Organisation / website schema are set globally." />
          <Field label="Extra JSON-LD (advanced)" error={customError ? `Not valid JSON: ${customError}` : null} hint="Paste schema.org JSON-LD (an object or an array). Invalid JSON blocks publishing so nothing broken goes live.">
            <textarea className="a-code" spellCheck="false" disabled={readonly} value={schema.custom ?? schema.customInvalid ?? ""} placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "..."\n}'} onChange={(e) => set({ schema: { auto: schema.auto !== false, custom: e.target.value } }, "Edit custom schema", "schemac")} />
          </Field>
          <Badge tone="gray">{seo.jsonLd.length} schema block(s) from global settings</Badge>
          <a className="a-small" href="https://validator.schema.org/" target="_blank" rel="noopener noreferrer">Validate with schema.org <I n="external" size={11} /></a>
        </>
      ))}

      {section("sitemap", "Sitemap", "map", (
        <>
          <Toggle checked={sm.include !== false} disabled={readonly} onChange={(v) => set({ sitemap: { ...sm, include: v } }, "Edit sitemap", "sm")} label="Include in sitemap.xml" hint={seo.noindex ? "noindex pages are always left out" : null} />
          <div className="a-grid-2">
            <Field label="Priority"><Select value={String(sm.priority ?? page.sitemap?.priority ?? 0.7)} disabled={readonly} onChange={(v) => set({ sitemap: { ...sm, priority: Number(v) } }, "Edit sitemap", "sm")} options={["1", "0.9", "0.8", "0.7", "0.6", "0.5", "0.4", "0.3"].map((x) => ({ value: x, label: x }))} /></Field>
            <Field label="Changes"><Select value={sm.changefreq || page.sitemap?.changefreq || "monthly"} disabled={readonly} onChange={(v) => set({ sitemap: { ...sm, changefreq: v } }, "Edit sitemap", "sm")} options={["daily", "weekly", "monthly", "yearly"]} /></Field>
          </div>
        </>
      ))}

      {media && <MediaPicker kind="image" onClose={() => setMedia(null)} onSelect={(item) => { media.onPick(item); setMedia(null); }} />}
    </div>
  );
}

/** Drop empty strings so defaults apply again. */
function clean(seo) {
  const out = {};
  for (const [k, v] of Object.entries(seo)) {
    if (v === "" || v === undefined || v === null) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && !v.t) {
      const inner = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "" && x !== undefined && x !== null));
      if (Object.keys(inner).length) out[k] = inner;
    } else out[k] = v;
  }
  return out;
}
