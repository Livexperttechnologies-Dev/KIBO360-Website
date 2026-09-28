import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useCms } from "./content.jsx";
import { sanitizeHtml, cleanHref } from "./sanitize.js";

// ---------------------------------------------------------------------------
// Visual editor bridge. Loaded ONLY inside the Super Admin editor iframe
// (same origin, ?kibo_editor=1). The real page components render with draft
// content; this layer adds click-to-edit on top of them:
//   - headings / text: typed directly on the page (plain text)
//   - rich text: bold, italic, underline, links, lists (floating toolbar)
//   - buttons: label typed in place, link/action in the admin inspector
//   - images / icons / videos: selected, replaced from the admin panel
//   - sections and repeated items: move, duplicate, hide, delete
// Nothing is saved here - every change is posted to the admin window, which
// owns the draft, autosave, undo/redo and publishing.
// ---------------------------------------------------------------------------

const ORIGIN = window.location.origin;
const NBSP_RE = new RegExp(String.fromCharCode(160), "g");

function post(type, data) {
  try { window.parent.postMessage({ source: "kibo-editor", type, ...(data || {}) }, ORIGIN); } catch { /* admin window gone */ }
}

const KIND_LABEL = { text: "Text", rich: "Rich text", img: "Image", btn: "Button", icon: "Icon", video: "Video" };
const TAG_LABEL = { H1: "Heading 1", H2: "Heading 2", H3: "Heading 3", H4: "Heading 4", P: "Paragraph", SUMMARY: "Question", LI: "List item", FIGCAPTION: "Caption", BLOCKQUOTE: "Quote" };
const REGION_LABEL = { header: "Header & menu", footer: "Footer", banner: "Announcement bar", form: "Form" };

function labelFor(el) {
  const d = el.dataset;
  if (d.kiboKind === "text") return TAG_LABEL[el.tagName] || (el.closest("h1,h2,h3,h4") ? "Heading" : "Text");
  if (d.kiboKind === "rich") return d.kiboMode === "block" ? "Rich text" : TAG_LABEL[el.tagName] || "Text";
  if (d.kiboKind) return KIND_LABEL[d.kiboKind] || "Element";
  if (d.kiboItem) return "Item";
  if (d.kiboRegion) return REGION_LABEL[d.kiboRegion] || "Region";
  if (d.kiboSection) return d.kiboLabel || "Section";
  return "Element";
}

function parseValue(el) {
  try { return el?.dataset.kiboValue ? JSON.parse(el.dataset.kiboValue) : null; } catch { return null; }
}

