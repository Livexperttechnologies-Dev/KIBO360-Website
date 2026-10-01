import { safeUrl, clampStr } from "./security.js";
import { sanitizeHtml } from "./sanitize.js";

// ---------------------------------------------------------------------------
// Content document schemas. Every draft save and every publish runs the data
// through these normalizers: unknown keys are dropped, strings are capped,
// URLs validated, rich text sanitized. Invalid values are removed rather
// than rejected wholesale, so one bad field can never block an autosave -
// while publish re-runs the same pass as a second line of defence.
// ---------------------------------------------------------------------------

export class ValidationError extends Error {
  constructor(message, details) { super(message); this.status = 400; this.details = details; }
}

export const DOC_ID_RE = /^(site|seo|forms|page:[a-z0-9][a-z0-9-]{0,59})$/;
export const docType = (docId) => (docId.startsWith("page:") ? "page" : docId);

const KEY_RE = /^[A-Za-z0-9_~-]+(\.[A-Za-z0-9_~-]+){0,9}$/;
const ITEM_RE = /^[A-Za-z0-9_-]{1,60}(~[A-Za-z0-9_-]{1,16})?$/;
const BLOCK_ID_RE = /^b_[A-Za-z0-9_-]{4,24}$/;
const ICON_RE = /^[a-z0-9-]{1,40}$/;
export const BLOCK_TYPES = ["hero", "richText", "split", "cards", "stats", "faq", "cta", "image", "video", "chips", "form", "spacer", "logos"];
const BG = ["none", "soft", "dark", "brand"];

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const bool = (v, d = false) => (v === undefined || v === null ? d : !!v);
const int = (v, min, max, d = null) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** Plain text: keep newlines/tabs, strip other control characters. */
export function cleanText(v, max = 8000) {
  if (v == null) return "";
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, max);
}

const urlOpts = { allowRelative: true, allowMailto: true, allowTel: true, allowHash: true };
const mediaUrl = (v) => safeUrl(v, { allowRelative: true, allowMailto: false, allowTel: false, allowHash: false });

export function normImage(v) {
  if (!isObj(v)) return null;
  const src = mediaUrl(v.src);
  if (!src) return null;
  const out = { t: "img", src, alt: cleanText(v.alt, 300) };
  if (v.title) out.title = cleanText(v.title, 200);
  if (typeof v.mediaId === "string" && /^m_[A-Za-z0-9_-]{4,40}$/.test(v.mediaId)) out.mediaId = v.mediaId;
  const w = int(v.width, 1, 20000), h = int(v.height, 1, 20000);
  if (w) out.width = w;
  if (h) out.height = h;
  if (Array.isArray(v.srcset)) {
    const set = v.srcset
      .filter(isObj)
      .map((s) => ({ url: mediaUrl(s.url), w: int(s.w, 1, 20000) }))
      .filter((s) => s.url && s.w)
      .slice(0, 8);
    if (set.length) out.srcset = set;
  }
  return out;
}

const ACTIONS = ["link", "demo", "tel", "mailto", "whatsapp", "none"];
export function normButton(v) {
  if (!isObj(v)) return null;
  const action = ACTIONS.includes(v.action) ? v.action : "link";
  const out = { t: "btn", label: cleanText(v.label, 120), action };
  if (action === "link" || action === "tel" || action === "mailto") {
    const href = safeUrl(v.href, urlOpts);
    if (href) out.href = href;
    else if (action === "link" && v.href) return { ...out, action: "none" };
  }
  if (v.newTab) out.newTab = true;
  if (["primary", "outline", "light", "dark"].includes(v.style)) out.style = v.style;
  return out;
}

export function normVideo(v) {
  if (!isObj(v)) return null;
  const provider = ["youtube", "vimeo", "file"].includes(v.provider) ? v.provider : null;
  if (!provider) return null;
  const out = { t: "video", provider, title: cleanText(v.title, 200) };
  if (provider === "youtube") {
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(String(v.id || ""))) return null;
    out.id = v.id;
  } else if (provider === "vimeo") {
    if (!/^\d{4,15}$/.test(String(v.id || ""))) return null;
    out.id = String(v.id);
  } else {
    const src = mediaUrl(v.src);
    if (!src) return null;
    out.src = src;
  }
  const poster = normImage(v.poster);
  if (poster) out.poster = poster;
  return out;
}

