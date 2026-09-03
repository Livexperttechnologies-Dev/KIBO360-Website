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
const ROUTES = ["/", "/products", "/products/hms", "/products/cms", "/about", "/contact", "/privacy-policy", "/terms"];

const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
if (!template.includes('<div id="root"></div>')) {
  throw new Error('dist/index.html is missing <div id="root"></div> - cannot inject prerendered HTML');
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

for (const route of ROUTES) {
  const { html, seo } = await render(route);
  let out = template.replace('<div id="root"></div>', `<div id="root">${html}</div>`);

  if (seo) {
    const fullTitle = seo.title.includes("KIBO360") ? seo.title : `${seo.title} | KIBO360`;
    const url = SITE + (seo.path || route);
    out = out
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(fullTitle)}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(seo.description)}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(fullTitle)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(seo.description)}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
    if (seo.jsonLd && route !== "/") {
      out = out.replace(
        "</head>",
        `<script type="application/ld+json">${JSON.stringify(seo.jsonLd)}</script>\n</head>`
      );
    }
  }

  const file = route === "/" ? path.join(dist, "index.html") : path.join(dist, ...route.slice(1).split("/"), "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out, "utf8");
  console.log(`prerendered ${route.padEnd(16)} -> ${path.relative(dist, file)} (${(html.length / 1024).toFixed(1)} KB of content)`);
}

fs.rmSync(distServer, { recursive: true, force: true });
console.log("done - dist/ now contains real HTML for every public page");
