// ---------------------------------------------------------------------------
// Header & footer scripts (Super Admin -> Website -> Header & Footer Scripts).
//
// Snippets are added to the page in the browser, never baked into the HTML:
// Super Admin is served from the same HTML shell, so baked-in code could run
// there, and consent-gated code must wait for the visitor's choice anyway.
//
// The code itself is trusted (only people with the "site.code" permission can
// change it). This module makes it behave like code written into the page:
//   - <script> tags really run, including ones nested in other markup
//   - order is kept: an external script without `async` finishes loading
//     before the next part runs (e.g. a library, then the code that uses it)
//   - document.write() inserts its HTML in place instead of wiping the page
//     (the page has finished loading by the time snippets run)
//   - <noscript> parts are dropped: this only ever runs with JavaScript on
//   - code waiting for DOMContentLoaded / window load (already over by now)
//     is called right after its script
//   - snippets limited to some pages are removed when the visitor navigates
//     away and run again when they come back (like a page load would); a
//     changed snippet (after a publish) replaces the old version
// Code that already ran can't be "un-run": removing its tags is all we can do.
// ---------------------------------------------------------------------------

export const SNIPPET_ATTR = "data-kibo-snippet";
export const LOCATIONS = ["head", "bodyStart", "bodyEnd"];
const LOAD_TIMEOUT = 10_000;
const MAX_WRITE_DEPTH = 3;

const registry = new Map(); // key -> { location, nodes: Node[] }
const ranInline = new Set(); // inline scripts (by text) that already ran in this page
let wanted = [];
let generation = 0;
let queue = Promise.resolve();
let startMarker = null;

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const locationOf = (s) => (LOCATIONS.includes(s?.location) ? s.location : "head");
/** Identity of one version of a snippet: editing its code re-runs it. */
export const snippetKey = (s) => `${s.id}:${hash(`${locationOf(s)}\n${s.code}`)}`;

const normPath = (p) => (String(p || "/").replace(/\/+$/, "") || "/");
export function snippetMatches(s, pathname) {
  const pages = Array.isArray(s?.pages) ? s.pages : ["*"];
  return pages.includes("*") || pages.includes(normPath(pathname));
}

/**
 * Snippets that belong on the page right now, in document order (head, then
 * body start, then body end; list order inside each).
 *   mode       "live" runs every enabled snippet, "preview" only the ones
 *              marked "also run on preview links", "edit" never runs code
 *   consentOk  whether consent-gated snippets may run
 */
export function activeSnippets(snippets, { mode, pathname, consentOk }) {
  if (mode !== "live" && mode !== "preview") return [];
  const list = (Array.isArray(snippets) ? snippets : []).filter((s) =>
    s && typeof s.id === "string" && typeof s.code === "string" && s.code.trim() &&
    s.enabled !== false &&
    (mode === "live" || s.preview === true) &&
    (s.consent !== "analytics" || consentOk) &&
    snippetMatches(s, pathname));
  return LOCATIONS.flatMap((loc) => list.filter((s) => locationOf(s) === loc));
}

/** Does any snippet in this mode wait for cookie consent? */
export const hasGatedSnippets = (snippets, mode) =>
  (Array.isArray(snippets) ? snippets : []).some((s) => s && s.enabled !== false && s.consent === "analytics" && (mode === "live" || (mode === "preview" && s.preview === true)));

/**
 * Make the page carry exactly `list` (from activeSnippets). Calls are queued;
 * only the newest state is applied, so a quick unmount/mount (React
 * StrictMode) or several fast navigations never run a snippet twice.
 */
export function syncSnippets(list) {
  if (typeof document === "undefined") return Promise.resolve();
  wanted = Array.isArray(list) ? list : [];
  const gen = ++generation;
  queue = queue.then(() => apply(gen)).catch((e) => { console.warn("[kibo] custom code:", e); });
  return queue;
}

