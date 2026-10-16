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
  isDir: (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } },
  writable: (p) => { try { fs.accessSync(p, fs.constants.W_OK); return true; } catch { return false; } },
  platform: process.platform,
};

/** "\040" etc. in /proc/self/mountinfo paths */
const unescapeMount = (p) => p.replace(/\\([0-7]{3})/g, (_m, o) => String.fromCharCode(parseInt(o, 8)));

// A database's own data folder (PostgreSQL, MySQL/MariaDB, MongoDB, Redis) -
// e.g. the volume Dokploy creates for a database service. Content must never
// be written into it: the backend needs a volume of its own.
const DATABASE_PATH = /^\/(var\/lib\/(postgresql|pgsql|mysql|mariadb|mongodb|redis|clickhouse)|bitnami|data\/(db|configdb))(\/|$)/;
const DATABASE_FILES = ["PG_VERSION", "postgresql.conf", "ibdata1", "WiredTiger", "mongod.lock", "dump.rdb", "appendonlydir"];
function isDatabaseDir(dir, sys, P = path.posix) {
  return DATABASE_PATH.test(dir) || DATABASE_FILES.some((f) => sys.exists(P.join(dir, f)));
}

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
  return { dataDir: real, inContainer, mount, insideApp, persistent, database: isDatabaseDir(real, sys, P) };
}

// Mount points every container has - never a data volume.
const SYSTEM_MOUNT = /^\/(proc|sys|dev|run|etc|tmp|usr|lib|lib32|lib64|bin|sbin|boot|nix|var\/run|var\/lib\/docker)(\/|$)/;
const VIRTUAL_FS = new Set(["proc", "sysfs", "tmpfs", "devtmpfs", "devpts", "mqueue", "cgroup", "cgroup2", "securityfs", "debugfs", "tracefs", "configfs", "pstore", "bpf", "nsfs", "fusectl", "hugetlbfs", "binfmt_misc", "autofs", "shm", "ramfs"]);
// Usual places to mount a data volume, in order of preference.
const PREFERRED_VOLUMES = ["/data", "/app/data", "/app/backend/data", "/storage", "/var/lib/kibo360", "/mnt/data"];

/**
 * Folders mounted into this container (volumes, bind mounts): `usable` can
 * hold the content; `skipped` cannot ({ point, why }) and is reported.
 */
export function volumeMounts(sys = realSys) {
  const usable = [], skipped = [];
  if (sys.platform !== "linux") return { usable, skipped };
  for (const line of sys.read("/proc/self/mountinfo").split("\n")) {
    const f = line.split(" ");
    const point = unescapeMount(f[4] || "");
    const fstype = f[f.indexOf("-") + 1] || "";
    if (!point || point === "/" || SYSTEM_MOUNT.test(point) || VIRTUAL_FS.has(fstype)) continue;
    if (usable.includes(point) || skipped.some((s) => s.point === point) || !sys.isDir(point)) continue;
    const why = isDatabaseDir(point, sys) ? "a database's own data folder" : !sys.writable(point) ? "not writable" : null;
    if (why) skipped.push({ point, why });
    else usable.push(point);
  }
  return { usable, skipped };
}

/**
 * Which folder to keep the data in.
 * DATA_DIR always wins. Otherwise the data folder next to the app - unless it
 * would be erased by the next deploy (in a container, not on a volume) while a
 * volume IS mounted: then that volume is used. So adding a volume in the
 * hosting panel (e.g. Dokploy "Volume Mount" at /data) is enough on its own.
 */
export function chooseDataDir({ envDir, defaultDir, appDir, sys = realSys }) {
  if (envDir) return { dir: envDir, from: "DATA_DIR" };
  if (checkStorage(defaultDir, appDir, sys).persistent) return { dir: defaultDir, from: "default" };
  const { usable: volumes, skipped } = volumeMounts(sys);
  const pick = PREFERRED_VOLUMES.find((p) => volumes.includes(p)) || (volumes.length === 1 ? volumes[0] : null);
  if (pick) return { dir: pick, from: "volume" };
  return { dir: defaultDir, from: "default", volumes, skipped };
}

/** How to fix storage that is erased on the next deploy, for this setup. */
export function storageFix(s, chosen = {}) {
  if (chosen.from === "DATA_DIR" || chosen.from === "option") {
    // DATA_DIR wins over any volume, so the volume must be mounted exactly there
    return `DATA_DIR is ${s.dataDir}: mount the backend's volume at exactly that path, or change DATA_DIR to the volume's mount path.`;
  }
  if (chosen.volumes?.length) return `Several volumes are mounted (${chosen.volumes.join(", ")}) - set DATA_DIR to the one for content.`;
  return "Give THIS (backend) app a NEW volume of its own and redeploy - in Dokploy: Advanced > Volumes > Add Volume > Volume Mount, a new volume name, mount path /data. (A database service's volume, e.g. PostgreSQL's, does not keep this app's content.)";
}

export function reportStorage(s, log = console, chosen = {}) {
  if (chosen.from === "volume") log.log(`[storage] DATA_DIR is not set - using the volume mounted at ${chosen.dir}`);
  if (!s.persistent) {
    log.warn([
      "",
      "############################################################################",
      "#  WARNING: CONTENT IS STORED INSIDE THIS CONTAINER AND WILL BE ERASED ON   #",
      "#  THE NEXT DEPLOY (drafts, published pages, SEO, images, leads, users).    #",
      "############################################################################",
      `   Data folder: ${s.dataDir}`,
      ...(chosen.skipped || []).map((v) => `   Not used: the volume at ${v.point} (${v.why}).`),
      `   Fix: ${storageFix(s, chosen)}`,
      "",
    ].join("\n"));
  } else if (s.database) {
    log.warn([
      `[storage] WARNING: content is stored in ${s.dataDir}, which is also a database's own data folder (it holds the database's files).`,
      "   Content is kept across deploys, but it now depends on that database's volume and is not in its backups.",
      "   Fix: give the backend a NEW volume of its own (Dokploy: Advanced > Volumes > Add Volume > Volume Mount, a new volume name),",
      "   point DATA_DIR at its mount path (or leave DATA_DIR unset and mount it at /data), and detach the database's volume from the backend.",
    ].join("\n"));
  } else if (s.insideApp && !s.inContainer) {
    log.log(`[storage] content is stored in ${s.dataDir} (inside the app folder). Deploys must keep this folder - replacing the whole app folder deletes all content. Safer: set DATA_DIR to a folder outside the app.`);
  } else {
    log.log(`[storage] content is stored in ${s.dataDir}${s.inContainer ? ` (persistent volume at ${s.mount})` : ""}`);
  }
}