/** Any single content value. Returns undefined for "drop". */
export function normValue(v) {
  if (v === null) return null; // explicit delete in patches
  if (typeof v === "string") return cleanText(v, 8000);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (!isObj(v)) return undefined;
  switch (v.t) {
    case "html": {
      const html = sanitizeHtml(v.html, { mode: "block", maxLength: 80000 });
      return { t: "html", html };
    }
    case "img": return normImage(v) ?? undefined;
    case "btn": return normButton(v) ?? undefined;
    case "video": return normVideo(v) ?? undefined;
    case "icon": return ICON_RE.test(String(v.name || "")) ? { t: "icon", name: v.name } : undefined;
    default: return undefined;
  }
}

function normFields(fields) {
  const out = {};
  if (!isObj(fields)) return out;
  let count = 0;
  for (const [k, v] of Object.entries(fields)) {
    if (!KEY_RE.test(k) || k.length > 200) continue;
    const nv = normValue(v);
    if (nv === undefined || nv === null) continue;
    out[k] = nv;
    if (++count >= 3000) break;
  }
  return out;
}

function normIdList(list) {
  return Array.isArray(list) ? [...new Set(list.filter((x) => typeof x === "string" && ITEM_RE.test(x)))].slice(0, 300) : [];
}
function normFlags(map) {
  const out = {};
  if (!isObj(map)) return out;
  for (const [k, v] of Object.entries(map)) if (ITEM_RE.test(k) && v) out[k] = true;
  return out;
}
function normDups(map) {
  const out = {};
  if (!isObj(map)) return out;
  for (const [k, v] of Object.entries(map)) {
    if (ITEM_RE.test(k) && k.includes("~") && typeof v === "string" && ITEM_RE.test(v)) out[k] = v;
  }
  return out;
}

export function normList(v) {
  if (!isObj(v)) return null;
  return { order: normIdList(v.order), hidden: normFlags(v.hidden), dups: normDups(v.dups) };
}

export function normLayout(v) {
  if (!isObj(v)) return null;
  const blocks = {};
  if (isObj(v.blocks)) {
    for (const [id, b] of Object.entries(v.blocks).slice(0, 80)) {
      if (!BLOCK_ID_RE.test(id) || !isObj(b) || !BLOCK_TYPES.includes(b.type)) continue;
      const nb = { type: b.type };
      if (BG.includes(b.bg)) nb.bg = b.bg;
      if (["left", "center"].includes(b.align)) nb.align = b.align;
      if (typeof b.formId === "string" && /^[a-z0-9-]{1,40}$/.test(b.formId)) nb.formId = b.formId;
      if (["2", "3", "4"].includes(String(b.columns))) nb.columns = String(b.columns);
      if (typeof b.anchor === "string" && /^[a-z0-9-]{1,40}$/.test(b.anchor)) nb.anchor = b.anchor;
      blocks[id] = nb;
    }
  }
  const order = Array.isArray(v.order)
    ? [...new Set(v.order.filter((x) => typeof x === "string" && (ITEM_RE.test(x) || BLOCK_ID_RE.test(x))))].slice(0, 120)
    : [];
  const hidden = {};
  if (isObj(v.hidden)) for (const [k, f] of Object.entries(v.hidden)) if ((ITEM_RE.test(k) || BLOCK_ID_RE.test(k)) && f) hidden[k] = true;
  return { order, hidden, dups: normDups(v.dups), blocks };
}

