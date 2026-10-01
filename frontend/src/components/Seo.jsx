import { createContext, useContext, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useCms } from "../cms/content.jsx";
import { pageById } from "../cms/pageMeta.js";
import { computeSeo, headTags } from "../cms/seo.js";
import { SNIPPET_ATTR } from "../cms/customCode.js";

/**
 * Collector used during server rendering: the Seo component deposits the
 * computed head here and the renderer turns it into real <head> tags.
 */
export const HeadCollectorContext = createContext(null);

const MANAGED = [
  'meta[name="description"]', 'meta[name="keywords"]', 'meta[name="robots"]', 'link[rel="canonical"]',
  'meta[property^="og:"]', 'meta[name^="twitter:"]', 'script[type="application/ld+json"]',
].map((sel) => `${sel}:not([${SNIPPET_ATTR}])`); // tags added by header scripts are not ours to remove

function applyHead(seo) {
  document.title = seo.title;
  // Remove every tag we manage (including static ones from the HTML shell),
  // then write the fresh set - no stale or duplicated tags survive navigation.
  document.head.querySelectorAll(`[data-kibo-head], ${MANAGED.join(", ")}`).forEach((el) => el.remove());
  for (const t of headTags(seo)) {
    if (t.tag === "link" && t.attrs.rel === "icon") {
      const icon = document.head.querySelector(`link[rel="icon"]:not([${SNIPPET_ATTR}])`);
      if (icon) { icon.setAttribute("href", t.attrs.href); continue; }
    }
    const el = document.createElement(t.tag);
    for (const [k, v] of Object.entries(t.attrs)) el.setAttribute(k, v);
    if (t.text) el.text = t.text;
    el.setAttribute("data-kibo-head", "1");
    document.head.appendChild(el);
  }
}

/**
 * Per-page SEO. `page` is a built-in page id ("home", "hms"...) or a page
 * meta object (custom pages). `jsonLd` is the page's automatic schema.
 */
export default function Seo({ page, jsonLd = null }) {
  const { docs, mode, mediaBase } = useCms();
  const { pathname } = useLocation();
  const collector = useContext(HeadCollectorContext);
  const meta = typeof page === "string" ? pageById(page) : page;
  const seo = useMemo(() => {
    if (!meta) return null;
    const s = computeSeo({ page: meta, docs, path: meta.path || pathname, codeJsonLd: jsonLd, mediaBase });
    // previews and the editor must never be indexed
    return mode === "live" ? s : { ...s, robots: "noindex, nofollow" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, docs, pathname, JSON.stringify(jsonLd), mediaBase, mode]);
  if (collector && seo) collector.seo = seo;

  useEffect(() => { if (seo) applyHead(seo); }, [seo]);
  return null;
}
