// ---------------------------------------------------------------------------
// KIBO360 HTML sanitizer - SHARED FILE.
// An identical copy lives at frontend/src/cms/sanitize.js (a test enforces
// that the two stay byte-identical). Pure JS: no DOM, no Node APIs, so it
// runs the same in the browser, during SSR and on the API.
//
// Strategy: tokenize -> keep only allow-listed tags/attributes -> re-serialize
// from scratch with strict escaping. Nothing from the input is passed through
// verbatim, which rules out attribute/tag breakouts and mutation tricks.
// ---------------------------------------------------------------------------

const INLINE = new Set(["strong", "em", "u", "s", "a", "br", "sup", "sub", "code", "mark", "small"]);
const BLOCK = new Set([...INLINE, "p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "hr"]);
const VOID = new Set(["br", "hr"]);
const ALIASES = { b: "strong", i: "em", strike: "s", del: "s", ins: "u", h1: "h2", h5: "h4", h6: "h4" };
// Elements whose CONTENT must be discarded along with the tag. (Void elements
// such as <embed>/<img>/<input> have no closing tag and are simply skipped
// like any other non-allowed tag, so they must NOT be listed here.)
const DROP_CONTENT = new Set([
  "script", "style", "iframe", "object", "noscript", "template", "svg", "math",
  "textarea", "select", "option", "title", "xmp", "noembed", "noframes", "plaintext",
  "head", "form", "button", "audio", "video", "canvas", "frameset", "applet", "picture",
]);
// Block-level tags that become line breaks when flattened to inline mode.
const BLOCKISH = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "tr", "section", "article"]);

function tokenize(html) {
  const tokens = [];
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) { tokens.push({ t: "text", v: html.slice(i) }); break; }
    if (lt > i) tokens.push({ t: "text", v: html.slice(i, lt) });
    i = lt;
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    const c = html[i + 1];
    if (c === "!" || c === "?") {
      const end = html.indexOf(">", i);
      i = end === -1 ? n : end + 1;
      continue;
    }
    const closing = c === "/";
    let j = i + (closing ? 2 : 1);
    if (!/[a-zA-Z]/.test(html[j] || "")) { tokens.push({ t: "text", v: "<" }); i += 1; continue; }
    let name = "";
    while (j < n && /[a-zA-Z0-9-]/.test(html[j])) name += html[j++];
    const attrs = [];
    while (j < n && html[j] !== ">") {
      if (/[\s/]/.test(html[j])) { j++; continue; }
      let an = "";
      while (j < n && !/[\s/>=]/.test(html[j])) an += html[j++];
      while (j < n && /\s/.test(html[j])) j++;
      let av = null;
      if (html[j] === "=") {
        j++;
        while (j < n && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const end = html.indexOf(q, j + 1);
          av = html.slice(j + 1, end === -1 ? n : end);
          j = end === -1 ? n : end + 1;
        } else {
          let v = "";
          while (j < n && !/[\s>]/.test(html[j])) v += html[j++];
          av = v;
        }
      }
      if (an) attrs.push([an.toLowerCase(), av]);
      else j++;
    }
    i = j < n ? j + 1 : n;
    tokens.push({ t: closing ? "close" : "open", name: name.toLowerCase(), attrs });
  }
  return tokens;
}

