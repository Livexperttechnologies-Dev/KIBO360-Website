import { PAGES, BUILTIN_REDIRECTS } from "./pageMeta.js";
import { DEFAULT_SEO, DEFAULT_SITE, mergeDefaults } from "./defaults.js";

// ---------------------------------------------------------------------------
// SEO engine (pure functions - no React, no DOM). Used identically by the
// live site, server-side rendering, the static prerender and the admin's
// SEO health checker, so what the admin audits is what search engines get.
// ---------------------------------------------------------------------------

const abs = (siteUrl, u) => {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `${siteUrl.replace(/\/$/, "")}${u.startsWith("/") ? "" : "/"}${u}`;
};
const mediaAbs = (siteUrl, mediaBase, src) => (src && src.startsWith("/uploads/") && mediaBase ? `${mediaBase}${src}` : abs(siteUrl, src));

export function mergedSeo(docs) { return mergeDefaults(DEFAULT_SEO, docs?.seo || {}); }
export function mergedSite(docs) {
  const s = docs?.site || {};
  return { ...mergeDefaults(DEFAULT_SITE, s), menus: DEFAULT_SITE.menus };
}

/**
 * Everything that goes into <head> for one page.
 * page: registry entry (or custom-page meta) { id, path, title, description, noindex, breadcrumbs, keywords }
 */