async function apply(gen) {
  if (gen !== generation) return; // a newer state is already queued
  const want = wanted.map((s) => ({ s, key: snippetKey(s), location: locationOf(s) }));
  const keep = new Set(want.map((w) => w.key));
  for (const [key, entry] of registry) {
    if (keep.has(key)) continue;
    for (const n of entry.nodes) n.parentNode?.removeChild(n);
    registry.delete(key);
  }
  for (let i = 0; i < want.length; i++) {
    if (gen !== generation) return;
    const { s, key, location } = want[i];
    if (registry.has(key)) continue;
    // Keep list order even when an earlier snippet arrives later (e.g. after
    // consent): insert in front of the next snippet already on the page.
    let ref = null;
    for (let j = i + 1; j < want.length && !ref; j++) {
      if (want[j].location !== location) continue;
      ref = registry.get(want[j].key)?.nodes.find((n) => n.isConnected) || null;
    }
    const entry = { location, nodes: [] };
    registry.set(key, entry);
    const ctx = {
      id: s.id,
      entry,
      // stop adding parts once the visitor has moved on and the newest state
      // no longer wants this snippet (the next sync then removes it)
      alive: () => gen === generation || wanted.some((w) => snippetKey(w) === key),
    };
    try {
      const { parent, before } = place(location, ref);
      await insertHtml(s.code, parent, before, ctx, 0);
    } catch (e) {
      console.warn(`[kibo] custom code "${s.name || s.id}" failed:`, e);
    }
  }
}

// --------------------------------------------------------------- insertion
function bodyStartMarker() {
  if (!startMarker || !startMarker.isConnected) {
    startMarker = document.createComment(" kibo: body start code ");
    document.body.insertBefore(startMarker, document.body.firstChild);
  }
  return startMarker;
}

/** Where a snippet's top-level parts go. */
function place(location, ref) {
  const parent = location === "head" ? document.head : document.body;
  if (ref && ref.parentNode === parent) return { parent, before: ref };
  return { parent, before: location === "bodyStart" ? bodyStartMarker() : null };
}

const JS_TYPE = /^(?:(?:text|application)\/(?:x-)?(?:java|ecma)script|module)$/i;
const isJs = (el) => { const t = (el.getAttribute("type") || "").trim(); return !t || JS_TYPE.test(t); };
const isClassicInline = (el) => !el.hasAttribute("src") && isJs(el) && (el.getAttribute("type") || "").trim().toLowerCase() !== "module";

/** A parsed <script> never runs when inserted - a fresh copy does. */
function freshScript(old, ctx, top) {
  const s = document.createElement("script");
  for (const a of old.attributes) s.setAttribute(a.name, a.value);
  // Scripts added from code default to async; keep written-in-page ordering.
  if (old.hasAttribute("src") && !old.hasAttribute("async")) s.async = false;
  s.text = inlineText(old);
  if (top) s.setAttribute(SNIPPET_ATTR, ctx.id);
  return s;
}

/**
 * Text for an inline script that is about to run (callers insert it right
 * away). Running the same code a second time (the visitor came back to a
 * page-limited snippet): a block keeps top-level const/let/class from
 * clashing with the first run ("Identifier has already been declared") - but
 * only when the wrapped code still parses (e.g. not for var + function of the
 * same name).
 */
function inlineText(old) {
  const body = old.textContent;
  if (!isClassicInline(old) || !body.trim()) return body;
  const k = hash(body);
  const again = ranInline.has(k);
  ranInline.add(k);
  if (!again) return body;
  const wrapped = `{\n${body}\n}`;
  try { new Function(wrapped); return wrapped; } catch { return body; } // eslint-disable-line no-new-func
}

/**
 * Snippets run after the page has loaded. Listeners they add for
 * DOMContentLoaded (or window "load", once it has fired) would never be
 * called - call them right after the script instead, like on a fresh page.
 */
function captureLifecycle() {
  const late = [];
  const patched = [document, window].map((target) => {
    const own = Object.prototype.hasOwnProperty.call(target, "addEventListener");
    const prev = target.addEventListener;
    target.addEventListener = function addEventListener(type, fn, opts) {
      const t = String(type);
      const missed = (t === "DOMContentLoaded" && document.readyState !== "loading") || (t === "load" && target === window && document.readyState === "complete");
      if (missed && fn) { late.push([target, t, fn]); return undefined; }
      return prev.call(this, type, fn, opts);
    };
    return () => { if (own) target.addEventListener = prev; else delete target.addEventListener; };
  });
  const onload = window.onload;
  return () => {
    patched.forEach((undo) => undo());
    if (window.onload !== onload && typeof window.onload === "function" && document.readyState === "complete") late.push([window, "load", window.onload]);
    for (const [target, t, fn] of late) {
      setTimeout(() => {
        try {
          const ev = new Event(t);
          if (typeof fn === "function") fn.call(target, ev); else fn.handleEvent?.(ev);
        } catch (e) { console.warn("[kibo] custom code:", e); }
      }, 0);
    }
  };
}

