import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useCms, useField, useScope, useListItems, joinKey, Scope, useSite } from "./content.jsx";
import { sanitizeHtml } from "./sanitize.js";
import { useDemoModal } from "../components/DemoModalContext.jsx";
import Icon from "../components/Icon.jsx";

// ---------------------------------------------------------------------------
// Editable primitives. In "live"/"preview" mode they render exactly the plain
// element they replace (no wrappers, no extra attributes), so the public
// markup is unchanged. In "edit" mode they add data-kibo-* hooks that the
// editor bridge uses for click-to-edit.
// ---------------------------------------------------------------------------

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function childrenToText(children) {
  let out = "";
  Children.forEach(children, (c) => {
    if (c == null || typeof c === "boolean") return;
    if (typeof c === "string" || typeof c === "number") out += c;
    else if (isValidElement(c)) out += childrenToText(c.props.children);
  });
  return out;
}
const escapeText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Resolve an uploaded-media URL against the configured media origin. */
export function useMediaUrl() {
  const { mediaBase = "" } = useCms();
  return (src) => (typeof src === "string" && src.startsWith("/uploads/") ? `${mediaBase}${src}` : src);
}

function EditableText({ As, value, kind, mode, k, docId, ...rest }) {
  const ref = useRef(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    // While the editor has this element in an edit session (contentEditable
    // on, even if focus is in the link box) the DOM is the source of truth.
    if (!el || el.isContentEditable) return;
    if (kind === "text") { if (el.textContent !== value) el.textContent = value; }
    else { const html = sanitizeHtml(value, { mode }); if (el.innerHTML !== html) el.innerHTML = html; }
  });
  return (
    <As
      ref={ref}
      data-kibo-k={k}
      data-kibo-doc={docId}
      data-kibo-kind={kind}
      data-kibo-mode={kind === "rich" ? mode : undefined}
      {...rest}
    />
  );
}

/** Plain text (headings, labels, short lines). */
export function T({ k, as: As = "span", children, ...rest }) {
  const def = childrenToText(children);
  const [v, key, docId] = useField(k, def);
  const value = typeof v === "string" ? v : def;
  const { mode } = useCms();
  if (mode === "edit" && docId && k) return <EditableText As={As} value={value} kind="text" k={key} docId={docId} {...rest} />;
  if (value === "" && def !== "") return null; // cleared by an admin -> remove the element
  return <As {...rest}>{value}</As>;
}

/**
 * Rich text: bold / italic / links (inline mode) or also paragraphs,
 * headings and lists (block mode). Default content comes from `html`
 * (trusted markup in code) or plain-text children.
 */
export function R({ k, as: As = "p", html, children, mode = "inline", ...rest }) {
  const def = html != null ? html : escapeText(childrenToText(children));
  const [v, key, docId] = useField(k, null);
  const value = v && v.t === "html" ? v.html : typeof v === "string" ? escapeText(v) : def;
  const { mode: cmsMode } = useCms();
  if (cmsMode === "edit" && docId && k) return <EditableText As={As} value={value} kind="rich" mode={mode} k={key} docId={docId} {...rest} />;
  return <As {...rest} dangerouslySetInnerHTML={{ __html: sanitizeHtml(value, { mode }) }} />;
}

/** Replaceable image. */
export function Img({ k, src, alt = "", sizes, width, height, ...rest }) {
  const [v, key, docId] = useField(k, null);
  const { mode } = useCms();
  const media = useMediaUrl();
  const img = v && v.t === "img" ? v : null;
  const srcSet = img?.srcset?.length ? img.srcset.map((s) => `${media(s.url)} ${s.w}w`).join(", ") : undefined;
  const edit = mode === "edit" && docId && k
    ? { "data-kibo-k": key, "data-kibo-doc": docId, "data-kibo-kind": "img", "data-kibo-value": JSON.stringify(img || { t: "img", src, alt, width: Number(width) || undefined, height: Number(height) || undefined }) }
    : {};
  return (
    <img
      src={media(img ? img.src : src)}
      srcSet={srcSet}
      sizes={srcSet ? sizes || "(max-width: 768px) 100vw, 60vw" : undefined}
      alt={img ? img.alt : alt}
      title={img?.title || undefined}
      width={img ? img.width || width : width}
      height={img ? img.height || height : height}
      {...rest}
      {...edit}
    />
  );
}

const STYLE_CLASSES = { primary: "btn-primary", outline: "btn-outline", light: "btn-light", dark: "btn-call-dark" };
const restyle = (cls, style) => (style && STYLE_CLASSES[style] ? cls.replace(/\bbtn-(primary|outline|light|call-dark)\b/, STYLE_CLASSES[style]) : cls);

/**
 * Editable button / link. Actions: link (internal or external), demo (opens
 * the demo form), tel, mailto, whatsapp, none.
 */
/** Button label in the editor: React never rewrites it while it is being typed in. */
function LiveLabel({ value }) {
  const ref = useRef(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (el && !el.isContentEditable && el.textContent !== value) el.textContent = value;
  });
  return <span ref={ref} data-kibo-label="" />;
}