// ------------------------------------------------------------------- SEO
const CHANGEFREQ = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];
function normSchemaJson(s) {
  if (s == null || s === "") return "";
  const str = String(s).slice(0, 30000);
  let parsed;
  try { parsed = JSON.parse(str); } catch { throw new ValidationError("Custom schema must be valid JSON-LD"); }
  if (!isObj(parsed) && !Array.isArray(parsed)) throw new ValidationError("Custom schema must be a JSON object or array");
  return JSON.stringify(parsed);
}
export function normPageSeo(v, { strict = false } = {}) {
  if (!isObj(v)) return {};
  const out = {};
  const str = (k, max) => { if (typeof v[k] === "string" && v[k].trim()) out[k] = cleanText(v[k], max).replace(/\s+/g, " ").trim(); };
  str("title", 200);
  str("description", 400);
  str("keywords", 400);
  str("breadcrumb", 120);
  str("focusKeyword", 120);
  if (v.canonical) { const c = safeUrl(v.canonical, { allowRelative: true, allowMailto: false, allowTel: false, allowHash: false }); if (c) out.canonical = c; }
  if (isObj(v.robots)) {
    out.robots = { index: bool(v.robots.index, true), follow: bool(v.robots.follow, true) };
    if (v.robots.noarchive) out.robots.noarchive = true;
    if (v.robots.nosnippet) out.robots.nosnippet = true;
    if (["large", "standard", "none"].includes(v.robots.maxImagePreview)) out.robots.maxImagePreview = v.robots.maxImagePreview;
    const ms = int(v.robots.maxSnippet, -1, 1000);
    if (ms !== null && v.robots.maxSnippet !== undefined && v.robots.maxSnippet !== "") out.robots.maxSnippet = ms;
  }
  for (const k of ["og", "twitter"]) {
    if (!isObj(v[k])) continue;
    const o = {};
    if (typeof v[k].title === "string" && v[k].title.trim()) o.title = cleanText(v[k].title, 200).trim();
    if (typeof v[k].description === "string" && v[k].description.trim()) o.description = cleanText(v[k].description, 400).trim();
    const img = normImage(v[k].image);
    if (img) o.image = img;
    if (k === "og" && ["website", "article", "product"].includes(v.og.type)) o.type = v.og.type;
    if (k === "twitter" && ["summary", "summary_large_image"].includes(v.twitter.card)) o.card = v.twitter.card;
    if (Object.keys(o).length) out[k] = o;
  }
  if (isObj(v.schema)) {
    const schema = { auto: bool(v.schema.auto, true) };
    // A draft may hold invalid JSON-LD while someone is still typing it, but
    // it must never be published silently stripped - block the publish.
    if (strict && typeof v.schema.customInvalid === "string" && v.schema.custom === undefined) {
      throw new ValidationError("The custom schema (JSON-LD) on this page is not valid JSON - fix it in SEO → Schema before publishing");
    }
    try {
      const custom = normSchemaJson(v.schema.custom);
      if (custom) schema.custom = custom;
    } catch (e) {
      if (strict) throw e;
      if (typeof v.schema.custom === "string") schema.customInvalid = cleanText(v.schema.custom, 30000);
    }
    out.schema = schema;
  }
  if (isObj(v.sitemap)) {
    const sm = { include: bool(v.sitemap.include, true) };
    const pr = Number(v.sitemap.priority);
    if (Number.isFinite(pr) && pr >= 0 && pr <= 1) sm.priority = Math.round(pr * 10) / 10;
    if (CHANGEFREQ.includes(v.sitemap.changefreq)) sm.changefreq = v.sitemap.changefreq;
    out.sitemap = sm;
  }
  return out;
}

// ------------------------------------------------------------------ page
const SLUG_RE = /^\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/;
const RESERVED = ["/admin", "/api", "/uploads", "/assets", "/preview", "/thank-you", "/sitemap.xml", "/robots.txt", "/llms.txt"];
export function validSlug(slug) {
  const s = String(slug || "").trim().toLowerCase();
  if (!SLUG_RE.test(s) || s.length > 120) return null;
  if (RESERVED.some((r) => s === r || s.startsWith(`${r}/`))) return null;
  return s;
}

