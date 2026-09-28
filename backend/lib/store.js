import fs from "fs";
import path from "path";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// JSON-file persistence.
// - Writes are atomic (unique tmp file + rename), so a crash mid-write can
//   never leave a half-written file behind.
// - A missing file returns the fallback; a CORRUPT file throws instead of
//   silently returning the fallback (the old behaviour could have re-seeded
//   users.json with the default admin password after a bad write).
// - All callers do read-modify-write synchronously, so requests can't
//   interleave inside a single update on Node's single thread.
// ---------------------------------------------------------------------------

export function createStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const abs = (rel) => path.join(dataDir, rel);

  function readJson(rel, fallback) {
    const file = abs(rel);
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") return fallback;
      throw e;
    }
    if (raw.trim() === "") return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      // Try the last known-good copy before giving up.
      try {
        const bak = JSON.parse(fs.readFileSync(`${file}.bak`, "utf8"));
        console.error(`[store] ${rel} is corrupt - recovered from ${rel}.bak`);
        return bak;
      } catch {
        const err = new Error(`Data file ${rel} is corrupt and has no usable backup`);
        err.code = "ECORRUPT";
        throw err;
      }
    }
  }

  function writeJson(rel, value, { backup = false } = {}) {
    const file = abs(rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
    if (backup && fs.existsSync(file)) {
      try { fs.copyFileSync(file, `${file}.bak`); } catch { /* best effort */ }
    }
    fs.renameSync(tmp, file);
  }

  function appendLine(rel, obj) {
    const file = abs(rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(obj) + "\n", "utf8");
  }

  function readLines(rel, { limit = 1000, filter } = {}) {
    let raw = "";
    try { raw = fs.readFileSync(abs(rel), "utf8"); } catch { return []; }
    const out = [];
    const lines = raw.split("\n");
    // newest first
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (!filter || filter(obj)) out.push(obj);
      } catch { /* skip a torn line */ }
    }
    return out;
  }

  function listDir(rel) {
    try { return fs.readdirSync(abs(rel)); } catch { return []; }
  }

  function remove(rel) {
    try { fs.unlinkSync(abs(rel)); } catch (e) { if (e.code !== "ENOENT") throw e; }
  }

  return { dataDir, abs, readJson, writeJson, appendLine, readLines, listDir, remove };
}
