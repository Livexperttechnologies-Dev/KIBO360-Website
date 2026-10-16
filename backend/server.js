import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";

// KIBO360 backend entry point.
//   PORT          listen port (default 5001)
//   DATA_DIR      where JSON stores + uploads live (default ./data; in a
//                 container where ./data is not on a volume, a mounted volume
//                 such as /data is used automatically)
//   SITE_DIST     path to the built frontend (frontend/dist). When set and the
//                 SSR bundle exists, this server ALSO serves the public website
//                 with server-side rendering, real 301 redirects and a live
//                 sitemap/robots.txt. Leave unset to run as API-only.
//   STATIC_SITE_DIR  the folder a web server (Caddy, nginx...) serves the
//                 website from. The backend rewrites its HTML, sitemap.xml and
//                 robots.txt after every publish, so page source and link
//                 previews always show what is live. STATIC_SITE=1 is a
//                 shortcut for ../frontend/dist.
//   ALLOWED_ORIGINS extra CORS origins (comma separated)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5001;

let siteDist = process.env.SITE_DIST || null;
if (!siteDist) {
  const guess = path.resolve(__dirname, "../frontend/dist");
  if (process.env.SERVE_SITE === "1" && fs.existsSync(guess)) siteDist = guess;
}
let staticSiteDir = process.env.STATIC_SITE_DIR || null;
if (!staticSiteDir && process.env.STATIC_SITE === "1") {
  const guess = path.resolve(__dirname, "../frontend/dist");
  if (fs.existsSync(guess)) staticSiteDir = guess;
  else console.warn(`[static] STATIC_SITE=1 but ${guess} does not exist - build the frontend first`);
}

const { app, hasSite } = await createApp({ siteDist, staticSiteDir });

app.listen(PORT, () => {
  const mode = hasSite ? " (serving the website with SSR)" : staticSiteDir ? ` (API; keeping the website files in ${staticSiteDir} current)` : " (API only)";
  console.log(`KIBO360 backend running at http://localhost:${PORT}${mode}`);
});
