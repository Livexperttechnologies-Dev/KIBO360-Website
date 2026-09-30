import { DEFAULT_SITE, mergeDefaults } from "../cms/defaults.js";

// ---------------------------------------------------------------------------
// Pure helpers that turn editor actions into new document data. Documents
// are never mutated in place (undo/redo keeps references to old versions).
// ---------------------------------------------------------------------------

export const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
export const clone = (v) => (v === undefined ? undefined : structuredClone(v));

/** Deterministic stringify (sorted keys) - same as the server's. */
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}
export const same = (a, b) => stable(a ?? null) === stable(b ?? null);

export const docType = (docId) => (docId.startsWith("page:") ? "page" : docId);
export const PATCHABLE = {
  page: ["fields", "lists", "layout", "seo", "meta"],
  site: ["header", "menus", "footer", "banners", "settings", "code"],
  seo: ["global", "robots", "redirects", "sitemap", "llms", "indexNow", "schema"],
  forms: ["forms"],
};

export const emptyPage = () => ({ fields: {}, lists: {}, layout: { order: [], hidden: {}, dups: {}, blocks: {} }, seo: {}, meta: {} });
const rid = (n = 6) => Math.random().toString(36).slice(2, 2 + n).padEnd(n, "0");

/** Site sections always carry their full value (the server replaces them). */
export function siteSection(site, key) {
  const s = site || {};
  if (key === "menus") {
    return {
      header: Array.isArray(s.menus?.header) && s.menus.header.length ? s.menus.header : DEFAULT_SITE.menus.header,
      footerColumns: Array.isArray(s.menus?.footerColumns) && s.menus.footerColumns.length ? s.menus.footerColumns : DEFAULT_SITE.menus.footerColumns,
    };
  }
  if (key === "banners") return Array.isArray(s.banners) ? s.banners : [];
  return mergeDefaults(DEFAULT_SITE[key], s[key]);
}

/**
 * Write one field. Page docs keep flat `fields`; the site doc maps keys such
 * as "header.cta" / "footer.motto" onto its structured sections.
 * value === null resets the field to the code default.
 */
export function setField(data, docId, key, value) {
  const t = docType(docId);
  if (t === "page") {
    const d = { ...emptyPage(), ...(data || {}) };
    const fields = { ...(d.fields || {}) };
    if (value === null || value === undefined) delete fields[key];
    else fields[key] = value;
    return { ...d, fields };
  }
  if (t === "site") {
    const [section, ...rest] = key.split(".");
    if (!["header", "footer"].includes(section) || rest.length !== 1) return data;
    const cur = siteSection(data, section);
    const next = { ...cur };
    if (value === null || value === undefined) next[rest[0]] = DEFAULT_SITE[section][rest[0]];
    else next[rest[0]] = value;
    return { ...(data || {}), [section]: next };
  }
  return data;
}

export function getField(data, docId, key) {
  if (docType(docId) === "page") return data?.fields?.[key];
  if (docId === "site") {
    const [section, prop] = key.split(".");
    return data?.[section]?.[prop];
  }
  return undefined;
}

// ------------------------------------------------------------- sections
const layoutOf = (d) => ({ order: [], hidden: {}, dups: {}, blocks: {}, ...(d?.layout || {}) });
const withLayout = (d, layout) => ({ ...emptyPage(), ...(d || {}), layout });