export function computeSeo({ page, docs, path, codeJsonLd = null, mediaBase = "" }) {
  const g = mergedSeo(docs);
  const site = mergedSite(docs);
  const siteUrl = (g.global.siteUrl || "https://kibo360.in").replace(/\/$/, "");
  const pdoc = docs?.[`page:${page.id}`] || {};
  const s = pdoc.seo || {};
  const company = site.settings.company;

  const rawTitle = s.title || page.title || company.name;
  const tpl = g.global.titleTemplate || "%s";
  const brand = g.global.siteName || company.name;
  const title = rawTitle.toLowerCase().includes(brand.toLowerCase()) || !tpl.includes("%s") ? rawTitle : tpl.replace("%s", rawTitle);
  const description = s.description || page.description || g.global.defaultDescription || "";
  const canonical = s.canonical ? abs(siteUrl, s.canonical) : `${siteUrl}${path === "/" ? "/" : path}`;
  const noindex = s.robots ? !s.robots.index : !!page.noindex;
  const nofollow = s.robots ? !s.robots.follow : !!page.noindex;
  const directives = [noindex ? "noindex" : "index", nofollow ? "nofollow" : "follow"];
  if (!noindex) {
    directives.push(`max-image-preview:${s.robots?.maxImagePreview || "large"}`);
    if (s.robots?.maxSnippet !== undefined) directives.push(`max-snippet:${s.robots.maxSnippet}`);
    if (s.robots?.noarchive) directives.push("noarchive");
    if (s.robots?.nosnippet) directives.push("nosnippet");
  }
  const ogImg = s.og?.image || g.global.defaultOgImage;
  const og = {
    title: s.og?.title || title,
    description: s.og?.description || description,
    image: ogImg ? mediaAbs(siteUrl, mediaBase, ogImg.src) : "",
    imageAlt: ogImg?.alt || "",
    imageWidth: ogImg?.width || null,
    imageHeight: ogImg?.height || null,
    type: s.og?.type || "website",
    url: canonical,
    siteName: brand,
    locale: g.global.locale || "en_IN",
  };
  const twImg = s.twitter?.image || ogImg;
  const twitter = {
    card: s.twitter?.card || "summary_large_image",
    title: s.twitter?.title || og.title,
    description: s.twitter?.description || og.description,
    image: twImg ? mediaAbs(siteUrl, mediaBase, twImg.src) : "",
    site: g.global.twitterHandle ? `@${g.global.twitterHandle.replace(/^@/, "")}` : "",
  };

  // ---- structured data ----
  const jsonLd = [];
  const org = g.schema.organization;
  const orgId = `${siteUrl}/#org`;
  const logo = site.settings.branding.logo?.src;
  if (org.enabled) {
    const sameAs = [...new Set([...(org.sameAs || []), ...Object.values(site.settings.social || {}).filter(Boolean)])];
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": org.type || "Organization",
      "@id": orgId,
      name: org.name || brand,
      legalName: org.legalName || company.legalName || undefined,
      url: `${siteUrl}/`,
      logo: logo ? mediaAbs(siteUrl, mediaBase, logo) : undefined,
      description: org.description || undefined,
      foundingDate: org.foundingDate || undefined,
      sameAs: sameAs.length ? sameAs : undefined,
      contactPoint: company.phone || company.email ? [{
        "@type": "ContactPoint", contactType: "sales", telephone: company.phone?.replace(/\s/g, "") || undefined,
        email: company.email || undefined, areaServed: "IN", availableLanguage: ["en", "hi"],
      }] : undefined,
    });
  }
  if (g.schema.website?.enabled && path === "/") {
    jsonLd.push({ "@context": "https://schema.org", "@type": "WebSite", "@id": `${siteUrl}/#website`, url: `${siteUrl}/`, name: brand, publisher: { "@id": orgId }, inLanguage: (g.global.locale || "en_IN").replace("_", "-") });
  }
  const lb = g.schema.localBusiness;
  if (lb?.enabled && (path === "/" || path === "/contact")) {
    jsonLd.push({
      "@context": "https://schema.org", "@type": "LocalBusiness", "@id": `${siteUrl}/#localbusiness`, name: org.name || brand, url: `${siteUrl}/`,
      telephone: company.phone || undefined, email: company.email || undefined, image: logo ? mediaAbs(siteUrl, mediaBase, logo) : undefined,
      address: { "@type": "PostalAddress", streetAddress: lb.streetAddress, addressLocality: lb.locality, addressRegion: lb.region, postalCode: lb.postalCode, addressCountry: lb.country || "IN" },
      geo: lb.latitude != null && lb.longitude != null ? { "@type": "GeoCoordinates", latitude: lb.latitude, longitude: lb.longitude } : undefined,
      openingHours: lb.openingHours || undefined,
    });
  }
  const auto = s.schema?.auto !== false;
  const crumbs = breadcrumbsFor(page, s);
  if (auto && crumbs.length > 1) {
    jsonLd.push({
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, ...(c.path ? { item: `${siteUrl}${c.path === "/" ? "/" : c.path}` } : {}) })),
    });
  }
  if (auto && codeJsonLd) for (const j of [].concat(codeJsonLd)) if (j) jsonLd.push(j);
  if (s.schema?.custom) {
    try { const parsed = JSON.parse(s.schema.custom); for (const j of [].concat(parsed)) jsonLd.push(j); } catch { /* validated on publish */ }
  }

  const v = site.settings.verification || {};
  const verification = [
    v.google && { name: "google-site-verification", content: v.google },
    v.bing && { name: "msvalidate.01", content: v.bing },
    v.yandex && { name: "yandex-verification", content: v.yandex },
    v.pinterest && { name: "p:domain_verify", content: v.pinterest },
    v.facebook && { name: "facebook-domain-verification", content: v.facebook },
  ].filter(Boolean);

  return {
    title, rawTitle, description, keywords: s.keywords || page.keywords || g.global.keywords || "",
    canonical, robots: directives.join(", "), noindex, og, twitter, jsonLd: jsonLd.map(stripUndefined), verification,
    favicon: site.settings.branding.favicon?.src ? mediaAbs("", mediaBase, site.settings.branding.favicon.src) : "/favicon.png",
    breadcrumbs: crumbs, focusKeyword: s.focusKeyword || page.focusKeyword || "",
  };
}

export function breadcrumbsFor(page, s = {}) {
  const base = page.breadcrumbs || (page.path && page.path !== "/" ? [{ label: "Home", path: "/" }, { label: page.label || page.title }] : []);
  if (!base.length) return [];
  const out = base.map((c) => ({ ...c }));
  if (s.breadcrumb) out[out.length - 1].label = s.breadcrumb;
  return out;
}

function stripUndefined(o) {
  if (Array.isArray(o)) return o.map(stripUndefined);
  if (o && typeof o === "object") {
    const out = {};
    for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") out[k] = stripUndefined(v);
    return out;
  }
  return o;
}

