import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_SITE, DEFAULT_SEO, mergeDefaults } from "./defaults.js";
import { API_BASE } from "../lib/apiBase.js";

// ---------------------------------------------------------------------------
// Content runtime shared by the live site, previews and the visual editor.
//
//   docs    { "site": {...}, "seo": {...}, "forms": {...}, "page:home": {...} }
//   mode    "live"    - published content (normal visitors, SSR, prerender)
//           "preview" - drafts via a secure preview link (read-only)
//           "edit"    - drafts inside the Super Admin editor iframe
//
// Every editable element resolves its value as:  CMS override ?? code default
// ---------------------------------------------------------------------------

const EMPTY = { docs: {}, version: 0, mode: "live" };
const CmsCtx = createContext({ ...EMPTY, setDocs: () => {}, editor: null });
const ScopeCtx = createContext({ docId: null, prefix: "" });

export function ContentProvider({ initial, editor = null, children }) {
  const [state, setState] = useState(() => ({ ...EMPTY, ...initial, docs: initial?.docs || {} }));
  const setDocs = useCallback((docs, extra = {}) => setState((s) => ({ ...s, ...extra, docs: typeof docs === "function" ? docs(s.docs) : docs })), []);
  const setMode = useCallback((mode, extra = {}) => setState((s) => ({ ...s, ...extra, mode })), []);
  const value = useMemo(() => ({ ...state, setDocs, setMode, editor }), [state, setDocs, setMode, editor]);

  // Live visitors on a statically-built page: pick up anything published
  // since the build without a redeploy (cheap version check, then refetch).
  useLiveRefresh(state.mode, state.version, setDocs);

  return <CmsCtx.Provider value={value}>{children}</CmsCtx.Provider>;
}

function useLiveRefresh(mode, version, setDocs) {
  // Runs once per shipped version: after a refresh the version matches and
  // the next check is a no-op. (No "already checked" ref - StrictMode's
  // mount/unmount/mount would cancel the only attempt.)
  useEffect(() => {
    if (mode !== "live" || typeof window === "undefined") return undefined;
    let cancelled = false;
    (async () => {
      try {
        const v = await fetch(`${API_BASE}/api/content/version`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
        if (!v?.ok || cancelled || v.version === version) return;
        const d = await fetch(`${API_BASE}/api/content/published`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null));
        if (d?.ok && !cancelled) setDocs(d.docs, { version: d.version });
      } catch { /* offline - keep what the page shipped with */ }
    })();
    return () => { cancelled = true; };
  }, [mode, version, setDocs]);
}

export const useCms = () => useContext(CmsCtx);
export const useScope = () => useContext(ScopeCtx);
export const useIsEditing = () => useContext(CmsCtx).mode === "edit";

export const joinKey = (prefix, k) => (prefix ? (k ? `${prefix}.${k}` : prefix) : k);

/** Content scope for one page's document. */
export function PageDoc({ id, children }) {
  return <ScopeCtx.Provider value={{ docId: `page:${id}`, prefix: "" }}>{children}</ScopeCtx.Provider>;
}
/** Scope for global site content (header, footer...). */
export function SiteDoc({ children, prefix = "" }) {
  return <ScopeCtx.Provider value={{ docId: "site", prefix }}>{children}</ScopeCtx.Provider>;
}
/** Nested key prefix (sections, list items). `reset` starts from the doc root. */
export function Scope({ k, reset = false, children }) {
  const parent = useScope();
  const value = useMemo(() => ({ docId: parent.docId, prefix: reset ? k : joinKey(parent.prefix, k) }), [parent.docId, parent.prefix, k, reset]);
  return <ScopeCtx.Provider value={value}>{children}</ScopeCtx.Provider>;
}

/** Resolve one field. Returns [value, fullKey, docId]. */
export function useField(k, fallback) {
  const { docs } = useCms();
  const { docId, prefix } = useScope();
  const key = joinKey(prefix, k);
  const v = docId ? docs[docId]?.fields?.[key] : undefined;
  return [v === undefined ? fallback : v, key, docId];
}

/** Plain text value of a field (for labels shown in several places). */
export function useText(k, fallback) {
  const [v] = useField(k, fallback);
  return typeof v === "string" ? v : fallback;
}

/** Page-level document (layout, seo, meta) for the current scope. */
export function useDoc(docId) {
  const { docs } = useCms();
  const scope = useScope();
  return docs[docId || scope.docId] || null;
}

/** Merged site settings (header/menus/footer/banners/settings) incl. defaults. */
export function useSite() {
  const { docs } = useCms();
  return useMemo(() => {
    const s = docs.site || {};
    return {
      header: mergeDefaults(DEFAULT_SITE.header, s.header),
      menus: {
        header: Array.isArray(s.menus?.header) && s.menus.header.length ? s.menus.header : DEFAULT_SITE.menus.header,
        footerColumns: Array.isArray(s.menus?.footerColumns) && s.menus.footerColumns.length ? s.menus.footerColumns : DEFAULT_SITE.menus.footerColumns,
      },
      footer: mergeDefaults(DEFAULT_SITE.footer, s.footer),
      banners: Array.isArray(s.banners) ? s.banners : [],
      settings: mergeDefaults(DEFAULT_SITE.settings, s.settings),
    };
  }, [docs.site]);
}
export const useCompany = () => useSite().settings.company;

/** Merged global SEO settings incl. defaults. */
export function useSeoDoc() {
  const { docs } = useCms();
  return useMemo(() => mergeDefaults(DEFAULT_SEO, docs.seo || {}), [docs.seo]);
}

// ------------------------------------------------------------------- lists
const slug = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "item";
export function itemIds(items, getId) {
  const seen = new Map();
  return items.map((it, i) => {
    const raw = getId ? getId(it, i) : typeof it === "string" ? it : it.id ?? it.key ?? it.slug ?? it.title ?? it.name ?? it.label ?? it.q ?? i;
    const id = slug(raw) || `i${i}`;
    const n = seen.get(id) || 0;
    seen.set(id, n + 1);
    return n ? `${id}-${n + 1}` : id;
  });
}

/**
 * Effective list after CMS reordering / hiding / duplicating.
 * Returns [{ id, baseId, item, hidden, index }].
 */
export function useListItems(k, items, getId) {
  const { docs, mode } = useCms();
  const { docId, prefix } = useScope();
  const key = joinKey(prefix, k);
  const list = docId ? docs[docId]?.lists?.[key] : null;
  return useMemo(() => {
    const ids = itemIds(items, getId);
    const byId = new Map(ids.map((id, i) => [id, items[i]]));
    const dups = list?.dups || {};
    const order = [];
    const seen = new Set();
    for (const id of list?.order || []) {
      const base = dups[id] || id;
      if (byId.has(base) && !seen.has(id)) { order.push(id); seen.add(id); }
    }
    // Items added in code after the admin reordered: keep them near their
    // original neighbour instead of dropping them.
    ids.forEach((id, i) => {
      if (seen.has(id)) return;
      const prev = ids.slice(0, i).reverse().find((p) => seen.has(p));
      const at = prev ? order.indexOf(prev) + 1 : 0;
      order.splice(at, 0, id);
      seen.add(id);
    });
    const hidden = list?.hidden || {};
    return order
      .map((id, index) => ({ id, baseId: dups[id] || id, item: byId.get(dups[id] || id), hidden: !!hidden[id], index }))
      .filter((x) => mode === "edit" || !x.hidden);
  }, [items, getId, list, mode]);
}

export { slug as makeSlug };
