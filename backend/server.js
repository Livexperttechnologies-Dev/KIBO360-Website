import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";

// KIBO360 backend entry point.
//   PORT          listen port (default 5001)
//   DATA_DIR      where JSON stores + uploads live (default ./data)
//   SITE_DIST     path to the built frontend (frontend/dist). When set and the
//                 SSR bundle exists, this server ALSO serves the public website
//                 with server-side rendering, real 301 redirects and a live
//                 sitemap/robots.txt. Leave unset to run as API-only.
//   ALLOWED_ORIGINS extra CORS origins (comma separated)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5001;

let siteDist = process.env.SITE_DIST || null;
if (!siteDist) {
  const guess = path.resolve(__dirname, "../frontend/dist");
  if (process.env.SERVE_SITE === "1" && fs.existsSync(guess)) siteDist = guess;
}

const { app, hasSite } = await createApp({ siteDist });

app.listen(PORT, () => {
  console.log(`KIBO360 backend running at http://localhost:${PORT}${hasSite ? " (serving the website with SSR)" : " (API only)"}`);
});