export function normPage(data, opts = {}) {
  const d = isObj(data) ? data : {};
  const out = { fields: normFields(d.fields), lists: {}, layout: normLayout(d.layout) || { order: [], hidden: {}, dups: {}, blocks: {} }, seo: normPageSeo(d.seo, opts), meta: {} };
  if (isObj(d.lists)) {
    for (const [k, v] of Object.entries(d.lists).slice(0, 300)) {
      if (!KEY_RE.test(k)) continue;
      const nl = normList(v);
      if (nl) out.lists[k] = nl;
    }
  }
  if (isObj(d.meta)) {
    if (d.meta.label) out.meta.label = cleanText(d.meta.label, 120).trim();
    if (d.meta.slug) { const s = validSlug(d.meta.slug); if (s) out.meta.slug = s; }
    if (d.meta.template === "custom") out.meta.template = "custom";
  }
  return out;
}

// ------------------------------------------------------------------ site
function normMenu(items, depth = 0) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 30).filter(isObj).map((it) => {
    const m = {
      id: typeof it.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(it.id) ? it.id : `mi_${Math.random().toString(36).slice(2, 9)}`,
      label: cleanText(it.label, 80).trim(),
      href: safeUrl(it.href, urlOpts) || "",
    };
    if (it.newTab) m.newTab = true;
    if (it.hidden) m.hidden = true;
    if (depth === 0 && Array.isArray(it.children) && it.children.length) m.children = normMenu(it.children, 1);
    return m;
  }).filter((m) => m.label);
}
const socialUrl = (v) => safeUrl(v, { allowRelative: false, allowMailto: false, allowTel: false, allowHash: false }) || "";
const idLike = (v, re) => (typeof v === "string" && re.test(v.trim()) ? v.trim() : "");

// Custom code snippets (Website -> Header & Footer Scripts). The code itself is
// deliberately NOT sanitised - it is meant to run - so editing and publishing
// it needs the separate "site.code" permission (enforced in content.js).
export const SNIPPET_LOCATIONS = ["head", "bodyStart", "bodyEnd"];
export function normCode(v) {
  const list = Array.isArray(v?.snippets) ? v.snippets : [];
  const seen = new Set();
  const snippets = list.slice(0, 30).filter(isObj).map((s) => {
    let id = typeof s.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(s.id) ? s.id : "";
    while (!id || seen.has(id)) id = `sn_${Math.random().toString(36).slice(2, 10)}`;
    seen.add(id);
    return {
      id,
      name: cleanText(s.name, 80).trim() || "Custom code",
      location: SNIPPET_LOCATIONS.includes(s.location) ? s.location : "head",
      code: cleanText(s.code, 50000),
      enabled: bool(s.enabled, true),
      pages: Array.isArray(s.pages) ? [...new Set(s.pages.map((p) => String(p)).filter((p) => p === "*" || p === "/" || SLUG_RE.test(p)))].slice(0, 60) : ["*"],
      consent: s.consent === "analytics" ? "analytics" : "none",
      preview: bool(s.preview, false),
    };
  });
  return { snippets };
}

