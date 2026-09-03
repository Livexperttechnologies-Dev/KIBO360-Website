// Build-time prerendering: renders every public route to real HTML so the
// full page content is visible in view-source (and to every crawler), then
// React hydrates in the browser and the site behaves exactly as before.
// Runs after `vite build` + `vite build --ssr` (see package.json "build").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "../dist");
const distServer = path.resolve(__dirname, "../dist-server");

const { render } = await import(
  new URL(`file://${path.join(distServer, "entry-server.js").replace(/\\/g, "/")}`).href
);

const SITE = "https://kibo360.in";
const ROUTES = ["/", "/products", "/products/hospitalmanagementsoftware", "/products/clinicalmanagementsoftware", "/about", "/contact", "/privacy-policy", "/terms", "/thank-you"];
// Renamed/legacy URLs: emit tiny meta-refresh stubs so direct hits and old
// search results land on the new pages even without server-side redirects.
const REDIRECTS = {
  "/products/hms": "/products/hospitalmanagementsoftware",
  "/products/cms": "/products/clinicalmanagementsoftware",
  "/his": "/products/hospitalmanagementsoftware",
  "/hms": "/products/hospitalmanagementsoftware",
  "/cms": "/products/clinicalmanagementsoftware",
};

const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
if (!template.includes('<div id="root"></div>')) {
  throw new Error('dist/index.html is missing <div id="root"></div> - cannot inject prerendered HTML');
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

for (const route of ROUTES) {
  const { html, seo } = await render(route);
  // data-route lets main.jsx detect a fallback-served page (host rewrote an
  // unknown URL to this file) and rebuild instead of mis-hydrating.
  let out = template.replace(
    '<div id="root"></div>',
    `<div id="root" data-prerendered-route="${route}">${html}</div>`
  );

  if (seo) {
    const fullTitle = seo.title.includes("KIBO360") ? seo.title : `${seo.title} | KIBO360`;
    const url = SITE + (seo.path || route);
    out = out
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(seo.description)}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(fullTitle)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(seo.description)}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta name="robots" content=")[^"]*(")/, `$1${seo.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}$2`);
    if (seo.jsonLd && route !== "/") {
      // id matches Seo.jsx's client effect so hydration REPLACES this block
      // instead of appending a duplicate.
      out = out.replace(
        "</head>",
        `<script type="application/ld+json" id="page-jsonld">${JSON.stringify(seo.jsonLd)}</script>\n</head>`
      );
    }
  }

  const file = route === "/" ? path.join(dist, "index.html") : path.join(dist, ...route.slice(1).split("/"), "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out, "utf8");
  console.log(`prerendered ${route.padEnd(16)} -> ${path.relative(dist, file)} (${(html.length / 1024).toFixed(1)} KB of content)`);
}

// Static redirect stubs for renamed URLs (works on any static host, no config)
for (const [from, to] of Object.entries(REDIRECTS)) {
  const stub = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8" />
<title>Redirecting…</title>
<meta name="robots" content="noindex" />
<link rel="canonical" href="${SITE}${to}" />
<meta http-equiv="refresh" content="0;url=${to}" />
<script>window.location.replace(${JSON.stringify(to)});</script>
</head><body><p>This page has moved to <a href="${to}">${SITE}${to}</a>.</p></body></html>`;
  const file = path.join(dist, ...from.slice(1).split("/"), "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, stub, "utf8");
  console.log(`redirect    ${from.padEnd(16)} -> ${to}`);
}

// Clean SPA shell for hosts that rewrite unknown paths to 404.html/200.html
// (no prerendered content, so hydration never mismatches on those paths).
fs.writeFileSync(path.join(dist, "404.html"), template, "utf8");
fs.writeFileSync(path.join(dist, "200.html"), template, "utf8");

fs.rmSync(distServer, { recursive: true, force: true });
console.log("done - dist/ now contains real HTML for every public page");