const CTRL_CHARS = new RegExp("[\x00-\x20\x7F-\x9F" + String.fromCharCode(0x2028, 0x2029) + "]", "g");

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", colon: ":", tab: "\t", newline: "\n", sol: "/", lpar: "(", rpar: ")" };

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d{1,7});?/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}
function safeChar(code) {
  if (!code || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return "�";
  return String.fromCodePoint(code);
}

const escText = (s) =>
  String(s)
    .replace(/&(?!(#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const escAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Validate a link target. Returns the cleaned URL or null. */
export function cleanHref(raw) {
  if (raw == null) return null;
  // eslint-disable-next-line no-control-regex
  const v = decodeEntities(raw).replace(CTRL_CHARS, "");
  if (!v || v.length > 2048) return null;
  if (v.startsWith("#")) return /^#[A-Za-z0-9_\-:.]*$/.test(v) ? v : null;
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) return /^\/[^\s<>"'`\\]*$/.test(v) ? v : null;
  let u;
  try { u = new URL(v); } catch { return null; }
  const p = u.protocol.toLowerCase();
  if (p === "http:" || p === "https:") return u.toString();
  if (p === "mailto:") return /^mailto:[^\s<>"']+$/i.test(v) ? v : null;
  if (p === "tel:") return /^tel:[+0-9\-\s().]{3,30}$/i.test(v) ? v : null;
  return null;
}

/**
 * Sanitize rich text.
 * mode "inline": bold/italic/links/line-breaks (paragraphs, card text).
 * mode "block":  adds paragraphs, H2-H4, lists, quotes (long-form pages).
 */
export function sanitizeHtml(input, { mode = "inline", maxLength = 100000 } = {}) {
  if (input == null) return "";
  const html = String(input).slice(0, maxLength * 2);
  const allowed = mode === "block" ? BLOCK : INLINE;
  const tokens = tokenize(html);
  let out = "";
  const stack = [];
  let drop = null; // { name, depth }
  let pendingBreak = false;

  const flushBreak = () => {
    if (pendingBreak && out && !out.endsWith("<br>")) out += "<br>";
    pendingBreak = false;
  };

  for (const tok of tokens) {
    if (drop) {
      if (tok.t === "open" && tok.name === drop.name) drop.depth++;
      else if (tok.t === "close" && tok.name === drop.name && --drop.depth === 0) drop = null;
      continue;
    }
    if (tok.t === "text") {
      if (tok.v) { if (tok.v.trim()) flushBreak(); out += escText(tok.v); }
      continue;
    }
    let name = ALIASES[tok.name] || tok.name;
    if (mode === "block" && name === "div") name = "p";

    if (tok.t === "open") {
      if (DROP_CONTENT.has(tok.name)) { drop = { name: tok.name, depth: 1 }; continue; }
      if (!allowed.has(name)) {
        if (mode === "inline" && BLOCKISH.has(tok.name) && out) pendingBreak = true;
        continue; // unwrap: keep the text, lose the tag
      }
      if (VOID.has(name)) { flushBreak(); out += `<${name}>`; continue; }
      let attrs = "";
      if (name === "a") {
        if (stack.includes("a")) continue; // no nested links
        let href = null, target = null, title = null, rel = [];
        for (const [k, v] of tok.attrs) {
          if (k === "href") href = cleanHref(v);
          else if (k === "target" && v === "_blank") target = "_blank";
          else if (k === "title" && v) title = decodeEntities(v).slice(0, 200);
          else if (k === "rel" && v) rel = decodeEntities(v).toLowerCase().split(/\s+/).filter((r) => ["nofollow", "sponsored", "ugc"].includes(r));
        }
        if (!href) continue; // a link without a safe href is just text
        attrs += ` href="${escAttr(href)}"`;
        if (target) { attrs += ` target="_blank"`; rel.push("noopener", "noreferrer"); }
        if (rel.length) attrs += ` rel="${escAttr([...new Set(rel)].join(" "))}"`;
        if (title) attrs += ` title="${escAttr(title)}"`;
      }
      flushBreak();
      out += `<${name}${attrs}>`;
      stack.push(name);
      continue;
    }

    // closing tag
    if (mode === "inline" && BLOCKISH.has(tok.name) && !allowed.has(name)) { pendingBreak = true; continue; }
    const idx = stack.lastIndexOf(name);
    if (idx === -1) continue;
    while (stack.length > idx) out += `</${stack.pop()}>`;
  }
  while (stack.length) out += `</${stack.pop()}>`;
  // tidy: no leading/trailing breaks, collapse runs of 3+ breaks
  out = out.replace(/^(\s|<br>)+/, "").replace(/(\s|<br>)+$/, "").replace(/(<br>\s*){3,}/g, "<br><br>");
  if (mode === "block") out = out.replace(/<(p|h2|h3|h4|li|blockquote)>\s*<\/\1>/g, "");
  return out.length > maxLength ? sanitizeHtml(out.slice(0, maxLength), { mode, maxLength }) : out;
}

/** Plain text from rich HTML (for SEO analysis, excerpts, diffs). */
export function htmlToText(html) {
  return decodeEntities(String(html || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}