/** Bounding box, including display:contents wrappers (sections). */
function rectOf(el) {
  if (!el || !el.isConnected) return null;
  if (getComputedStyle(el).display !== "contents") {
    const r = el.getBoundingClientRect();
    return r.width || r.height ? r : null;
  }
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  for (const c of el.children) {
    const r = rectOf(c);
    if (!r) continue;
    top = Math.min(top, r.top); left = Math.min(left, r.left);
    right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
  }
  return top === Infinity ? null : { top, left, right, bottom, width: right - left, height: bottom - top };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function textToHtml(txt, mode) {
  const t = String(txt || "").replace(/\r\n?/g, "\n");
  if (mode === "block") {
    return t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  }
  return esc(t.trim()).replace(/\n+/g, "<br>");
}

function sectionInfo(el) {
  const s = el?.closest("[data-kibo-section]");
  if (!s) return null;
  const d = s.dataset;
  return { docId: d.kiboDoc, id: d.kiboSection, base: d.kiboBase, label: d.kiboLabel, hidden: d.kiboHidden === "1", nodup: d.kiboNodup === "1", block: d.kiboBlock || null };
}
function itemInfo(el) {
  const it = el?.closest("[data-kibo-item]");
  if (!it) return null;
  const d = it.dataset;
  return { docId: d.kiboDoc, list: d.kiboList, id: d.kiboItem, base: d.kiboBase, hidden: d.kiboHidden === "1", dup: d.kiboItem !== d.kiboBase };
}
function sectionOrder(docId) {
  return [...document.querySelectorAll("[data-kibo-section]")].filter((s) => s.dataset.kiboDoc === docId).map((s) => s.dataset.kiboSection);
}
function itemOrder(docId, list) {
  const seen = new Set();
  for (const el of document.querySelectorAll("[data-kibo-item]")) {
    if (el.dataset.kiboDoc === docId && el.dataset.kiboList === list) seen.add(el.dataset.kiboItem);
  }
  return [...seen];
}

/** Everything the admin inspector needs to know about a clicked element. */
function describe(el) {
  if (!el) return null;
  const d = el.dataset;
  const link = el.closest("a[href]");
  const common = { label: labelFor(el), href: link ? link.getAttribute("href") : null, section: sectionInfo(el), item: itemInfo(el) };
  if (d.kiboKind) {
    let value = parseValue(el);
    if (d.kiboKind === "text") value = el.textContent;
    if (d.kiboKind === "rich") value = { t: "html", html: sanitizeHtml(el.innerHTML, { mode: d.kiboMode }) };
    return { ...common, kind: d.kiboKind, docId: d.kiboDoc, key: d.kiboK, mode: d.kiboMode || null, value };
  }
  if (d.kiboItem) return { ...common, kind: "item", docId: d.kiboDoc };
  if (d.kiboRegion) return { ...common, kind: "region", region: d.kiboRegion, formId: d.kiboForm || null };
  if (d.kiboSection) return { ...common, kind: "section", docId: d.kiboDoc };
  return null;
}
/** Find an element again after React re-rendered (the node may be new). */
function refind(desc) {
  if (!desc) return null;
  const q = (sel) => document.querySelector(sel);
  const a = (v) => CSS.escape(String(v));
  if (desc.key) return q(`[data-kibo-doc="${a(desc.docId)}"][data-kibo-k="${a(desc.key)}"]`);
  if (desc.kind === "item") return q(`[data-kibo-doc="${a(desc.item.docId)}"][data-kibo-list="${a(desc.item.list)}"][data-kibo-item="${a(desc.item.id)}"]`);
  if (desc.kind === "section") return q(`[data-kibo-section="${a(desc.section.id)}"]`);
  if (desc.kind === "region") return q(`[data-kibo-region="${a(desc.region)}"]`);
  return null;
}

// ------------------------------------------------------------------ icons
const P = {
  up: "M12 19V5M5 12l7-7 7 7",
  down: "M12 5v14M5 12l7 7 7-7",
  copy: "M8 8h12v12H8zM4 16V4h12",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  trash: "M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13",
  plus: "M12 5v14M5 12h14",
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M13 4v4M7 10v4M15 16v4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  unlink: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  olist: "M10 6h10M10 12h10M10 18h10M4 5l1.5-1V9M3.8 14.2a1.4 1.4 0 0 1 2.4 1c0 .9-2.4 2.3-2.4 2.8h2.6",
  image: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15.5 9.5h.01",
};
const Svg = ({ d, size = 15 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const keep = (e) => e.preventDefault(); // toolbar clicks must not steal the caret

// ------------------------------------------------------------------ styles
const PAGE_CSS = `
html.kibo-editing [data-kibo-kind]{cursor:text}
html.kibo-editing [data-kibo-kind="img"],html.kibo-editing [data-kibo-kind="btn"],html.kibo-editing [data-kibo-kind="icon"],html.kibo-editing [data-kibo-kind="video"]{cursor:pointer}
html.kibo-editing [data-kibo-kind="btn"] [contenteditable]{cursor:text}
html.kibo-editing [contenteditable]{outline:none;caret-color:#e03e8f}
html.kibo-editing a,html.kibo-editing img{-webkit-user-drag:none;user-drag:none}
html.kibo-editing [data-kibo-item][data-kibo-hidden="1"]{opacity:.38;filter:grayscale(.7)}
html.kibo-editing [data-kibo-kind="text"]:empty,html.kibo-editing [data-kibo-kind="rich"]:empty{display:inline-block;min-width:4ch;min-height:1em}
html.kibo-editing [data-kibo-kind]:empty:not(:focus)::before{content:"Empty - click to type";opacity:.45;font-style:italic;font-weight:400}
html.kibo-editing .kibo-hidden-section{max-width:1100px;margin:14px auto;padding:16px 20px;border:2px dashed #b9a7ff;border-radius:14px;color:#5b4b91;background:repeating-linear-gradient(135deg,#f7f4ff 0 12px,#fff 12px 24px);font:600 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
html.kibo-editing .orbit-rotator,html.kibo-editing .orbit-chip,html.kibo-editing .orbit-ring,html.kibo-editing .orbit-center,html.kibo-editing .mini-dash,html.kibo-editing .core-ring,html.kibo-editing .tab-panel,html.kibo-editing .meter-fill{animation:none!important}
html.kibo-editing .orbit-chip{opacity:1;scale:1}
html.kibo-editing .marquee{-webkit-mask-image:none;mask-image:none;padding-left:4%;padding-right:4%}
html.kibo-editing .marquee-track{animation:none;width:auto;flex-wrap:wrap;justify-content:center;gap:10px}
html.kibo-editing .marquee-track .chip{margin-right:0}
html.kibo-editing .fade-section{opacity:1;transform:none}
#kibo-editor-ui{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font:500 12px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1c1233}
#kibo-editor-ui *{box-sizing:border-box}
.ke-box{position:fixed;border:1.5px dashed rgba(108,34,214,.75);border-radius:4px;pointer-events:none}
.ke-box.sec{border:1.5px solid rgba(108,34,214,.35);border-radius:0}
.ke-box.sel{border:2px solid #6c22d6;box-shadow:0 0 0 4px rgba(108,34,214,.14)}
.ke-box.edit{border:2px solid #e03e8f;box-shadow:0 0 0 4px rgba(224,62,143,.14)}
.ke-box.drop{border:3px dashed #16a34a;background:rgba(22,163,74,.1)}
.ke-box.flash{border:3px solid #6c22d6;background:rgba(108,34,214,.08);animation:keFlash 1.6s ease-out forwards}
@keyframes keFlash{to{opacity:0}}
.ke-tag{position:fixed;background:#6c22d6;color:#fff;padding:3px 7px;border-radius:5px 5px 0 0;font-size:11px;font-weight:600;pointer-events:none;white-space:nowrap;transform:translateY(-100%)}
.ke-bar{position:fixed;display:flex;gap:2px;background:#1c1233;color:#fff;border-radius:9px;padding:3px;box-shadow:0 8px 24px rgba(20,8,50,.28);pointer-events:auto;align-items:center;white-space:nowrap}
.ke-bar button{all:unset;box-sizing:border-box;min-width:27px;height:27px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;color:#fff;font-size:12px;font-weight:600;gap:5px}
.ke-bar button:hover{background:rgba(255,255,255,.16)}
.ke-bar button.on{background:#6c22d6}
.ke-bar button:disabled{opacity:.3;cursor:default;background:none}
.ke-bar .ke-name{padding:0 8px 0 6px;font-weight:600;opacity:.9;max-width:190px;overflow:hidden;text-overflow:ellipsis}
.ke-bar.item{background:#3b2a6b}
.ke-sep{width:1px;height:18px;background:rgba(255,255,255,.22);margin:0 3px}
.ke-pop{position:fixed;background:#fff;color:#1c1233;border-radius:12px;box-shadow:0 14px 40px rgba(20,8,50,.28);padding:12px;width:320px;pointer-events:auto;border:1px solid #e6def7}
.ke-pop label{display:flex;align-items:center;gap:7px;margin-top:8px;font-size:12.5px;font-weight:500}
.ke-pop input[type=text]{width:100%;border:1px solid #d6cdea;border-radius:7px;padding:8px 9px;font:inherit;font-size:13px;color:inherit;background:#fff}
.ke-pop input[type=text]:focus{outline:2px solid #6c22d6;outline-offset:0;border-color:#6c22d6}
.ke-pop .ke-err{color:#c0262d;font-size:12px;margin-top:6px}
.ke-pop .ke-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
.ke-pop button{border:0;border-radius:7px;padding:7px 12px;font:inherit;font-weight:600;cursor:pointer;background:#f1ecfb;color:#3b2a6b}
.ke-pop button.pri{background:#6c22d6;color:#fff}
.ke-pop button.dan{background:none;color:#c0262d;margin-right:auto}
.ke-pop .ke-title{font-weight:700;font-size:13px;margin-bottom:8px}
`;

export default function EditorBridge() {
  const { setDocs, docs } = useCms();
  const location = useLocation();
  const navigate = useNavigate();
  const [host] = useState(() => { const d = document.createElement("div"); d.id = "kibo-editor-ui"; return d; });
  const [readonly, setReadonly] = useState(false);
  const [hover, setHover] = useState(null);
  const [hoverSec, setHoverSec] = useState(null);
  const [hoverItem, setHoverItem] = useState(null);
  const [selDesc, setSelDesc] = useState(null);
  const [editing, setEditing] = useState(null);
  const [linkBox, setLinkBox] = useState(null);
  const [fmt, setFmt] = useState({});
  const [dropEl, setDropEl] = useState(null);
  const [flash, setFlash] = useState(null);
  const [, setTick] = useState(0);

  const ro = useRef(false);
  const edRef = useRef(null);      // current inline edit session
  const rangeRef = useRef(null);   // saved selection while the link box has focus
  const selElRef = useRef(null);
  const navRef = useRef(navigate);
  const pathRef = useRef(location.pathname);
  navRef.current = navigate;
  pathRef.current = location.pathname;
  const pagesRef = useRef([]);

  // ------------------------------------------------------------ setup
  useLayoutEffect(() => {
    document.body.appendChild(host);
    const style = document.createElement("style");
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
    document.documentElement.classList.add("kibo-editing");
    return () => { host.remove(); style.remove(); document.documentElement.classList.remove("kibo-editing"); };
  }, [host]);

  const rerender = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(rerender); };
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    const ro2 = new ResizeObserver(on);
    ro2.observe(document.body);
    return () => { window.removeEventListener("scroll", on, true); window.removeEventListener("resize", on); ro2.disconnect(); cancelAnimationFrame(raf); };
  }, [rerender]);

  // ------------------------------------------------------ edit sessions
  const valueOf = (ed) => {
    if (ed.kind === "rich") return { t: "html", html: sanitizeHtml(ed.el.innerHTML, { mode: ed.mode }) };
    const text = ed.el.textContent.replace(NBSP_RE, " ").replace(/[\r\n]+/g, " ");
    if (ed.kind === "btn") return { ...(parseValue(ed.btn) || { t: "btn", action: "none" }), t: "btn", label: text.trim() };
    return text;
  };
  const flush = useCallback((ed = edRef.current) => {
    if (!ed) return;
    clearTimeout(ed.timer);
    const value = valueOf(ed);
    const repr = JSON.stringify(value);
    if (repr === ed.sent) return;
    ed.sent = repr;
    post("change", { docId: ed.docId, key: ed.key, value, label: ed.label });
  }, []);

  const stopEditing = useCallback((commit = true) => {
    const ed = edRef.current;
    if (!ed) return;
    if (commit) flush(ed);
    clearTimeout(ed.timer);
    ed.el.removeAttribute("contenteditable");
    if (ed.kind === "rich") {
      const clean = sanitizeHtml(ed.el.innerHTML, { mode: ed.mode });
      if (ed.el.innerHTML !== clean) ed.el.innerHTML = clean;
    }
    edRef.current = null;
    rangeRef.current = null;
    setEditing(null);
    setLinkBox(null);
  }, [flush]);

  const beginEdit = useCallback((el, btn = null) => {
    if (ro.current || !el) return;
    if (edRef.current?.el === el) return;
    stopEditing(true);
    const src = btn || el;
    const kind = btn ? "btn" : el.dataset.kiboKind;
    const mode = el.dataset.kiboMode || "inline";
    if (kind === "rich") el.contentEditable = "true";
    else {
      try { el.contentEditable = "plaintext-only"; } catch { el.contentEditable = "true"; }
      if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
    }
    el.spellcheck = true;
    const ed = { el, btn, kind, mode, docId: src.dataset.kiboDoc, key: src.dataset.kiboK, label: labelFor(src), timer: null, start: kind === "rich" ? el.innerHTML : el.textContent };
    ed.sent = JSON.stringify(valueOf(ed));
    edRef.current = ed;
    if (kind === "rich") { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* old browser */ } }
    setEditing(el);
  }, [stopEditing]);

  const select = useCallback((el) => {
    const desc = describe(el);
    selElRef.current = el;
    setSelDesc(desc);
    post("select", { sel: desc });
  }, []);

  // ----------------------------------------------------------- messages
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== ORIGIN || e.source !== window.parent) return;
      const m = e.data;
      if (!m || m.source !== "kibo-admin") return;
      switch (m.type) {
        case "docs": setDocs(m.docs || {}); break;
        case "patch-docs": setDocs((d) => ({ ...d, ...(m.docs || {}) })); break;
        case "config":
          ro.current = !!m.readonly;
          setReadonly(!!m.readonly);
          pagesRef.current = Array.isArray(m.pages) ? m.pages : [];
          if (m.readonly) { stopEditing(true); setSelDesc(null); }
          break;
        case "navigate":
          // keep ?kibo_editor=1 so a reload of the frame stays in edit mode
          if (typeof m.path === "string" && m.path.startsWith("/") && m.path !== pathRef.current) navRef.current({ pathname: m.path, search: "?kibo_editor=1" });
          break;
        case "deselect": stopEditing(true); selElRef.current = null; setSelDesc(null); break;
        case "flush": flush(); post("flushed", { id: m.id }); break;
        case "scroll-to": {
          let tries = 0;
          const find = () => {
            const el = m.item
              ? document.querySelector(`[data-kibo-list="${CSS.escape(m.item.list)}"][data-kibo-item="${CSS.escape(m.item.id)}"]`)
              : m.key ? document.querySelector(`[data-kibo-k="${CSS.escape(m.key)}"]`) : document.querySelector(`[data-kibo-section="${CSS.escape(m.section || "")}"]`);
            const r = rectOf(el);
            if (!r) { if (tries++ < 20) setTimeout(find, 60); return; }
            window.scrollTo({ top: Math.max(0, r.top + window.scrollY - 90), behavior: m.instant ? "auto" : "smooth" });
            setFlash({ el, at: Date.now() });
            if (m.select) setTimeout(() => select(el), 50);
          };
          find();
          break;
        }
        default: break;
      }
    };
    window.addEventListener("message", onMsg);
    post("ready", { path: window.location.pathname });
    return () => window.removeEventListener("message", onMsg);
  }, [setDocs, stopEditing, flush, select]);

  // Route changes: tell the admin, drop the selection.
  useEffect(() => {
    stopEditing(true);
    selElRef.current = null;
    setSelDesc(null);
    post("route", { path: location.pathname });
  }, [location.pathname, stopEditing]);

  // Page structure (sections in their current order) for the admin panel.
  const lastStructure = useRef("");
  useEffect(() => {
    const send = () => {
      const secs = [...document.querySelectorAll("[data-kibo-section]")];
      const pageDocId = secs[0]?.dataset.kiboDoc || document.querySelector('[data-kibo-doc^="page:"]')?.dataset.kiboDoc || null;
      const s = {
        path: location.pathname,
        pageDocId,
        title: document.title,
        sections: secs.filter((x) => !pageDocId || x.dataset.kiboDoc === pageDocId).map((x) => ({
          id: x.dataset.kiboSection, base: x.dataset.kiboBase, label: x.dataset.kiboLabel,
          hidden: x.dataset.kiboHidden === "1", nodup: x.dataset.kiboNodup === "1", block: x.dataset.kiboBlock || null,
        })),
      };
      const json = JSON.stringify(s);
      if (json !== lastStructure.current) { lastStructure.current = json; post("structure", s); }
    };
    const raf = requestAnimationFrame(send);
    const t = setTimeout(send, 400);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [docs, location.pathname]);

  // --------------------------------------------------------- DOM events
  useEffect(() => {
    const inUi = (t) => host.contains(t);

    const onOver = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || inUi(t) || ro.current) return;
      setHover(t.closest("[data-kibo-kind]") || t.closest("[data-kibo-item]") || t.closest("[data-kibo-region]"));
      setHoverSec(t.closest("[data-kibo-section]"));
      setHoverItem(t.closest("[data-kibo-item]"));
    };

    const onDown = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || inUi(t) || ro.current || e.button !== 0) return;
      const ed = t.closest("[data-kibo-kind]");
      if (!ed) { if (edRef.current && !edRef.current.el.contains(t)) stopEditing(true); return; }
      const kind = ed.dataset.kiboKind;
      if (kind === "text" || kind === "rich") beginEdit(ed);
      else if (kind === "btn") {
        const label = ed.querySelector("[data-kibo-label]");
        if (label) beginEdit(label, ed);
      } else stopEditing(true);
    };

    const onClick = (e) => {
      const t = e.target;
      if (!(t instanceof Element) || inUi(t)) return;
      const link = t.closest("a[href]");
      const ed = t.closest("[data-kibo-kind]");
      const inForm = t.closest("form, label");
      if (ro.current) { e.preventDefault(); e.stopPropagation(); return; }
      // Never navigate, submit or open pop-ups from inside the editor.
      if (link || inForm || t.closest("summary")) e.preventDefault();
      if (link || inForm || ed?.dataset.kiboKind === "btn") e.stopPropagation();
      if (ed) { select(ed); return; }
      const next = t.closest("[data-kibo-item]") || t.closest("[data-kibo-region]") || t.closest("[data-kibo-section]");
      select(next || null);
      if (!next) stopEditing(true);
    };

    const onKey = (e) => {
      if (e.target instanceof Node && inUi(e.target)) return; // link box etc. handle their own keys
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "s") { e.preventDefault(); flush(); post("key", { action: "save" }); return; }
      const ed = edRef.current;
      if (ed && ed.el.contains(e.target)) {
        if (e.key === "Escape") {
          e.preventDefault();
          if (ed.kind === "rich") ed.el.innerHTML = ed.start; else ed.el.textContent = ed.start;
          stopEditing(true);
          ed.el.blur();
          return;
        }
        if (e.key === "Enter") {
          if (ed.kind !== "rich") { e.preventDefault(); stopEditing(true); ed.el.blur(); return; }
          if (ed.mode === "inline" || e.shiftKey) {
            e.preventDefault();
            if (!document.execCommand("insertLineBreak")) document.execCommand("insertHTML", false, "<br>");
          }
        }
        if (ed.kind !== "rich" && mod && ["b", "i", "u"].includes(k)) e.preventDefault();
        if (ed.kind === "rich" && mod && k === "k") { e.preventDefault(); openLinkRef.current(); }
        if (ed.kind === "btn" && e.key === " ") { e.preventDefault(); document.execCommand("insertText", false, " "); }
        e.stopPropagation(); // keep page shortcuts (tabs, carousels) out of typing
        return;
      }
      if (mod && k === "z") { e.preventDefault(); post("key", { action: e.shiftKey ? "redo" : "undo" }); return; }
      if (mod && k === "y") { e.preventDefault(); post("key", { action: "redo" }); return; }
      if (e.key === "Escape") { selElRef.current = null; setSelDesc(null); post("select", { sel: null }); }
    };

    const onInput = (e) => {
      const ed = edRef.current;
      if (!ed || !ed.el.contains(e.target)) return;
      clearTimeout(ed.timer);
      ed.timer = setTimeout(() => flush(ed), 350);
    };

    const onFocusOut = (e) => {
      const ed = edRef.current;
      if (!ed || e.target !== ed.el) return;
      if (e.relatedTarget && inUi(e.relatedTarget)) return; // moved into our link box
      stopEditing(true);
    };

    const onPaste = (e) => {
      const ed = edRef.current;
      if (!ed || !ed.el.contains(e.target)) return;
      e.preventDefault();
      const cd = e.clipboardData;
      if (ed.kind !== "rich") {
        document.execCommand("insertText", false, (cd.getData("text/plain") || "").replace(/\s+/g, " "));
        return;
      }
      const html = cd.getData("text/html");
      const clean = html ? sanitizeHtml(html, { mode: ed.mode }) : textToHtml(cd.getData("text/plain"), ed.mode);
      if (clean) document.execCommand("insertHTML", false, clean);
    };

    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
    const onDragOver = (e) => {
      if (!hasFiles(e)) { if (edRef.current) e.preventDefault(); return; }
      e.preventDefault();
      const img = ro.current ? null : e.target.closest?.('[data-kibo-kind="img"]');
      e.dataTransfer.dropEffect = img ? "copy" : "none";
      setDropEl(img || null);
    };
    const onDragLeave = (e) => { if (!e.relatedTarget) setDropEl(null); };
    const onDrop = (e) => {
      e.preventDefault();
      setDropEl(null);
      const img = ro.current ? null : e.target.closest?.('[data-kibo-kind="img"]');
      const file = e.dataTransfer?.files?.[0];
      if (!img || !file) return;
      if (!/^image\//.test(file.type)) { post("toast", { message: "Drop an image file (JPG, PNG, WebP, SVG…)" }); return; }
      select(img);
      post("drop-file", { docId: img.dataset.kiboDoc, key: img.dataset.kiboK, value: parseValue(img), file });
    };

    const onToggle = (e) => {
      // FAQ answers stay open in the editor so they can be edited.
      if (e.target instanceof HTMLDetailsElement && !e.target.open && e.target.closest("[data-kibo-item]")) e.target.open = true;
    };

    const onSelChange = () => {
      const ed = edRef.current;
      if (!ed || ed.kind !== "rich") return;
      const sel = window.getSelection();
      if (!sel?.rangeCount || !ed.el.contains(sel.anchorNode)) return;
      const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
      const a = node?.closest?.("a");
      let block = "";
      try { block = String(document.queryCommandValue("formatBlock") || "").toLowerCase(); } catch { /* ignore */ }
      setFmt({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
        link: !!(a && ed.el.contains(a)),
        block,
      });
    };

    const opts = true;
    document.addEventListener("mouseover", onOver, opts);
    document.addEventListener("mousedown", onDown, opts);
    document.addEventListener("click", onClick, opts);
    document.addEventListener("keydown", onKey, opts);
    document.addEventListener("input", onInput, opts);
    document.addEventListener("focusout", onFocusOut, opts);
    document.addEventListener("paste", onPaste, opts);
    document.addEventListener("dragover", onDragOver, opts);
    document.addEventListener("dragleave", onDragLeave, opts);
    document.addEventListener("drop", onDrop, opts);
    document.addEventListener("toggle", onToggle, opts);
    document.addEventListener("selectionchange", onSelChange);
    // Keep typing when the admin window closes / the frame is torn down.
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("mouseover", onOver, opts);
      document.removeEventListener("mousedown", onDown, opts);
      document.removeEventListener("click", onClick, opts);
      document.removeEventListener("keydown", onKey, opts);
      document.removeEventListener("input", onInput, opts);
      document.removeEventListener("focusout", onFocusOut, opts);
      document.removeEventListener("paste", onPaste, opts);
      document.removeEventListener("dragover", onDragOver, opts);
      document.removeEventListener("dragleave", onDragLeave, opts);
      document.removeEventListener("drop", onDrop, opts);
      document.removeEventListener("toggle", onToggle, opts);
      document.removeEventListener("selectionchange", onSelChange);
      window.removeEventListener("pagehide", onHide);
    };
  }, [host, beginEdit, stopEditing, flush, select]);

  // ------------------------------------------------------ rich toolbar
  const afterExec = () => {
    const ed = edRef.current;
    if (!ed) return;
    clearTimeout(ed.timer);
    ed.timer = setTimeout(() => flush(ed), 200);
    document.dispatchEvent(new Event("selectionchange"));
  };
  const exec = (cmd, arg) => { document.execCommand(cmd, false, arg); afterExec(); };
  const block = (tag) => {
    const cur = fmt.block;
    exec("formatBlock", cur === tag ? "<p>" : `<${tag}>`);
  };

  const anchorAtSelection = () => {
    const ed = edRef.current;
    const sel = window.getSelection();
    if (!ed || !sel?.rangeCount) return null;
    const n = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
    const a = n?.closest?.("a");
    return a && ed.el.contains(a) ? a : null;
  };
  const openLink = () => {
    const ed = edRef.current;
    const sel = window.getSelection();
    if (!ed || ed.kind !== "rich" || !sel?.rangeCount || !ed.el.contains(sel.anchorNode)) return;
    rangeRef.current = sel.getRangeAt(0).cloneRange();
    const a = anchorAtSelection();
    setLinkBox({
      href: a ? a.getAttribute("href") || "" : "",
      newTab: a ? a.getAttribute("target") === "_blank" : false,
      nofollow: a ? /\bnofollow\b/.test(a.getAttribute("rel") || "") : false,
      existing: !!a,
      error: "",
    });
  };
  const openLinkRef = useRef(openLink);
  openLinkRef.current = openLink;

  const restoreRange = () => {
    const ed = edRef.current;
    if (!ed) return false;
    ed.el.focus();
    const r = rangeRef.current;
    if (!r) return true;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    return true;
  };
  const applyLink = (box) => {
    const ed = edRef.current;
    if (!ed) return;
    let raw = box.href.trim();
    if (/^www\./i.test(raw)) raw = `https://${raw}`;
    if (/^[^\s/@:]+@[^\s/@]+\.[^\s/@]+$/.test(raw)) raw = `mailto:${raw}`;
    const href = cleanHref(raw);
    if (!href) { setLinkBox({ ...box, error: "Use a page path like /contact, a full https:// address, mailto: or tel:" }); return; }
    restoreRange();
    const SENTINEL = "https://kibo-link.invalid/pending";
    const existing = anchorAtSelection();
    const sel = window.getSelection();
    if (existing) {
      existing.setAttribute("href", SENTINEL);
    } else if (sel.isCollapsed) {
      document.execCommand("insertHTML", false, `<a href="${SENTINEL}">${esc(box.href.trim())}</a>`);
    } else {
      document.execCommand("createLink", false, SENTINEL);
    }
    for (const a of ed.el.querySelectorAll(`a[href="${SENTINEL}"]`)) {
      a.setAttribute("href", href);
      const rel = [];
      if (box.newTab) { a.setAttribute("target", "_blank"); rel.push("noopener", "noreferrer"); } else a.removeAttribute("target");
      if (box.nofollow) rel.push("nofollow");
      if (rel.length) a.setAttribute("rel", rel.join(" ")); else a.removeAttribute("rel");
    }
    rangeRef.current = null;
    setLinkBox(null);
    afterExec();
  };
  const removeLink = () => {
    restoreRange();
    const a = anchorAtSelection();
    const sel = window.getSelection();
    if (a && sel.isCollapsed) {
      const r = document.createRange();
      r.selectNodeContents(a);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    document.execCommand("unlink");
    rangeRef.current = null;
    setLinkBox(null);
    afterExec();
  };

  // ------------------------------------------------- section / item ops
  const secAction = (action, s) => {
    stopEditing(true);
    post("section", { action, docId: s.docId, id: s.id, base: s.base, block: s.block, order: sectionOrder(s.docId) });
  };
  const itemAction = (action, it) => {
    stopEditing(true);
    post("item", { action, docId: it.docId, list: it.list, id: it.id, base: it.base, order: itemOrder(it.docId, it.list) });
  };

  // ------------------------------------------------------------ render
  let selEl = selElRef.current;
  if (selDesc && (!selEl || !selEl.isConnected)) { selEl = refind(selDesc); selElRef.current = selEl; }
  const vw = window.innerWidth;
  const clampX = (x, w) => Math.max(6, Math.min(vw - w - 6, x));
  const box = (el, cls, key) => {
    const r = rectOf(el);
    if (!r) return null;
    return <div key={key} className={`ke-box ${cls}`} style={{ top: r.top - 3, left: r.left - 3, width: r.width + 6, height: r.height + 6 }} />;
  };

  const out = [];
  if (!readonly) {
    // hover / selection outlines
    if (hoverSec && hoverSec !== selEl) out.push(box(hoverSec, "sec", "hs"));
    if (hover && hover !== selEl && hover !== editing && hover !== editing?.closest?.("[data-kibo-kind]")) {
      const r = rectOf(hover);
      if (r) {
        out.push(box(hover, "", "h"));
        out.push(<div key="ht" className="ke-tag" style={{ top: r.top - 3, left: clampX(r.left - 3, 120) }}>{labelFor(hover)}</div>);
      }
    }
    if (selEl && selEl !== editing) out.push(box(selEl, "sel", "s"));
    if (editing) out.push(box(editing.closest("[data-kibo-kind]") || editing, "edit", "e"));
    if (dropEl) out.push(box(dropEl, "drop", "d"));
    if (flash?.el) out.push(<FlashBox key={`f${flash.at}`} el={flash.el} />);

    // section toolbar
    const secEl = hoverSec || (selDesc?.kind === "section" ? selEl : null);
    const sec = secEl ? sectionInfo(secEl) : null;
    const sr = sec ? rectOf(secEl) : null;
    if (sec && sr && sr.bottom > 40) {
      const top = Math.max(8, Math.min(sr.top + 8, sr.bottom - 40));
      const canDelete = sec.block || sec.id !== sec.base;
      out.push(
        <div key="sb" className="ke-bar" style={{ top, right: Math.max(8, vw - sr.right + 8) }} onMouseDown={keep}>
          <span className="ke-name" title={sec.label}>{sec.label}{sec.hidden ? " (hidden)" : ""}</span>
          <button type="button" title="Move section up" onClick={() => secAction("up", sec)}><Svg d={P.up} /></button>
          <button type="button" title="Move section down" onClick={() => secAction("down", sec)}><Svg d={P.down} /></button>
          {!sec.nodup && <button type="button" title="Duplicate section" onClick={() => secAction("duplicate", sec)}><Svg d={P.copy} /></button>}
          <button type="button" title={sec.hidden ? "Show section" : "Hide section"} onClick={() => secAction(sec.hidden ? "show" : "hide", sec)}><Svg d={sec.hidden ? P.eye : P.eyeOff} /></button>
          {canDelete && <button type="button" title="Delete section" onClick={() => secAction("remove", sec)}><Svg d={P.trash} /></button>}
          <button type="button" title="Section settings" onClick={() => select(secEl)}><Svg d={P.sliders} /></button>
          <span className="ke-sep" />
          <button type="button" title="Add a section below" onClick={() => secAction("add", sec)}><Svg d={P.plus} /> Add</button>
        </div>
      );
    }

    // item toolbar
    const it = hoverItem ? itemInfo(hoverItem) : null;
    const ir = it ? rectOf(hoverItem) : null;
    if (it && ir && !(editing && hoverItem.contains(editing) && ir.height < 60)) {
      const w = it.dup ? 150 : 124;
      const top = ir.top > 34 ? ir.top - 32 : ir.top + 4;
      out.push(
        <div key="ib" className="ke-bar item" style={{ top, left: clampX(ir.right - w, w) }} onMouseDown={keep}>
          <button type="button" title="Move item earlier" onClick={() => itemAction("up", it)}><Svg d={P.up} size={13} /></button>
          <button type="button" title="Move item later" onClick={() => itemAction("down", it)}><Svg d={P.down} size={13} /></button>
          <button type="button" title="Duplicate item" onClick={() => itemAction("duplicate", it)}><Svg d={P.copy} size={13} /></button>
          <button type="button" title={it.hidden ? "Show item" : "Hide item"} onClick={() => itemAction(it.hidden ? "show" : "hide", it)}><Svg d={it.hidden ? P.eye : P.eyeOff} size={13} /></button>
          {it.dup && <button type="button" title="Delete this copy" onClick={() => itemAction("remove", it)}><Svg d={P.trash} size={13} /></button>}
        </div>
      );
    }

    // rich-text toolbar
    const ed = edRef.current;
    if (editing && ed?.kind === "rich") {
      const r = rectOf(editing);
      if (r) {
        const blockMode = ed.mode === "block";
        const w = blockMode ? 430 : 230;
        const top = r.top > 50 ? r.top - 44 : Math.min(window.innerHeight - 44, r.bottom + 8);
        const left = clampX(r.left, w);
        out.push(
          <div key="rt" className="ke-bar" style={{ top, left }} onMouseDown={keep}>
            <button type="button" className={fmt.bold ? "on" : ""} title="Bold (Ctrl+B)" onClick={() => exec("bold")}><b>B</b></button>
            <button type="button" className={fmt.italic ? "on" : ""} title="Italic (Ctrl+I)" onClick={() => exec("italic")}><i style={{ fontFamily: "Georgia, serif" }}>I</i></button>
            <button type="button" className={fmt.underline ? "on" : ""} title="Underline (Ctrl+U)" onClick={() => exec("underline")}><u>U</u></button>
            <span className="ke-sep" />
            <button type="button" className={fmt.link ? "on" : ""} title="Add / edit link (Ctrl+K)" onClick={openLink}><Svg d={P.link} /></button>
            <button type="button" title="Remove link" disabled={!fmt.link} onClick={removeLink}><Svg d={P.unlink} /></button>
            {blockMode && (
              <>
                <span className="ke-sep" />
                <button type="button" className={fmt.block === "h2" ? "on" : ""} title="Heading" onClick={() => block("h2")}>H2</button>
                <button type="button" className={fmt.block === "h3" ? "on" : ""} title="Sub-heading" onClick={() => block("h3")}>H3</button>
                <button type="button" className={fmt.block === "p" ? "on" : ""} title="Paragraph" onClick={() => exec("formatBlock", "<p>")}>¶</button>
                <button type="button" className={fmt.ul ? "on" : ""} title="Bullet list" onClick={() => exec("insertUnorderedList")}><Svg d={P.list} /></button>
                <button type="button" className={fmt.ol ? "on" : ""} title="Numbered list" onClick={() => exec("insertOrderedList")}><Svg d={P.olist} /></button>
                <button type="button" className={fmt.block === "blockquote" ? "on" : ""} title="Quote" onClick={() => block("blockquote")}>“</button>
              </>
            )}
            <span className="ke-sep" />
            <button type="button" title="Clear formatting" onClick={() => { exec("removeFormat"); if (blockMode) exec("formatBlock", "<p>"); }}>T<span style={{ fontSize: 9, marginLeft: -3 }}>x</span></button>
          </div>
        );
        if (linkBox) {
          const lt = top + 36 + 190 > window.innerHeight ? Math.max(6, top - 196) : top + 36;
          out.push(<LinkBox key="lb" top={lt} left={clampX(r.left, 320)} box={linkBox} pages={pagesRef.current} onChange={setLinkBox} onApply={applyLink} onRemove={removeLink} onClose={() => { setLinkBox(null); restoreRange(); }} />);
        }
      }
    }
  }

  return createPortal(out, host);
}