/** Tag list (shared by the SSR string renderer and the client head manager). */
export function headTags(seo) {
  const t = [];
  const m = (attrs) => t.push({ tag: "meta", attrs });
  m({ name: "description", content: seo.description });
  if (seo.keywords) m({ name: "keywords", content: seo.keywords });
  m({ name: "robots", content: seo.robots });
  t.push({ tag: "link", attrs: { rel: "canonical", href: seo.canonical } });
  m({ property: "og:locale", content: seo.og.locale });
  m({ property: "og:site_name", content: seo.og.siteName });
  m({ property: "og:type", content: seo.og.type });
  m({ property: "og:url", content: seo.og.url });
  m({ property: "og:title", content: seo.og.title });
  m({ property: "og:description", content: seo.og.description });
  if (seo.og.image) {
    m({ property: "og:image", content: seo.og.image });
    if (seo.og.imageAlt) m({ property: "og:image:alt", content: seo.og.imageAlt });
    if (seo.og.imageWidth) m({ property: "og:image:width", content: String(seo.og.imageWidth) });
    if (seo.og.imageHeight) m({ property: "og:image:height", content: String(seo.og.imageHeight) });
  }
  m({ name: "twitter:card", content: seo.twitter.card });
  m({ name: "twitter:title", content: seo.twitter.title });
  m({ name: "twitter:description", content: seo.twitter.description });
  if (seo.twitter.image) m({ name: "twitter:image", content: seo.twitter.image });
  if (seo.twitter.site) m({ name: "twitter:site", content: seo.twitter.site });
  for (const v of seo.verification) m(v);
  t.push({ tag: "link", attrs: { rel: "icon", href: seo.favicon } });
  seo.jsonLd.forEach((j, i) => t.push({ tag: "script", attrs: { type: "application/ld+json", "data-kibo-jsonld": String(i) }, text: jsonForScript(j) }));
  return t;
}

