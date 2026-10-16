// ---------------------------------------------------------------------------
// Keeps a statically hosted website's files current (static hosting mode).
//
// When the website is served as plain files (e.g. Caddy/nginx serving
// frontend/dist), the HTML only changes when it is rebuilt - so "view page
// source", Facebook/LinkedIn/WhatsApp previews and crawlers that don't run
// JavaScript keep seeing old titles and descriptions. With STATIC_SITE_DIR
// set, the backend rewrites those files from the published content:
//   - after every publish (also scheduled publishes), a second later
//   - when the backend starts
//   - when a new frontend build appears (its template changes)
// It uses the same build bundle as the build itself (dist-server/), so the
// files are exactly what `npm run build` with the published content makes.
//
//   STATIC_SITE_DIR     folder the web server serves (e.g. /srv/kibo360/frontend/dist)
//   STATIC_SITE_BUNDLE  the build's dist-server folder (default: <STATIC_SITE_DIR>/../dist-server)
//   STATIC_MEDIA_BASE   where /uploads are served (default: https://api.kibo360.in)
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { publicData } from "./content.js";

export function createStaticSite({ content, outDir, bundleDir = null, mediaBase = "https://api.kibo360.in", log = console.log }) {
  const out = path.resolve(outDir);
  const bundle = path.resolve(bundleDir || path.join(out, "..", "dist-server"));
  const entryFile = path.join(bundle, "entry-server.js");
  const templateFile = path.join(bundle, "template.html");
  let built = null; // { template mtime, version } of the last successful write
  let running = null;
  let pending = null;
  let timer = null;

  const status = { lastRun: null, lastError: null, version: null };

  async function write(reason) {
    if (!fs.existsSync(entryFile) || !fs.existsSync(templateFile)) {
      throw new Error(`no website build found in ${bundle} (run "npm run build" in frontend/)`);
    }
    // a new deploy brings a new bundle: load it fresh, never a cached old one
    const ssr = await import(`${pathToFileURL(entryFile).href}?v=${fs.statSync(entryFile).mtimeMs}`);
    if (typeof ssr.writeStaticSite !== "function") throw new Error("the website build is too old - rebuild the frontend");
    const templateMtime = fs.statSync(templateFile).mtimeMs;
    const template = fs.readFileSync(templateFile, "utf8");
    const pub = content.loadPublished();
    const docs = {};
    for (const [id, d] of Object.entries(pub.docs)) docs[id] = publicData(id, d.data);
    const res = await ssr.writeStaticSite({ outDir: out, template, docs, version: pub.version || 0, mediaBase, manifestFile: path.join(out, ".kibo-static-files.json") });
    built = { templateMtime, version: pub.version || 0 };
    Object.assign(status, { lastRun: new Date().toISOString(), lastError: null, version: pub.version || 0 });
    log(`[static] website files updated (${reason}): content v${pub.version || 0}, ${res.pages} pages, ${res.redirects} redirect pages${res.removed ? `, ${res.removed} old files removed` : ""}`);
  }

  /** Run now, or right after the run in progress (runs never overlap). */
  function run(reason) {
    if (running) { pending = reason; return running; }
    running = write(reason)
      .catch((e) => {
        Object.assign(status, { lastRun: new Date().toISOString(), lastError: e.message });
        console.error(`[static] could not update the website files: ${e.message}`);
      })
      .finally(() => {
        running = null;
        if (pending) { const r = pending; pending = null; run(r); }
      });
    return running;
  }
  /** Several publishes in a row are written once. */
  function schedule(reason, delay = 1000) {
    clearTimeout(timer);
    timer = setTimeout(() => run(reason), delay);
    timer.unref?.();
  }

  // a new frontend build (deploy) replaces the files with ones made without the
  // published content - put the live content back into them
  const watcher = setInterval(() => {
    try {
      if (built && fs.statSync(templateFile).mtimeMs !== built.templateMtime) schedule("new website build");
    } catch { /* build being replaced */ }
  }, 30_000);
  watcher.unref();
  schedule("backend started", 1500);

  return {
    schedule, run, status,
    close: () => { clearInterval(watcher); clearTimeout(timer); },
  };
}
