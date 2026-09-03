import { useEffect } from "react";

const SITE_URL = "https://kibo360.in";
const SITE_NAME = "KIBO360";

/**
 * Per-page SEO for the SPA: document title, meta description, canonical URL,
 * Open Graph / Twitter tags and optional JSON-LD structured data.
 */
export default function Seo({ title, description, path = "/", jsonLd = null, noindex = false }) {
  // During build-time prerendering there is no document to mutate - hand the
  // values to the prerender script instead, which writes real <head> tags.
  if (import.meta.env.SSR) {
    globalThis.__SEO__ = { title, description, path, jsonLd, noindex };
  }
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    const setMeta = (attr, key, content) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("name", "description", description);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", SITE_URL + path);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", SITE_URL + path);

    // noindex pages (e.g. /thank-you) must not enter search results
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");

    // Page-specific JSON-LD (replaced on every route change)
    const JSONLD_ID = "page-jsonld";
    document.getElementById(JSONLD_ID)?.remove();
    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = JSONLD_ID;
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, noindex, JSON.stringify(jsonLd)]);

  return null;
}