export function normSite(data) {
  const d = isObj(data) ? data : {};
  const out = {};
  if (isObj(d.header)) {
    out.header = {};
    const logo = normImage(d.header.logo); if (logo) out.header.logo = logo;
    const cta = normButton(d.header.cta); if (cta) out.header.cta = cta;
    out.header.showCta = bool(d.header.showCta, true);
  }
  if (isObj(d.menus)) {
    out.menus = {};
    if (Array.isArray(d.menus.header)) out.menus.header = normMenu(d.menus.header);
    if (Array.isArray(d.menus.footerColumns)) {
      out.menus.footerColumns = d.menus.footerColumns.slice(0, 6).filter(isObj).map((c) => ({
        title: cleanText(c.title, 60).trim(),
        items: normMenu(c.items, 1),
      }));
    }
  }
  if (isObj(d.footer)) {
    const f = d.footer;
    out.footer = {
      motto: cleanText(f.motto, 200),
      powered: cleanText(f.powered, 200),
      copyright: cleanText(f.copyright, 200),
      certs: Array.isArray(f.certs) ? f.certs.map((c) => cleanText(c, 80).trim()).filter(Boolean).slice(0, 8) : [],
      showContact: bool(f.showContact, true),
      showSocial: bool(f.showSocial, true),
    };
    const logo = normImage(f.logo); if (logo) out.footer.logo = logo;
  }
  if (isObj(d.code)) { const code = normCode(d.code); if (code.snippets.length) out.code = code; }
  if (Array.isArray(d.banners)) {
    out.banners = d.banners.slice(0, 10).filter(isObj).map((b) => {
      const nb = {
        id: typeof b.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(b.id) ? b.id : `bn_${Math.random().toString(36).slice(2, 9)}`,
        enabled: bool(b.enabled, false),
        html: sanitizeHtml(b.html || "", { mode: "inline", maxLength: 1000 }),
        style: ["brand", "dark", "soft", "warning"].includes(b.style) ? b.style : "brand",
        dismissible: bool(b.dismissible, true),
        pages: Array.isArray(b.pages) ? b.pages.map((p) => String(p)).filter((p) => p === "*" || SLUG_RE.test(p) || p === "/").slice(0, 40) : ["*"],
      };
      const link = normButton(b.link); if (link && link.label) nb.link = link;
      for (const k of ["startAt", "endAt"]) if (b[k] && !Number.isNaN(Date.parse(b[k]))) nb[k] = new Date(b[k]).toISOString();
      return nb;
    });
  }
  if (isObj(d.settings)) {
    const s = d.settings;
    const set = {};
    if (isObj(s.company)) {
      set.company = {};
      for (const [k, max] of [["name", 120], ["legalName", 160], ["phone", 40], ["email", 200], ["address", 300], ["website", 200], ["hours", 200], ["tagline", 200]]) {
        if (typeof s.company[k] === "string") set.company[k] = cleanText(s.company[k], max).trim();
      }
      if (typeof s.company.whatsapp === "string") set.company.whatsapp = s.company.whatsapp.replace(/\D/g, "").slice(0, 15);
      if (set.company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(set.company.email)) delete set.company.email;
    }
    if (isObj(s.branding)) {
      set.branding = {};
      for (const k of ["logo", "logoWhite", "favicon", "ogImage"]) { const img = normImage(s.branding[k]); if (img) set.branding[k] = img; }
    }
    if (isObj(s.social)) {
      set.social = {};
      for (const k of ["linkedin", "facebook", "instagram", "x", "youtube"]) set.social[k] = socialUrl(s.social[k]);
    }
    if (isObj(s.analytics)) {
      set.analytics = {
        ga4: idLike(s.analytics.ga4, /^G-[A-Z0-9]{4,16}$/),
        gtm: idLike(s.analytics.gtm, /^GTM-[A-Z0-9]{4,12}$/),
        clarity: idLike(s.analytics.clarity, /^[a-z0-9]{6,16}$/),
        metaPixel: idLike(s.analytics.metaPixel, /^\d{8,20}$/),
        linkedinPartner: idLike(s.analytics.linkedinPartner, /^\d{4,12}$/),
        requireConsent: bool(s.analytics.requireConsent, true),
      };
    }
    if (isObj(s.verification)) {
      set.verification = {};
      for (const k of ["google", "bing", "yandex", "pinterest", "facebook"]) set.verification[k] = idLike(s.verification[k], /^[A-Za-z0-9_\-=.:]{4,120}$/);
    }
    if (isObj(s.cookies)) {
      set.cookies = {
        enabled: bool(s.cookies.enabled, false),
        html: sanitizeHtml(s.cookies.html || "", { mode: "inline", maxLength: 1200 }),
        acceptLabel: cleanText(s.cookies.acceptLabel, 40),
        rejectLabel: cleanText(s.cookies.rejectLabel, 40),
        policyUrl: safeUrl(s.cookies.policyUrl, urlOpts) || "/privacy-policy",
      };
    }
    out.settings = set;
  }
  return out;
}

