// Build-time prerendering (static hosting mode).
// Renders every public page to real HTML with the PUBLISHED CMS content, and
// generates robots.txt / sitemap.xml / llms.txt / redirect stubs from the
// CMS too. Runs after `vite build` + `vite build --ssr` (see package.json).
//
//   CONTENT_API  where to read published content from at build time,
//                e.g. https://api.kibo360.in  (unset -> code defaults only)
//   MEDIA_BASE   origin that serves /uploads (defaults to CONTENT_API origin)
//
// The SSR bundle in dist-server/ is kept: the Node site server uses it to
// render pages per request with live content (see backend/lib/site.js).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const distServer = path.resolve(__dirname, "../dist-server");

const { render, buildSitemap, buildRobots, buildLlms, siteEntries, effectiveRedirects, mergedSeo } = await import(pathToFileURL(path.join(distServer, "entry-server.js")).href);

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
  console.log("content: CONTENT_API not set - building with code defaults (published content loads at runtime)");
}

const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
for (const marker of ["<!--kibo-head-->", "<!--kibo-data-->", '<div id="root"></div>']) {
  if (!template.includes(marker)) throw new Error(`dist/index.html is missing ${marker}`);
}
// The raw template is what the Node site server renders into.
fs.writeFileSync(path.join(distServer, "template.html"), template, "utf8");

// Replacer functions: "$&", "$'" etc. in CMS text must never be expanded.
const inject = (r, route) =>
  template
    .replace("<!--kibo-head-->", () => r.head || "")
    .replace('<div id="root"></div>', () => `<div id="root" data-prerendered-route="${route}">${r.html || ""}</div>`)
    .replace("<!--kibo-data-->", () => `<script id="kibo-data" type="application/json">${r.data}</script>`);

const fileFor = (route) => (route === "/" ? path.join(dist, "index.html") : path.join(dist, ...route.slice(1).split("/"), "index.html"));
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content, "utf8"); };

const pagePaths = new Set();
for (const e of siteEntries(docs)) {
  const r = await render(e.path, { docs, version, mediaBase: MEDIA_BASE });
  if (r.redirect) { console.log(`skip        ${e.path} (redirects to ${r.redirect.to})`); continue; }
  write(fileFor(e.path), inject(r, e.path));
  pagePaths.add(e.path);
  console.log(`prerendered ${e.path.padEnd(40)} ${(r.html.length / 1024).toFixed(1)} KB${r.status !== 200 ? ` (status ${r.status})` : ""}`);
}

// Real 404 page (hosts that serve 404.html for unknown paths show it with a
// 404 status). The client re-renders, so pages published later still resolve.
const nf = await render("/__kibo-not-found__", { docs, version, mediaBase: MEDIA_BASE });
write(path.join(dist, "404.html"), inject(nf, "/404"));
// Plain SPA shell for hosts that rewrite unknown paths to 200.html.
// It gets a neutral head (site name, default description, favicon) - no
// canonical or robots tag, since it may stand in for any page.
const g = mergedSeo(docs);
const escA = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const shellHead = `<title>${escA(g.global.siteName || "KIBO360")}</title><meta name="description" content="${escA(g.global.defaultDescription)}" /><link rel="icon" href="/favicon.png" />`;
write(path.join(dist, "200.html"), template.replace("<!--kibo-head-->", () => shellHead).replace("<!--kibo-data-->", () => `<script id="kibo-data" type="application/json">${nf.data}</script>`));

// Redirect stubs (built-in legacy URLs + CMS redirects). A static host can't
// send a 301, so these use an instant meta refresh + canonical; the Node
// site server sends real 301s instead.
for (const r of effectiveRedirects(docs)) {
  if (r.type === 410 || !r.to || pagePaths.has(r.from) || r.from === "/") continue;
  const to = r.to.replace(/"/g, "&quot;");
  write(fileFor(r.from), `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8" />
<title>Redirecting…</title>
<meta name="robots" content="noindex" />
<link rel="canonical" href="${to.startsWith("/") ? `https://kibo360.in${to}` : to}" />
<meta http-equiv="refresh" content="0;url=${to}" />
<script>window.location.replace(${JSON.stringify(r.to)});</script>
</head><body><p>This page has moved to <a href="${to}">${to}</a>.</p></body></html>`);
  console.log(`redirect    ${r.from.padEnd(40)} -> ${r.to}`);
}

const today = new Date().toISOString().slice(0, 10);
write(path.join(dist, "sitemap.xml"), buildSitemap(docs, { lastmod: today }));
write(path.join(dist, "robots.txt"), buildRobots(docs));
const llms = buildLlms(docs);
if (llms) write(path.join(dist, "llms.txt"), llms);
if (g.indexNow?.enabled && g.indexNow.key) write(path.join(dist, `${g.indexNow.key}.txt`), g.indexNow.key);
console.log("done - sitemap.xml, robots.txt, llms.txt written; dist/ contains real HTML for every public page");