export function Btn({ k, className = "", children, to, href, action, newTab, look, icon, iconAfter, onClick, ...rest }) {
  const defLabel = childrenToText(children);
  const defAction = action || (to ? "link" : href ? (href.startsWith("tel:") ? "tel" : href.startsWith("mailto:") ? "mailto" : "link") : "demo");
  const [v, key, docId] = useField(k, null);
  const { mode } = useCms();
  const { openDemo } = useDemoModal();
  const { settings } = useSite();
  const b = v && v.t === "btn" ? { label: v.label || defLabel, action: v.action, href: v.href, newTab: v.newTab, style: v.style } : { label: defLabel, action: defAction, href: to || href, newTab, style: look };
  const cls = restyle(className, b.style);
  const editing = mode === "edit" && docId && k;
  const edit = editing ? { "data-kibo-k": key, "data-kibo-doc": docId, "data-kibo-kind": "btn", "data-kibo-value": JSON.stringify({ t: "btn", ...b }) } : {};
  const label = editing ? <LiveLabel value={b.label} /> : b.label;
  const inner = <>{icon}{label}{iconAfter}</>;

  if (b.action === "demo") return <button type="button" className={cls} onClick={(e) => { onClick?.(e); openDemo(); }} {...rest} {...edit}>{inner}</button>;
  if (onClick) rest.onClick = onClick;
  if (b.action === "none" || !b.href && b.action !== "whatsapp") return <span className={cls} {...rest} {...edit}>{inner}</span>;
  if (b.action === "whatsapp") {
    const num = String(settings.company.whatsapp || "").replace(/\D/g, "");
    return <a className={cls} href={`https://wa.me/${num}`} target="_blank" rel="noopener noreferrer" {...rest} {...edit}>{inner}</a>;
  }
  const url = b.href;
  if (b.action === "link" && url.startsWith("/") && !url.startsWith("//") && !b.newTab) {
    return <Link to={url} className={cls} {...rest} {...edit}>{inner}</Link>;
  }
  const ext = b.newTab || /^https?:/i.test(url);
  return <a className={cls} href={url} {...(ext && b.action === "link" ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest} {...edit}>{inner}</a>;
}

/** Swappable icon (from the site's icon set). */
export function Ico({ k = "icon", name, size = 24, ...rest }) {
  const [v, key, docId] = useField(k, null);
  const { mode } = useCms();
  const n = v && v.t === "icon" ? v.name : name;
  const edit = mode === "edit" && docId ? { "data-kibo-k": key, "data-kibo-doc": docId, "data-kibo-kind": "icon", "data-kibo-value": JSON.stringify({ t: "icon", name: n }) } : {};
  if (!edit["data-kibo-k"]) return <Icon name={n} size={size} {...rest} />;
  return <span style={{ display: "inline-flex" }} {...edit}><Icon name={n} size={size} {...rest} /></span>;
}

/** Embedded video (YouTube / Vimeo / uploaded file). */
export function Video({ k, video: def, className = "", title = "Video" }) {
  const [v, key, docId] = useField(k, null);
  const { mode } = useCms();
  const media = useMediaUrl();
  const vid = v && v.t === "video" ? v : def;
  const edit = mode === "edit" && docId && k ? { "data-kibo-k": key, "data-kibo-doc": docId, "data-kibo-kind": "video", "data-kibo-value": JSON.stringify(vid || null) } : {};
  const frameStyle = { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, pointerEvents: mode === "edit" ? "none" : undefined };
  let inner = <div className="video-empty">No video selected</div>;
  if (vid?.provider === "youtube" && vid.id) inner = <iframe style={frameStyle} src={`https://www.youtube-nocookie.com/embed/${vid.id}`} title={vid.title || title} loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />;
  else if (vid?.provider === "vimeo" && vid.id) inner = <iframe style={frameStyle} src={`https://player.vimeo.com/video/${vid.id}?dnt=1`} title={vid.title || title} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen />;
  else if (vid?.provider === "file" && vid.src) inner = <video style={{ ...frameStyle, objectFit: "cover" }} src={media(vid.src)} poster={vid.poster ? media(vid.poster.src) : undefined} controls preload="metadata" />;
  return <div className={`video-frame ${className}`} style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 18, overflow: "hidden", background: "#0f0a24" }} {...edit}>{inner}</div>;
}

/**
 * Repeating items (cards, chips, list rows). Admins can reorder, hide and
 * duplicate items; each item's fields live under `<k>.<itemId>.*`.
 * `children` is a render function (item, { id, index }) => element.
 */
export function List({ k, items, getId, children: render }) {
  const entries = useListItems(k, items, getId);
  const { mode } = useCms();
  const { docId, prefix } = useScope();
  const listKey = joinKey(prefix, k);
  return entries.map((e, i) => {
    const el = render(e.item, { id: e.id, index: i, baseId: e.baseId });
    const out = mode === "edit" && isValidElement(el)
      ? cloneElement(el, { "data-kibo-item": e.id, "data-kibo-base": e.baseId, "data-kibo-list": listKey, "data-kibo-doc": docId, "data-kibo-hidden": e.hidden ? "1" : undefined })
      : el;
    return <Scope key={e.id} k={`${k}.${e.id}`}>{out}</Scope>;
  });
}

/**
 * A page section. Content keys inside are scoped to the section instance, so
 * a duplicated section gets its own independent copy of every field.
 */
export function Sec({ id, instanceId, hidden, label, noDuplicate, block, children }) {
  const { mode } = useCms();
  const { docId } = useScope();
  const inst = instanceId || id;
  if (hidden && mode !== "edit") return null;
  const body = <Scope k={inst} reset>{children}</Scope>;
  if (mode !== "edit") return body;
  return (
    <div
      className="kibo-sec"
      style={{ display: hidden ? "block" : "contents" }}
      data-kibo-section={inst}
      data-kibo-doc={docId}
      data-kibo-base={id}
      data-kibo-label={label || id}
      data-kibo-hidden={hidden ? "1" : undefined}
      data-kibo-nodup={noDuplicate ? "1" : undefined}
      data-kibo-block={block || undefined}
    >
      {hidden ? <div className="kibo-hidden-section">Hidden section: {label || id} - select it to show it again</div> : body}
    </div>
  );
}