function FlashBox({ el }) {
  const r = rectOf(el);
  if (!r) return null;
  return <div className="ke-box flash" style={{ top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 }} />;
}

function LinkBox({ top, left, box, pages, onChange, onApply, onRemove, onClose }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  const set = (patch) => onChange({ ...box, ...patch, error: "" });
  return (
    <div className="ke-pop" style={{ top, left }} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
      <div className="ke-title">{box.existing ? "Edit link" : "Add link"}</div>
      <input
        ref={inputRef}
        type="text"
        list="kibo-link-pages"
        placeholder="/contact  or  https://example.com"
        value={box.href}
        onChange={(e) => set({ href: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onApply(box); } }}
        aria-label="Link address"
      />
      <datalist id="kibo-link-pages">
        {pages.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
      </datalist>
      {box.error && <div className="ke-err" role="alert">{box.error}</div>}
      <label><input type="checkbox" checked={box.newTab} onChange={(e) => set({ newTab: e.target.checked })} /> Open in a new tab</label>
      <label><input type="checkbox" checked={box.nofollow} onChange={(e) => set({ nofollow: e.target.checked })} /> nofollow (don't pass SEO value)</label>
      <div className="ke-row">
        {box.existing && <button type="button" className="dan" onClick={onRemove}>Remove link</button>}
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" className="pri" onClick={() => onApply(box)}>Apply</button>
      </div>
    </div>
  );
}