function move(list, id, dir) {
  const i = list.indexOf(id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Copy every field / list override from one key prefix to another. */
function copyPrefixed(d, fromPrefix, toPrefix) {
  const fields = { ...(d.fields || {}) };
  for (const [k, v] of Object.entries(d.fields || {})) if (k.startsWith(`${fromPrefix}.`)) fields[toPrefix + k.slice(fromPrefix.length)] = clone(v);
  const lists = { ...(d.lists || {}) };
  for (const [k, v] of Object.entries(d.lists || {})) {
    if (k === fromPrefix || k.startsWith(`${fromPrefix}.`)) lists[toPrefix + k.slice(fromPrefix.length)] = clone(v);
  }
  return { ...d, fields, lists };
}
function dropPrefixed(d, prefix) {
  const fields = Object.fromEntries(Object.entries(d.fields || {}).filter(([k]) => !k.startsWith(`${prefix}.`)));
  const lists = Object.fromEntries(Object.entries(d.lists || {}).filter(([k]) => k !== prefix && !k.startsWith(`${prefix}.`)));
  return { ...d, fields, lists };
}

/**
 * Apply a section action. `order` is the section order currently on screen
 * (reported by the page), which is authoritative even when the stored
 * layout is empty or stale.
 */
export function sectionAction(data, { action, id, base, order, blockType }) {
  let d = { ...emptyPage(), ...(data || {}) };
  const layout = layoutOf(d);
  const cur = order?.length ? [...order] : [...layout.order];
  const isBlock = !!layout.blocks[id];
  let newId = null;
  switch (action) {
    case "up":
    case "down":
      layout.order = move(cur, id, action);
      break;
    case "hide":
    case "show": {
      const hidden = { ...layout.hidden };
      if (action === "hide") hidden[id] = true; else delete hidden[id];
      layout.hidden = hidden;
      layout.order = cur;
      break;
    }
    case "duplicate": {
      newId = isBlock ? `b_${rid(10)}` : `${base || id.split("~")[0]}~${rid(6)}`;
      if (isBlock) layout.blocks = { ...layout.blocks, [newId]: clone(layout.blocks[id]) };
      else layout.dups = { ...layout.dups, [newId]: base || id.split("~")[0] };
      const at = cur.indexOf(id);
      cur.splice(at < 0 ? cur.length : at + 1, 0, newId);
      layout.order = cur;
      if (layout.hidden[id]) layout.hidden = { ...layout.hidden, [newId]: true };
      d = copyPrefixed(d, id, newId);
      break;
    }
    case "remove": {
      if (!isBlock && id === (base || id)) return { data, newId: null, error: "Built-in sections can be hidden, not deleted" };
      layout.order = cur.filter((x) => x !== id);
      const { [id]: _b, ...blocks } = layout.blocks; layout.blocks = blocks;
      const { [id]: _d, ...dups } = layout.dups; layout.dups = dups;
      const { [id]: _h, ...hidden } = layout.hidden; layout.hidden = hidden;
      d = dropPrefixed(d, id);
      break;
    }
    case "add": {
      newId = `b_${rid(10)}`;
      layout.blocks = { ...layout.blocks, [newId]: { type: blockType || "richText" } };
      const at = id ? cur.indexOf(id) : -1;
      cur.splice(at < 0 ? cur.length : at + 1, 0, newId);
      layout.order = cur;
      break;
    }
    default:
      return { data, newId: null };
  }
  return { data: withLayout(d, layout), newId };
}

/** Change a block's options (background, alignment, columns, form...). */
export function setBlockOptions(data, id, patch) {
  const d = { ...emptyPage(), ...(data || {}) };
  const layout = layoutOf(d);
  if (!layout.blocks[id]) return data;
  const b = { ...layout.blocks[id], ...patch };
  for (const [k, v] of Object.entries(b)) if (v === "" || v == null) delete b[k];
  layout.blocks = { ...layout.blocks, [id]: b };
  return withLayout(d, layout);
}

/** Reorder by drag and drop in the layers panel. */
export function setSectionOrder(data, order) {
  const d = { ...emptyPage(), ...(data || {}) };
  return withLayout(d, { ...layoutOf(d), order: [...order] });
}

// ----------------------------------------------------------------- lists
export function itemAction(data, { action, list, id, base, order }) {
  let d = { ...emptyPage(), ...(data || {}) };
  const l = { order: [], hidden: {}, dups: {}, ...(d.lists?.[list] || {}) };
  const cur = order?.length ? [...order] : [...l.order];
  const baseId = base || id.split("~")[0];
  let newId = null;
  switch (action) {
    case "up":
    case "down":
      l.order = move(cur, id, action);
      break;
    case "hide":
    case "show": {
      const hidden = { ...l.hidden };
      if (action === "hide") hidden[id] = true; else delete hidden[id];
      l.hidden = hidden;
      l.order = cur;
      break;
    }
    case "duplicate": {
      newId = `${baseId}~${rid(6)}`;
      l.dups = { ...l.dups, [newId]: baseId };
      const at = cur.indexOf(id);
      cur.splice(at < 0 ? cur.length : at + 1, 0, newId);
      l.order = cur;
      d = copyPrefixed(d, `${list}.${id}`, `${list}.${newId}`);
      break;
    }
    case "remove": {
      if (id === baseId) return { data, error: "Original items can be hidden, not deleted" };
      l.order = cur.filter((x) => x !== id);
      const { [id]: _d, ...dups } = l.dups; l.dups = dups;
      const { [id]: _h, ...hidden } = l.hidden; l.hidden = hidden;
      d = dropPrefixed(d, `${list}.${id}`);
      break;
    }
    default:
      return { data };
  }
  return { data: { ...d, lists: { ...(d.lists || {}), [list]: l } }, newId };
}

// ------------------------------------------------------------- autosave
/**
 * Minimal PATCH body turning `saved` into `working`. Page fields and lists
 * are sent per key (null = delete); everything else as whole sections.
 */
export function diffPatch(docId, saved, working) {
  const t = docType(docId);
  const patch = {};
  for (const k of PATCHABLE[t] || []) {
    if (t === "page" && (k === "fields" || k === "lists")) {
      const a = saved?.[k] || {};
      const b = working?.[k] || {};
      const out = {};
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!(key in b)) out[key] = null;
        else if (!same(a[key], b[key])) out[key] = b[key];
      }
      if (Object.keys(out).length) patch[k] = out;
    } else if (!same(saved?.[k], working?.[k]) && working?.[k] !== undefined) {
      patch[k] = working[k];
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/**
 * What the server's draft looks like after it applied `patch` to `base`
 * (same merge rules as PATCH /api/admin/content/doc). Used as the next
 * autosave diff base, so keys written by someone else are never sent as
 * deletions just because this editor never loaded them.
 */
export function applyPatch(docId, base, patch) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch || {})) {
    if (docType(docId) === "page" && (k === "fields" || k === "lists")) {
      const m = { ...(out[k] || {}) };
      for (const [fk, fv] of Object.entries(v || {})) { if (fv === null) delete m[fk]; else m[fk] = fv; }
      out[k] = m;
    } else out[k] = v;
  }
  return out;
}