// ------------------------------------------------------------------- seo
export const REDIRECT_TYPES = [301, 302, 307, 308, 410];
export function normRedirect(r) {
  if (!isObj(r)) return null;
  const from = String(r.from || "").trim();
  if (!/^\/[^\s?#<>"'`\\]*$/.test(from) || from.length > 300) return null;
  const type = REDIRECT_TYPES.includes(Number(r.type)) ? Number(r.type) : 301;
  const out = {
    id: typeof r.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(r.id) ? r.id : `rd_${Math.random().toString(36).slice(2, 10)}`,
    from: from.length > 1 ? from.replace(/\/+$/, "") || "/" : from,
    type,
    enabled: bool(r.enabled, true),
    note: cleanText(r.note, 200),
  };
  if (type !== 410) {
    const to = safeUrl(r.to, { allowRelative: true, allowMailto: false, allowTel: false, allowHash: false });
    if (!to) return { ...out, to: String(r.to || "").slice(0, 300), invalid: true };
    out.to = to;
  }
  return out;
}

export function normSeoDoc(data) {
  const d = isObj(data) ? data : {};
  const out = {};
  if (isObj(d.global)) {
    const g = d.global;
    out.global = {
      siteName: cleanText(g.siteName, 80).trim(),
      titleTemplate: cleanText(g.titleTemplate, 120).trim(),
      defaultDescription: cleanText(g.defaultDescription, 400).trim(),
      keywords: cleanText(g.keywords, 400).trim(),
      twitterHandle: idLike(g.twitterHandle, /^@?[A-Za-z0-9_]{1,15}$/),
      locale: idLike(g.locale, /^[a-z]{2}_[A-Z]{2}$/) || "en_IN",
      siteUrl: safeUrl(g.siteUrl, { allowRelative: false, allowMailto: false, allowTel: false, allowHash: false }) || "",
    };
    const img = normImage(g.defaultOgImage); if (img) out.global.defaultOgImage = img;
  }
  if (isObj(d.robots)) {
    out.robots = {
      mode: d.robots.mode === "custom" ? "custom" : "auto",
      custom: cleanText(d.robots.custom, 10000),
      disallow: Array.isArray(d.robots.disallow) ? d.robots.disallow.map((p) => String(p).trim()).filter((p) => /^\/[^\s]*$/.test(p)).slice(0, 50) : [],
      blockAiTraining: bool(d.robots.blockAiTraining, false),
      crawlDelay: int(d.robots.crawlDelay, 0, 60, 0),
    };
  }
  if (Array.isArray(d.redirects)) out.redirects = d.redirects.slice(0, 1000).map(normRedirect).filter(Boolean);
  if (isObj(d.sitemap)) {
    out.sitemap = {
      enabled: bool(d.sitemap.enabled, true),
      exclude: Array.isArray(d.sitemap.exclude) ? d.sitemap.exclude.map(String).filter((p) => /^\/[^\s]*$/.test(p)).slice(0, 100) : [],
      includeImages: bool(d.sitemap.includeImages, true),
    };
  }
  if (isObj(d.llms)) {
    out.llms = { enabled: bool(d.llms.enabled, true), mode: d.llms.mode === "custom" ? "custom" : "auto", custom: cleanText(d.llms.custom, 20000) };
  }
  if (isObj(d.indexNow)) {
    out.indexNow = { enabled: bool(d.indexNow.enabled, false), key: idLike(d.indexNow.key, /^[a-f0-9]{16,64}$/) };
  }
  if (isObj(d.schema)) {
    const s = d.schema;
    const org = isObj(s.organization) ? s.organization : {};
    out.schema = {
      organization: {
        enabled: bool(org.enabled, true),
        type: ["Organization", "Corporation", "LocalBusiness", "MedicalBusiness", "SoftwareCompany"].includes(org.type) ? org.type : "Organization",
        name: cleanText(org.name, 120).trim(),
        legalName: cleanText(org.legalName, 160).trim(),
        description: cleanText(org.description, 500).trim(),
        foundingDate: /^\d{4}(-\d{2}(-\d{2})?)?$/.test(String(org.foundingDate || "")) ? org.foundingDate : "",
        sameAs: Array.isArray(org.sameAs) ? org.sameAs.map(socialUrl).filter(Boolean).slice(0, 12) : [],
      },
      website: { enabled: bool(s.website?.enabled, true) },
      localBusiness: {
        enabled: bool(s.localBusiness?.enabled, false),
        streetAddress: cleanText(s.localBusiness?.streetAddress, 200),
        locality: cleanText(s.localBusiness?.locality, 80),
        region: cleanText(s.localBusiness?.region, 80),
        postalCode: cleanText(s.localBusiness?.postalCode, 20),
        country: cleanText(s.localBusiness?.country, 2) || "IN",
        latitude: Number.isFinite(Number(s.localBusiness?.latitude)) ? Number(s.localBusiness.latitude) : null,
        longitude: Number.isFinite(Number(s.localBusiness?.longitude)) ? Number(s.localBusiness.longitude) : null,
        openingHours: cleanText(s.localBusiness?.openingHours, 200),
      },
    };
  }
  return out;
}

/** Redirect rule analysis: duplicates, loops, chains, invalid targets. */
export function analyzeRedirects(redirects, { knownPaths = null } = {}) {
  const issues = [];
  const active = (redirects || []).filter((r) => r.enabled);
  const norm = (p) => { try { const u = new URL(p, "https://kibo360.in"); return u.host === "kibo360.in" || u.host === "www.kibo360.in" ? (u.pathname.replace(/\/+$/, "") || "/") : null; } catch { return null; } };
  const byFrom = new Map();
  for (const r of active) {
    const key = r.from.toLowerCase();
    if (byFrom.has(key)) issues.push({ id: r.id, level: "error", code: "duplicate", message: `Duplicate source ${r.from} (also rule ${byFrom.get(key).id})` });
    else byFrom.set(key, r);
    if (r.invalid) issues.push({ id: r.id, level: "error", code: "invalid-target", message: `Invalid destination "${r.to}"` });
    if (r.type !== 410 && r.to && norm(r.to) === r.from) issues.push({ id: r.id, level: "error", code: "self", message: `${r.from} redirects to itself` });
    if (knownPaths && r.type !== 410 && r.to) {
      const target = norm(r.to);
      if (target && !knownPaths.has(target) && !byFrom.has(target.toLowerCase())) {
        issues.push({ id: r.id, level: "warning", code: "unknown-target", message: `Destination ${target} is not a known page` });
      }
    }
    if (["/admin", "/api"].some((p) => r.from === p || r.from.startsWith(`${p}/`))) {
      issues.push({ id: r.id, level: "error", code: "reserved", message: `${r.from} is a reserved system path` });
    }
  }
  // loops & chains
  for (const r of active) {
    if (r.type === 410 || !r.to) continue;
    const seen = new Set([r.from.toLowerCase()]);
    let cur = norm(r.to);
    let hops = 1;
    while (cur) {
      const next = byFrom.get(cur.toLowerCase());
      if (!next || next.type === 410 || !next.to) break;
      if (seen.has(cur.toLowerCase())) { issues.push({ id: r.id, level: "error", code: "loop", message: `Redirect loop starting at ${r.from}` }); break; }
      seen.add(cur.toLowerCase());
      hops += 1;
      cur = norm(next.to);
      if (hops > 10) break;
    }
    if (hops > 1 && !issues.some((i) => i.id === r.id && i.code === "loop")) {
      issues.push({ id: r.id, level: "warning", code: "chain", message: `${r.from} goes through ${hops} redirects - point it straight at the final URL` });
    }
  }
  return issues;
}

// ----------------------------------------------------------------- forms
const FIELD_TYPES = ["text", "email", "tel", "textarea", "select", "radio", "checkbox", "date", "timeslots", "number", "url", "consent", "hidden"];
const MAP_TO = ["", "name", "email", "phone", "organization", "message", "product", "preferredDate", "preferredTime", "jobTitle", "city"];
export function normForms(data) {
  const d = isObj(data) ? data : {};
  const forms = Array.isArray(d.forms) ? d.forms : [];
  const seen = new Set();
  return {
    forms: forms.slice(0, 40).filter(isObj).map((f) => {
      const id = String(f.id || "").trim();
      if (!/^[a-z0-9-]{1,40}$/.test(id) || seen.has(id)) return null;
      seen.add(id);
      const fieldIds = new Set();
      const fields = (Array.isArray(f.fields) ? f.fields : []).slice(0, 40).filter(isObj).map((fl) => {
        const fid = String(fl.id || "").trim();
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(fid) || fieldIds.has(fid)) return null;
        fieldIds.add(fid);
        const type = FIELD_TYPES.includes(fl.type) ? fl.type : "text";
        const nf = {
          id: fid, type,
          label: cleanText(fl.label, 160).trim(),
          placeholder: cleanText(fl.placeholder, 160),
          help: cleanText(fl.help, 300),
          required: bool(fl.required, false),
          width: fl.width === "half" ? "half" : "full",
          mapTo: MAP_TO.includes(fl.mapTo) ? fl.mapTo : "",
        };
        if (["select", "radio", "checkbox", "timeslots"].includes(type)) {
          nf.options = (Array.isArray(fl.options) ? fl.options : []).map((o) => cleanText(o, 120).trim()).filter(Boolean).slice(0, 40);
        }
        if (type === "timeslots") { nf.min = int(fl.min, 0, 10, 2); nf.max = int(fl.max, 1, 10, 3); }
        if (["text", "textarea", "tel", "number"].includes(type)) {
          const mx = int(fl.maxLength, 1, 5000); if (mx) nf.maxLength = mx;
          if (["letters", "digits", "phone", ""].includes(fl.pattern || "")) nf.pattern = fl.pattern || "";
        }
        if (type === "hidden") nf.value = cleanText(fl.value, 200);
        if (type === "consent") nf.html = sanitizeHtml(fl.html || "", { mode: "inline", maxLength: 600 });
        return nf;
      }).filter(Boolean);
      return {
        id,
        name: cleanText(f.name, 80).trim() || id,
        type: ["contact", "demo", "callback", "partner", "newsletter", "custom"].includes(f.type) ? f.type : "custom",
        enabled: bool(f.enabled, true),
        fields,
        submitLabel: cleanText(f.submitLabel, 60).trim() || "Submit",
        success: {
          mode: f.success?.mode === "message" ? "message" : "redirect",
          redirect: safeUrl(f.success?.redirect, { allowRelative: true, allowMailto: false, allowTel: false, allowHash: false }) || "/thank-you",
          message: sanitizeHtml(f.success?.message || "", { mode: "inline", maxLength: 600 }),
        },
        notify: {
          team: bool(f.notify?.team, true),
          autoReply: bool(f.notify?.autoReply, true),
          extraEmails: Array.isArray(f.notify?.extraEmails) ? f.notify.extraEmails.map((e) => String(e).trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)).slice(0, 10) : [],
        },
        spam: { honeypot: bool(f.spam?.honeypot, true), minSeconds: int(f.spam?.minSeconds, 0, 60, 3) },
        leadStage: ["new", "contacted", "qualified"].includes(f.leadStage) ? f.leadStage : "new",
      };
    }).filter(Boolean),
  };
}

export function normalizeDoc(docId, data, opts = {}) {
  switch (docType(docId)) {
    case "page": return normPage(data, opts);
    case "site": return normSite(data);
    case "seo": return normSeoDoc(data);
    case "forms": return normForms(data);
    default: throw new ValidationError(`Unknown document ${docId}`);
  }
}

/** Top-level keys that a patch may set, per doc type. */
export const PATCHABLE = {
  page: ["fields", "lists", "layout", "seo", "meta"],
  site: ["header", "menus", "footer", "banners", "settings", "code"],
  seo: ["global", "robots", "redirects", "sitemap", "llms", "indexNow", "schema"],
  forms: ["forms"],
};
