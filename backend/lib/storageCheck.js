// ---------------------------------------------------------------------------
// Will the content survive the next deploy?
//
// Everything the website and Super Admin save - drafts, published pages,
// revisions, SEO, forms, uploads, leads, users - lives in DATA_DIR. When the
// app runs in a container (Docker, Coolify, Dokploy, CapRover, Easypanel ...)
// a deploy creates a NEW container: anything written inside the old one is
// gone, and the website falls back to its built-in default content. Only a
// mounted volume (persistent storage) survives.
//
// This checks where DATA_DIR really lives so the problem is reported loudly
// (server log + Super Admin dashboard) instead of being discovered after a
// deploy wiped everything.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";

const realSys = {
  read: (f) => { try { return fs.readFileSync(f, "utf8"); } catch { return ""; } },
  exists: (f) => fs.existsSync(f),
  realpath: (p) => fs.realpathSync(p),
  platform: process.platform,
};

/** "\040" etc. in /proc/self/mountinfo paths */
const unescapeMount = (p) => p.replace(/\\([0-7]{3})/g, (_m, o) => String.fromCharCode(parseInt(o, 8)));

/** `sys` replaces the file system lookups in tests. */
export function checkStorage(dataDir, appDir, sys = realSys) {
  const { read, exists, platform } = sys;
  const P = platform === "win32" ? path.win32 : path.posix; // path rules of the system being checked
  let real = P.resolve(dataDir);
  try { real = sys.realpath(real); } catch { /* not created yet */ }
  const inContainer = exists("/.dockerenv") || exists("/run/.containerenv") || /docker|kubepods|containerd|libpod/.test(read("/proc/1/cgroup"));
  // the mount the data folder is on (longest matching mount point)
  let mount = null;
  if (platform === "linux") {
    const points = read("/proc/self/mountinfo").split("\n").map((l) => l.split(" ")[4]).filter(Boolean).map(unescapeMount);
    mount = points.filter((p) => real === p || real.startsWith(p === "/" ? "/" : `${p}/`)).sort((a, b) => b.length - a.length)[0] || "/";
  }
  const insideApp = real === P.resolve(appDir) || real.startsWith(P.resolve(appDir) + P.sep);
  // inside a container, only a mounted volume survives a redeploy
  const persistent = !(inContainer && mount === "/");
  return { dataDir: real, inContainer, mount, insideApp, persistent };
}

export function reportStorage(s, log = console) {
  if (!s.persistent) {
    log.warn([
      "",
      "############################################################################",
      "#  WARNING: CONTENT IS STORED INSIDE THIS CONTAINER AND WILL BE ERASED ON   #",
      "#  THE NEXT DEPLOY (drafts, published pages, SEO, images, leads, users).    #",
      "############################################################################",
      `   Data folder: ${s.dataDir}`,
      "   Fix: add persistent storage (a volume) in your hosting panel and mount it",
      `   at ${s.dataDir} - or mount it anywhere and set DATA_DIR to that path.`,
      "",
    ].join("\n"));
  } else if (s.insideApp && !s.inContainer) {
    log.log(`[storage] content is stored in ${s.dataDir} (inside the app folder). Deploys must keep this folder - replacing the whole app folder deletes all content. Safer: set DATA_DIR to a folder outside the app.`);
  } else {
    log.log(`[storage] content is stored in ${s.dataDir}${s.inContainer ? ` (persistent volume at ${s.mount})` : ""}`);
  }
}