/** Human readable list of what differs between two versions of a doc. */
export function describeChanges(docId, before, after) {
  const out = [];
  const t = docType(docId);
  if (t === "page") {
    const a = before?.fields || {}, b = after?.fields || {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!same(a[k], b[k])) out.push({ kind: "field", key: k, before: a[k], after: b[k] });
    }
    const norm = (k, v) => (k === "layout" ? { order: v?.order || [], hidden: v?.hidden || {}, dups: v?.dups || {}, blocks: v?.blocks || {} } : v || {});
    for (const k of ["layout", "lists", "seo", "meta"]) {
      if (!same(norm(k, before?.[k]), norm(k, after?.[k]))) out.push({ kind: k, key: k, before: before?.[k], after: after?.[k] });
    }
  } else {
    for (const k of PATCHABLE[t] || []) if (!same(before?.[k], after?.[k])) out.push({ kind: k, key: k, before: before?.[k], after: after?.[k] });
  }
  return out;
}

/** Short text preview of any stored value. */
export function valueText(v) {
  if (v == null) return "(original)";
  if (typeof v === "string") return v || "(empty)";
  if (typeof v !== "object") return String(v);
  if (v.t === "html") return v.html.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim() || "(empty)";
  if (v.t === "img") return `Image: ${v.src.split("/").pop()}${v.alt ? ` (${v.alt})` : ""}`;
  if (v.t === "btn") return `Button "${v.label}" → ${v.action === "link" ? v.href || "(no link)" : v.action}`;
  if (v.t === "icon") return `Icon: ${v.name}`;
  if (v.t === "video") return `Video: ${v.provider} ${v.id || v.src || ""}`;
  return JSON.stringify(v).slice(0, 120);
}

/** Readable label for a field key like "why.pillars.cloud.title". */
export function keyLabel(key) {
  return key.split(".").map((s) => s.replace(/~[a-z0-9]+$/i, " (copy)").replace(/^b_[a-z0-9]+$/i, "block").replace(/[-_]/g, " ")).join(" › ");
}

/** Media library item -> stored image value (keeps the previous alt text). */
export function imageValue(item, prev = {}) {
  const v = { t: "img", src: item.url, alt: item.alt || prev?.alt || "", mediaId: item.id };
  if (item.width) v.width = item.width;
  if (item.height) v.height = item.height;
  if (item.srcset?.length) v.srcset = item.srcset;
  if (item.title) v.title = item.title;
  return v;
}
