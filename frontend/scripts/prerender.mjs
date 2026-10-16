// Build-time prerendering (static hosting mode).
// Renders every public page to real HTML with the PUBLISHED CMS content, and
// generates robots.txt / sitemap.xml / llms.txt / redirect pages from the CMS
// too. Runs after `vite build` + `vite build --ssr` (see package.json).
//
//   CONTENT_API  where to read published content from at build time,
//                e.g. https://api.kibo360.in  (unset -> code defaults only)
//   MEDIA_BASE   origin that serves /uploads (defaults to CONTENT_API origin)
//
// The writing itself lives in src/staticSite.js (part of the SSR bundle) so the
// backend can rewrite these files after every publish (STATIC_SITE_DIR).
// The SSR bundle in dist-server/ is kept: the Node site server uses it to
// render pages per request with live content (see backend/lib/site.js).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const distServer = path.resolve(__dirname, "../dist-server");

const { writeStaticSite } = await import(pathToFileURL(path.join(distServer, "entry-server.js")).href);

const CONTENT_API = (process.env.CONTENT_API || "").replace(/\/$/, "");
const MEDIA_BASE = process.env.MEDIA_BASE ?? (CONTENT_API ? new URL(CONTENT_API).origin : "");

let docs = {};
let version = 0;
if (CONTENT_API) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(`${CONTENT_API}/api/content/published`, { signal: ctrl.signal });
    clearTimeout(t);
    const d = await r.json();
    if (d?.ok) { docs = d.docs || {}; version = d.version || 0; }
    console.log(`content: v${version} from ${CONTENT_API} (${Object.keys(docs).length} documents)`);
  } catch (e) {
    console.warn(`content: could not reach ${CONTENT_API} (${e.message}) - building with code defaults; the live site will refresh itself at runtime`);
  }
} else {
  console.log("content: CONTENT_API not set - building with code defaults (published content loads at runtime; a backend with STATIC_SITE_DIR rewrites the files with it)");
}

// The raw template (dist/index.html straight from vite) is kept in
// dist-server/: the Node site server and the backend's file writer use it.
const templateFile = path.join(distServer, "template.html");
let template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
if (!template.includes("<!--kibo-head-->")) {
  // dist/index.html was prerendered already (prerender run twice without a new vite build)
  template = fs.readFileSync(templateFile, "utf8");
} else {
  fs.writeFileSync(templateFile, template, "utf8");
}

const res = await writeStaticSite({ outDir: dist, template, docs, version, mediaBase: MEDIA_BASE, manifestFile: path.join(dist, ".kibo-static-files.json"), log: (m) => console.log(m) });
console.log(`done - ${res.pages} pages, ${res.redirects} redirect pages, sitemap.xml, robots.txt, llms.txt written to dist/`);
