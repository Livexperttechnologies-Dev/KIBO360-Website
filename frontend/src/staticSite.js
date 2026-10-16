// ---------------------------------------------------------------------------
// Static website files (static hosting mode): real HTML for every public page
// with the PUBLISHED content, plus sitemap.xml / robots.txt / llms.txt and
// redirect pages. Used by the build (scripts/prerender.mjs) and by the backend,
// which rewrites the files after every publish (STATIC_SITE_DIR) - so "view
// page source", social link previews and crawlers always see what is live.
// Node only (part of the SSR bundle in dist-server/).
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { buildSitemap, buildRobots, buildLlms, siteEntries, effectiveRedirects, mergedSeo } from "./cms/seo.js";

const escA = (s) => String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * Write the site into `outDir`.
 *   template      the built index.html (with the <!--kibo-head--> markers)
 *   render        entry-server's render()
 *   manifestFile  list of the page/redirect files written last time - ones
 *                 no longer needed (deleted or unpublished pages) are removed
 * Returns { pages, redirects, removed }.
 */
export async function writeStaticSite({ outDir, template, render, docs = {}, version = 0, mediaBase = "", manifestFile = null, log = () => {} }) {
  for (const marker of ["<!--kibo-head-->", "<!--kibo-data-->", '<div id="root"></div>']) {
    if (!template.includes(marker)) throw new Error(`The website template is missing ${marker}`);
  }
  const root = path.resolve(outDir);
  const inside = (f) => { const p = path.resolve(f); return p === root || p.startsWith(root + path.sep); };
  const written = new Set();
  const fileFor = (route) => (route === "/" ? path.join(root, "index.html") : path.join(root, ...route.slice(1).split("/"), "index.html"));
  const write = (file, text) => {
    if (!inside(file)) throw new Error(`Refusing to write outside the website folder: ${file}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // write next to it, then swap in one step: visitors never get half a file
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text, "utf8");
    fs.renameSync(tmp, file);
    written.add(path.relative(root, file).split(path.sep).join("/"));
  };
  // Replacer functions: "$&", "$'" etc. in CMS text must never be expanded.
  const inject = (r, route) =>
    template
      .replace("<!--kibo-head-->", () => r.head || "")
      .replace('<div id="root"></div>', () => `<div id="root" data-prerendered-route="${route}">${r.html || ""}</div>`)
      .replace("<!--kibo-data-->", () => `<script id="kibo-data" type="application/json">${r.data}</script>`);

  // ---- pages
  const pagePaths = new Set();
  for (const e of siteEntries(docs)) {
    const r = await render(e.path, { docs, version, mediaBase });
    if (r.redirect) { log(`skip        ${e.path} (redirects to ${r.redirect.to})`); continue; }
    write(fileFor(e.path), inject(r, e.path));
    pagePaths.add(e.path);
    log(`prerendered ${e.path.padEnd(40)} ${(r.html.length / 1024).toFixed(1)} KB${r.status !== 200 ? ` (status ${r.status})` : ""}`);
  }

  // Real 404 page (hosts that serve 404.html for unknown paths show it with a
  // 404 status). The client re-renders, so pages published later still resolve.
  const nf = await render("/__kibo-not-found__", { docs, version, mediaBase });
  write(path.join(root, "404.html"), inject(nf, "/404"));
  // Plain SPA shell for hosts that rewrite unknown paths to 200.html. It gets
  // a neutral head (site name, default description, favicon) - no canonical
  // or robots tag, since it may stand in for any page.
  const g = mergedSeo(docs);
  const shellHead = `<title>${escA(g.global.siteName || "KIBO360")}</title><meta name="description" content="${escA(g.global.defaultDescription)}" /><link rel="icon" href="/favicon.png" />`;
  write(path.join(root, "200.html"), template.replace("<!--kibo-head-->", () => shellHead).replace("<!--kibo-data-->", () => `<script id="kibo-data" type="application/json">${nf.data}</script>`));

  // ---- redirect pages (built-in short URLs, moved pages, SEO -> Redirects).
  // A static host can't send a 301, so these forward instantly (keeping the
  // visitor's ?query and #anchor) and carry a canonical; the Node site server
  // sends real 301s instead.
  let redirects = 0;
  for (const r of effectiveRedirects(docs)) {
    if (r.type === 410 || !r.to || pagePaths.has(r.from) || r.from === "/") continue;
    const to = escA(r.to);
    write(fileFor(r.from), `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8" />
<title>Redirecting…</title>
<meta name="robots" content="noindex" />
<link rel="canonical" href="${r.to.startsWith("/") ? `https://kibo360.in${to}` : to}" />
<script>(function(){var t=${JSON.stringify(r.to).replace(/</g, "\\u003c")};var i=t.indexOf("#");var b=i<0?t:t.slice(0,i);var f=i<0?"":t.slice(i);window.location.replace(b+(b.indexOf("?")<0?location.search:"")+(f||location.hash));})();</script>
<noscript><meta http-equiv="refresh" content="0;url=${to}" /></noscript>
</head><body><p>This page has moved to <a href="${to}">${to}</a>.</p></body></html>`);
    redirects++;
    log(`redirect    ${r.from.padEnd(40)} -> ${r.to}`);
  }

  // ---- search engine files
  write(path.join(root, "sitemap.xml"), buildSitemap(docs, { lastmod: new Date().toISOString().slice(0, 10) }));
  write(path.join(root, "robots.txt"), buildRobots(docs));
  const llms = buildLlms(docs);
  if (llms) write(path.join(root, "llms.txt"), llms);
  if (g.indexNow?.enabled && g.indexNow.key) write(path.join(root, `${g.indexNow.key}.txt`), g.indexNow.key);

  // ---- remove what the previous run wrote and is no longer part of the site
  let removed = 0;
  if (manifestFile) {
    let before = [];
    try { before = JSON.parse(fs.readFileSync(manifestFile, "utf8")).files || []; } catch { /* first run */ }
    for (const rel of before) {
      if (written.has(rel) || typeof rel !== "string" || rel.includes("..")) continue;
      const file = path.join(root, rel);
      if (!inside(file)) continue;
      try { fs.unlinkSync(file); removed++; } catch { /* already gone */ }
      // drop folders this left empty (never the website root)
      for (let dir = path.dirname(file); inside(dir) && dir !== root; dir = path.dirname(dir)) {
        try { fs.rmdirSync(dir); } catch { break; }
      }
    }
    fs.writeFileSync(manifestFile, JSON.stringify({ version, writtenAt: new Date().toISOString(), files: [...written].sort() }, null, 2), "utf8");
  }
  return { pages: pagePaths.size, redirects, removed };
}