/** JSON safe to embed inside <script>: no "</script>" / HTML-comment breakouts. */
export function jsonForScript(v) {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

const escAttr = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escText = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Head HTML for server rendering / prerendering. */
export function renderHeadHtml(seo) {
  const lines = [`<title>${escText(seo.title)}</title>`];
  for (const t of headTags(seo)) {
    const attrs = Object.entries(t.attrs).map(([k, v]) => `${k}="${escAttr(v)}"`).join(" ");
    lines.push(t.tag === "script" ? `<script ${attrs} data-kibo-head="1">${t.text}</script>` : `<${t.tag} ${attrs} data-kibo-head="1" />`);
  }
  return lines.join("\n    ");
}

// ---------------------------------------------------------------- files
/** All indexable URLs: built-in pages + published custom pages. */
export function siteEntries(docs) {
  const out = [];
  for (const p of PAGES) out.push({ id: p.id, path: p.path, label: p.label, builtin: true, noindex: !!p.noindex, sitemap: p.sitemap || {} });
  for (const [docId, d] of Object.entries(docs || {})) {
    if (!docId.startsWith("page:c-") || !d?.meta?.slug) continue;
    out.push({ id: docId.slice(5), path: d.meta.slug, label: d.meta.label || d.meta.slug, builtin: false, noindex: false, sitemap: {} });
  }
  return out;
}

export function buildSitemap(docs, { lastmod = null } = {}) {
  const g = mergedSeo(docs);
  const siteUrl = (g.global.siteUrl || "https://kibo360.in").replace(/\/$/, "");
  if (g.sitemap.enabled === false) return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;
  const exclude = new Set(g.sitemap.exclude || []);
  const rows = [];
  for (const e of siteEntries(docs)) {
    const s = docs?.[`page:${e.id}`]?.seo || {};
    const noindex = s.robots ? !s.robots.index : e.noindex;
    const include = s.sitemap?.include ?? e.sitemap.include ?? true;
    if (noindex || !include || exclude.has(e.path) || s.canonical) continue;
    const prio = s.sitemap?.priority ?? e.sitemap.priority ?? 0.5;
    const freq = s.sitemap?.changefreq || e.sitemap.changefreq || "monthly";
    rows.push(`  <url>\n    <loc>${escText(`${siteUrl}${e.path === "/" ? "/" : e.path}`)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n    <changefreq>${freq}</changefreq>\n    <priority>${Number(prio).toFixed(1)}</priority>\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

const AI_TRAINING_BOTS = ["GPTBot", "Google-Extended", "CCBot", "ClaudeBot", "anthropic-ai", "Applebot-Extended", "Bytespider", "meta-externalagent", "PerplexityBot", "cohere-ai"];

export function buildRobots(docs) {
  const g = mergedSeo(docs);
  const siteUrl = (g.global.siteUrl || "https://kibo360.in").replace(/\/$/, "");
  if (g.robots.mode === "custom" && g.robots.custom.trim()) return g.robots.custom.trim() + "\n";
  const lines = ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", "Disallow: /*?kibo_preview=", "Disallow: /*?kibo_editor="];
  for (const p of g.robots.disallow || []) lines.push(`Disallow: ${p}`);
  if (g.robots.crawlDelay) lines.push(`Crawl-delay: ${g.robots.crawlDelay}`);
  if (g.robots.blockAiTraining) {
    lines.push("", "# AI training crawlers (search engines are unaffected)");
    for (const b of AI_TRAINING_BOTS) lines.push(`User-agent: ${b}`, "Disallow: /", "");
  }
  if (g.sitemap.enabled !== false) lines.push("", `Sitemap: ${siteUrl}/sitemap.xml`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

/** llms.txt - a plain-language site guide for AI assistants (llmstxt.org). */
export function buildLlms(docs) {
  const g = mergedSeo(docs);
  const site = mergedSite(docs);
  if (g.llms?.enabled === false) return "";
  if (g.llms?.mode === "custom" && g.llms.custom.trim()) return g.llms.custom.trim() + "\n";
  const siteUrl = (g.global.siteUrl || "https://kibo360.in").replace(/\/$/, "");
  const c = site.settings.company;
  const lines = [`# ${g.global.siteName || c.name}`, "", `> ${g.global.defaultDescription}`, "", `${c.name} is built by ${c.legalName}. Contact: ${c.email} · ${c.phone} · ${c.address}.`, "", "## Pages", ""];
  for (const e of siteEntries(docs)) {
    const s = docs?.[`page:${e.id}`]?.seo || {};
    if (s.robots ? !s.robots.index : e.noindex) continue;
    const meta = PAGES.find((p) => p.id === e.id);
    lines.push(`- [${s.title || meta?.title || e.label}](${siteUrl}${e.path === "/" ? "/" : e.path}): ${s.description || meta?.description || ""}`.trim());
  }
  return lines.join("\n") + "\n";
}

/** Effective redirects (CMS + built-in legacy URLs). */
export function effectiveRedirects(docs) {
  const g = mergedSeo(docs);
  const cms = (g.redirects || []).filter((r) => r.enabled && !r.invalid);
  const seen = new Set(cms.map((r) => r.from.toLowerCase()));
  return [...cms, ...BUILTIN_REDIRECTS.filter((r) => !seen.has(r.from)).map((r) => ({ ...r, type: 301, enabled: true, builtin: true }))];
}
export function matchRedirect(docs, pathname) {
  const p = (pathname.replace(/\/+$/, "") || "/").toLowerCase();
  return effectiveRedirects(docs).find((r) => r.from.toLowerCase() === p) || null;
}

// ---------------------------------------------------------------- analysis
/**
 * SEO health check for one rendered page.
 * dom: { h1s: [text], headings: [{level,text}], images: [{src, alt}], links: [{href, text, internal}], text }
 */
export function analyzePage({ seo, dom, path, allTitles = [], allDescriptions = [] }) {
  const issues = [];
  const add = (level, code, message, weight = 0) => issues.push({ level, code, message, weight });
  const tl = seo.title.length;
  if (!seo.rawTitle) add("error", "title-missing", "Missing SEO title", 20);
  else if (tl < 30) add("warning", "title-short", `SEO title is short (${tl} chars) - aim for 30-60`, 6);
  else if (tl > 60) add("warning", "title-long", `SEO title is ${tl} chars - Google usually truncates after ~60`, 6);
  const dl = seo.description.length;
  if (!dl) add("error", "desc-missing", "Missing meta description", 15);
  else if (dl < 70) add("warning", "desc-short", `Meta description is short (${dl} chars) - aim for 70-160`, 5);
  else if (dl > 160) add("warning", "desc-long", `Meta description is ${dl} chars - it may be cut off after ~160`, 4);
  if (allTitles.filter((t) => t === seo.title).length > 1) add("warning", "title-duplicate", "Another page has the same SEO title", 6);
  if (allDescriptions.filter((d) => d && d === seo.description).length > 1) add("warning", "desc-duplicate", "Another page has the same meta description", 4);
  if (seo.noindex && path !== "/thank-you") add("warning", "noindex", "Page is set to noindex - it will not appear in search results", 0);
  if (!seo.og.image) add("warning", "og-image-missing", "No social share image (Open Graph)", 5);
  else if (seo.og.imageWidth && seo.og.imageWidth < 1200) add("info", "og-image-small", `Social share image is ${seo.og.imageWidth}px wide - 1200×630 looks best on LinkedIn/WhatsApp/X`, 2);
  if (dom) {
    if (dom.h1s.length === 0) add("error", "h1-missing", "No H1 heading on the page", 12);
    if (dom.h1s.length > 1) add("warning", "h1-multiple", `${dom.h1s.length} H1 headings - use exactly one`, 5);
    let prev = 1;
    for (const h of dom.headings) {
      if (h.level > prev + 1) { add("info", "heading-skip", `Heading level jumps from H${prev} to H${h.level} ("${h.text.slice(0, 40)}")`, 1); break; }
      prev = h.level;
    }
    const noAlt = dom.images.filter((i) => !i.alt && !i.decorative);
    if (noAlt.length) add("warning", "img-alt", `${noAlt.length} image(s) without alt text`, Math.min(8, noAlt.length * 2));
    const words = (dom.text || "").split(/\s+/).filter(Boolean).length;
    if (words < 250 && path !== "/thank-you") add("warning", "thin-content", `Only ~${words} words of text - thin pages rank poorly`, 5);
    const internal = dom.links.filter((l) => l.internal).length;
    if (internal < 3 && path !== "/thank-you") add("info", "few-internal-links", `Only ${internal} internal links - link to related pages`, 2);
    const emptyLinks = dom.links.filter((l) => !l.text && !l.label);
    if (emptyLinks.length) add("warning", "link-text", `${emptyLinks.length} link(s) without descriptive text`, 3);
    const kw = (seo.focusKeyword || "").toLowerCase().trim();
    if (kw) {
      const inTitle = seo.title.toLowerCase().includes(kw);
      const inDesc = seo.description.toLowerCase().includes(kw);
      const inH1 = dom.h1s.some((h) => h.toLowerCase().includes(kw));
      const inUrl = path.replace(/[-/]/g, " ").includes(kw.replace(/-/g, " ")) || path.includes(kw.replace(/\s+/g, ""));
      const density = words ? ((dom.text.toLowerCase().split(kw).length - 1) / words) * 100 : 0;
      if (!inTitle) add("warning", "kw-title", `Focus keyword "${kw}" is not in the SEO title`, 4);
      if (!inDesc) add("info", "kw-desc", `Focus keyword "${kw}" is not in the meta description`, 2);
      if (!inH1) add("info", "kw-h1", `Focus keyword "${kw}" is not in the H1`, 2);
      if (!inUrl) add("info", "kw-url", `Focus keyword "${kw}" is not in the URL`, 1);
      if (density > 3) add("warning", "kw-stuffing", `Focus keyword density is ${density.toFixed(1)}% - this can look like keyword stuffing`, 3);
    } else {
      add("info", "kw-missing", "No focus keyword set - add one to get keyword checks", 1);
    }
  }
  if (!seo.jsonLd.length) add("info", "schema-missing", "No structured data (schema.org) on this page", 2);
  const score = Math.max(0, 100 - issues.reduce((n, i) => n + i.weight, 0));
  return { score, issues };
}