/** Wait for an external script to finish before running what follows it. */
function blocks(script) {
  return script.hasAttribute("src") && !script.hasAttribute("async") && !script.hasAttribute("nomodule") && isJs(script);
}
function loaded(script) {
  return new Promise((resolve) => {
    let timer = null;
    const done = () => { clearTimeout(timer); script.removeEventListener("load", done); script.removeEventListener("error", done); resolve(); };
    timer = setTimeout(done, LOAD_TIMEOUT);
    script.addEventListener("load", done);
    script.addEventListener("error", done);
  });
}

/**
 * Run `fn` with document.write / writeln captured into a buffer (after page
 * load the real ones would erase the whole page).
 */
async function captureWrites(fn) {
  const doc = document;
  const own = { write: Object.prototype.hasOwnProperty.call(doc, "write"), writeln: Object.prototype.hasOwnProperty.call(doc, "writeln") };
  const prev = { write: doc.write, writeln: doc.writeln };
  let buf = "";
  doc.write = (...a) => { buf += a.join(""); };
  doc.writeln = (...a) => { buf += `${a.join("")}\n`; };
  try {
    await fn();
  } finally {
    for (const k of ["write", "writeln"]) { if (own[k]) doc[k] = prev[k]; else delete doc[k]; }
  }
  return buf;
}

/**
 * Put a script in place (it runs on insertion), wait for it when the page
 * would have, and insert whatever it document.write()s right after it.
 */
async function runScript(script, parent, before, ctx, depth) {
  const runs = isJs(script) && !script.hasAttribute("nomodule");
  const wait = blocks(script);
  if (!runs || (script.hasAttribute("src") && !wait)) { parent.insertBefore(script, before); return; }
  const finish = captureLifecycle();
  let written = "";
  try {
    written = await captureWrites(async () => {
      const done = wait ? loaded(script) : null;
      parent.insertBefore(script, before);
      if (done) await done;
    });
  } finally {
    finish();
  }
  if (written && depth < MAX_WRITE_DEPTH && ctx.alive() && script.parentNode) {
    await insertHtml(written, script.parentNode, script.nextSibling, { ...ctx, track: script.parentNode === parent && ctx.track !== false }, depth + 1);
  }
}

/**
 * Insert `html` into `parent` before `before`, running its scripts in order.
 * Top-level parts (direct children of head/body) are tracked so they can be
 * removed again; nested parts go away with their parent.
 */
async function insertHtml(html, parent, before, ctx, depth) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  // Template content is parsed with scripting off, so <noscript> children are
  // real elements there - they would load pixels/iframes for JS visitors.
  for (const n of tpl.content.querySelectorAll("noscript")) n.remove();
  const top = ctx.track !== false && (parent === document.head || parent === document.body);
  for (const node of [...tpl.content.childNodes]) {
    if (!ctx.alive()) return;
    const anchor = before && before.parentNode === parent ? before : null;
    if (node.nodeType === Node.COMMENT_NODE) continue;
    if (node.nodeType === Node.TEXT_NODE) {
      // stray text: invisible in <head>, shown as-is in the body
      if (parent === document.head || !node.textContent.trim()) continue;
      const t = document.createTextNode(node.textContent);
      parent.insertBefore(t, anchor);
      if (top) ctx.entry.nodes.push(t);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    if (node.localName === "script") {
      const s = freshScript(node, ctx, top);
      if (top) ctx.entry.nodes.push(s);
      await runScript(s, parent, anchor, ctx, depth);
      continue;
    }

    // Any other element: insert it with its nested scripts held back, then
    // run those one by one in document order (same rules as top-level ones).
    const el = document.importNode(node, true);
    const holders = [];
    for (const inner of el.querySelectorAll("script")) {
      const mark = document.createComment(" kibo script ");
      inner.replaceWith(mark);
      holders.push([mark, inner]);
    }
    if (top) el.setAttribute(SNIPPET_ATTR, ctx.id);
    parent.insertBefore(el, anchor);
    if (top) ctx.entry.nodes.push(el);
    for (const [mark, inner] of holders) {
      if (!ctx.alive()) return;
      if (!mark.parentNode) continue;
      const s = freshScript(inner, ctx, false);
      const p = mark.parentNode;
      const next = mark.nextSibling;
      mark.remove();
      await runScript(s, p, next, { ...ctx, track: false }, depth);
    }
  }
}
