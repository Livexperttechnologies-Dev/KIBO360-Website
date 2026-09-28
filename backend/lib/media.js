import fs from "fs";
import path from "path";
import crypto from "crypto";
import express from "express";
import Busboy from "busboy";
import { newId, clampStr } from "./security.js";

// ---------------------------------------------------------------------------
// Media library.
// - File type is decided by MAGIC BYTES, never by the claimed MIME type or
//   the file extension. Anything not on the allow-list is rejected.
// - Stored names are random; users never control a path.
// - Raster images: EXIF/GPS stripped, WebP + responsive widths generated.
// - SVG: sanitised (scripts, event handlers, foreign content, external
//   references removed) AND served with a locked-down CSP.
// - "Replace" is draft-safe: the new file gets a new URL, drafts that used
//   the old one are rewritten, and live pages keep the old file until the
//   drafts are published.
// - Delete moves to trash (files keep serving) and warns when in use;
//   permanent purge is refused while live content still references it.
// ---------------------------------------------------------------------------

const MEDIA = "media.json";
const LIMITS = { image: 15 * 1024 * 1024, svg: 2 * 1024 * 1024, video: 150 * 1024 * 1024, document: 25 * 1024 * 1024, icon: 1024 * 1024 };
const WIDTHS = [480, 960, 1600, 2400];

let sharpLib;
async function getSharp() {
  if (sharpLib !== undefined) return sharpLib;
  try { sharpLib = (await import("sharp")).default; } catch { sharpLib = null; }
  return sharpLib;
}

/** Identify a file from its first bytes. */
export function sniff(buf, textHead = "") {
  const b = buf;
  const at = (off, bytes) => bytes.every((x, i) => b[off + i] === x);
  if (b.length >= 3 && at(0, [0xff, 0xd8, 0xff])) return { kind: "image", mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "image", mime: "image/png", ext: "png" };
  if (b.length >= 6 && (b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a")) return { kind: "image", mime: "image/gif", ext: "gif" };
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { kind: "image", mime: "image/webp", ext: "webp" };
  if (b.length >= 12 && b.toString("ascii", 4, 8) === "ftyp") {
    const brand = b.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return { kind: "image", mime: "image/avif", ext: "avif" };
    if (["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "dash", "mmp4"].includes(brand)) return { kind: "video", mime: "video/mp4", ext: "mp4" };
    return null; // heic/quicktime/etc. not accepted
  }
  if (b.length >= 4 && at(0, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "video", mime: "video/webm", ext: "webm" };
  if (b.length >= 5 && b.toString("ascii", 0, 5) === "%PDF-") return { kind: "document", mime: "application/pdf", ext: "pdf" };
  if (b.length >= 4 && at(0, [0x00, 0x00, 0x01, 0x00])) return { kind: "icon", mime: "image/x-icon", ext: "ico" };
  const head = textHead.replace(/^﻿/, "").replace(/^\s+/, "");
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return { kind: "svg", mime: "image/svg+xml", ext: "svg" };
  return null;
}

// ------------------------------------------------------------ SVG sanitizer
const SVG_TAGS = new Set([
  "svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect", "text", "tspan", "textpath",
  "defs", "lineargradient", "radialgradient", "stop", "clippath", "mask", "pattern", "symbol", "use", "title", "desc",
  "filter", "fegaussianblur", "feoffset", "feblend", "fecolormatrix", "fecomposite", "femerge", "femergenode", "feflood", "fedropshadow", "marker",
]);
const SVG_ATTRS = new Set([
  "id", "class", "viewbox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points",
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset",
  "stroke-opacity", "stroke-miterlimit", "opacity", "transform", "offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform",
  "spreadmethod", "fx", "fy", "clip-path", "clip-rule", "mask", "preserveaspectratio", "xmlns", "xmlns:xlink", "version", "font-family",
  "font-size", "font-weight", "text-anchor", "dominant-baseline", "letter-spacing", "patternunits", "patterntransform", "stddeviation",
  "in", "in2", "result", "mode", "values", "type", "dx", "dy", "flood-color", "flood-opacity", "markerwidth", "markerheight", "refx", "refy",
  "orient", "href", "xlink:href", "role", "aria-label", "aria-hidden", "focusable", "style",
]);
const SVG_DROP = new Set(["script", "style", "foreignobject", "iframe", "animate", "animatemotion", "animatetransform", "set", "handler", "listener", "image", "feimage", "object", "embed", "audio", "video", "canvas"]);

export function sanitizeSvg(text) {
  const s = String(text);
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(s)) throw Object.assign(new Error("SVG files with DTD entities are not allowed"), { status: 400 });
  const start = s.search(/<svg[\s>]/i);
  if (start === -1) throw Object.assign(new Error("Not a valid SVG"), { status: 400 });
  let out = "";
  let i = start;
  let skipDepth = 0;
  const skipStack = [];
  const re = /<\/?([a-zA-Z][\w:-]*)([^>]*?)(\/?)>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|([^<]+)/g;
  re.lastIndex = i;
  let m;
  while ((m = re.exec(s))) {
    const [whole, rawName, rawAttrs = "", selfClose, text] = m;
    if (text !== undefined) { if (!skipDepth) out += text.replace(/[<>]/g, ""); continue; }
    if (!rawName) continue; // comment / CDATA dropped
    const name = rawName.toLowerCase();
    const closing = whole.startsWith("</");
    if (skipDepth) {
      if (!closing && !selfClose && name === skipStack[skipStack.length - 1]) skipDepth++;
      else if (closing && name === skipStack[skipStack.length - 1] && --skipDepth === 0) skipStack.pop();
      continue;
    }
    if (!SVG_TAGS.has(name)) {
      // Dangerous containers lose their content; benign unknown tags (e.g.
      // an <a> wrapper) are unwrapped so the drawing inside survives.
      if (SVG_DROP.has(name) && !closing && !selfClose) { skipDepth = 1; skipStack.push(name); }
      continue;
    }
    if (closing) { out += `</${rawName}>`; if (name === "svg" && !/<svg[\s>]/i.test(s.slice(re.lastIndex))) break; continue; }
    const attrs = [];
    const are = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let a;
    while ((a = are.exec(rawAttrs))) {
      const an = a[1].toLowerCase();
      const av = a[3] ?? a[4] ?? a[5] ?? "";
      if (!SVG_ATTRS.has(an) || an.startsWith("on")) continue;
      if ((an === "href" || an === "xlink:href") && !/^#[\w-]+$/.test(av.trim())) continue;
      if (an === "style" && /url\s*\(|expression|javascript|@import|behavior/i.test(av)) continue;
      if (/javascript:|data:(?!image\/(png|jpe?g|gif|webp))/i.test(av)) continue;
      attrs.push(`${a[1]}="${av.replace(/"/g, "&quot;").replace(/</g, "&lt;")}"`);
    }
    out += `<${rawName}${attrs.length ? " " + attrs.join(" ") : ""}${selfClose ? "/" : ""}>`;
  }
  if (!/^<svg/i.test(out)) throw Object.assign(new Error("Not a valid SVG"), { status: 400 });
  return out;
}

function svgSize(svg) {
  const w = /<svg[^>]*\swidth="([\d.]+)(px)?"/i.exec(svg)?.[1];
  const h = /<svg[^>]*\sheight="([\d.]+)(px)?"/i.exec(svg)?.[1];
  if (w && h) return { width: Math.round(+w), height: Math.round(+h) };
  const vb = /<svg[^>]*\sviewBox="[\d.\-]+[\s,]+[\d.\-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/i.exec(svg);
  return vb ? { width: Math.round(+vb[1]), height: Math.round(+vb[2]) } : { width: null, height: null };
}

const slugify = (name) =>
  String(name || "file").replace(/\.[^.]+$/, "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "file";

/** Walk any JSON value and report key paths whose strings mention a URL. */
function findRefs(value, urls, pathSoFar = "", out = []) {
  if (typeof value === "string") {
    if (urls.some((u) => value.includes(u))) out.push(pathSoFar);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => findRefs(v, urls, `${pathSoFar}[${i}]`, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) findRefs(v, urls, pathSoFar ? `${pathSoFar}.${k}` : k, out);
  }
  return out;
}
function replaceRefs(value, map) {
  if (typeof value === "string") {
    let v = value;
    for (const [from, to] of map) if (v.includes(from)) v = v.split(from).join(to);
    return v;
  }
  if (Array.isArray(value)) return value.map((v) => replaceRefs(v, map));
  if (value && typeof value === "object") {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = replaceRefs(v, map);
    return o;
  }
  return value;
}
const urlsOf = (item) => [item.url, item.webp, ...(item.srcset || []).map((s) => s.url), ...(item.versions || []).flatMap((v) => [v.url, v.webp, ...(v.srcset || []).map((s) => s.url)])].filter(Boolean);
const currentUrls = (item) => [item.url, item.webp, ...(item.srcset || []).map((s) => s.url)].filter(Boolean);

export function createMedia({ store, audit, requireAuth, can, content }) {
  const uploadsDir = store.abs("uploads");
  fs.mkdirSync(path.join(uploadsDir, ".tmp"), { recursive: true });
  const load = () => store.readJson(MEDIA, []) || [];
  const save = (list) => store.writeJson(MEDIA, list, { backup: true });

  // --------------------------------------------------------------- receive
  function receive(req) {
    return new Promise((resolve, reject) => {
      let bb;
      try {
        bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: LIMITS.video, fields: 20, fieldSize: 4000 } });
      } catch (e) { return reject(Object.assign(new Error("Expected a file upload"), { status: 400 })); }
      const fields = {};
      let file = null;
      let failed = null;
      let written = Promise.resolve();
      bb.on("field", (name, val) => { fields[name] = String(val).slice(0, 4000); });
      bb.on("file", (_name, stream, info) => {
        const tmp = path.join(uploadsDir, ".tmp", `${crypto.randomBytes(12).toString("hex")}.part`);
        const ws = fs.createWriteStream(tmp);
        const hash = crypto.createHash("sha256");
        let size = 0;
        let head = Buffer.alloc(0);
        stream.on("data", (chunk) => {
          size += chunk.length;
          hash.update(chunk);
          if (head.length < 4096) head = Buffer.concat([head, chunk]).subarray(0, 4096);
        });
        stream.on("limit", () => { failed = Object.assign(new Error("File is too large"), { status: 413 }); });
        written = new Promise((res) => {
          ws.on("finish", () => { file = { tmp, size, head, hash: hash.digest("hex"), originalName: clampStr(info.filename, 200) }; res(); });
          ws.on("error", (e) => { failed = e; fs.rm(tmp, { force: true }, () => {}); res(); });
        });
        stream.pipe(ws);
      });
      bb.on("error", (e) => reject(Object.assign(e, { status: 400 })));
      bb.on("close", () => {
        // Busboy is done parsing; wait until the temp file is fully flushed.
        written.then(() => {
          if (failed) { if (file) fs.rm(file.tmp, { force: true }, () => {}); return reject(failed); }
          if (!file) return reject(Object.assign(new Error("No file received"), { status: 400 }));
          resolve({ file, fields });
        });
      });
      req.pipe(bb);
    });
  }

  // --------------------------------------------------------------- process
  async function processFile({ file, id }) {
    const type = sniff(file.head, file.head.toString("utf8"));
    if (!type) throw Object.assign(new Error("Unsupported file type. Allowed: JPG, PNG, GIF, WebP, AVIF, SVG, ICO, PDF, MP4, WebM"), { status: 415 });
    const limit = LIMITS[type.kind] || LIMITS.image;
    if (file.size > limit) throw Object.assign(new Error(`That ${type.kind} is too large (max ${Math.round(limit / 1048576)} MB)`), { status: 413 });

    const now = new Date();
    const rel = path.posix.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"));
    const dir = path.join(uploadsDir, rel);
    fs.mkdirSync(dir, { recursive: true });
    const base = `${id.slice(2, 12).toLowerCase()}-${crypto.randomBytes(3).toString("hex")}-${slugify(file.originalName)}`;
    const urlOf = (name) => `/uploads/${rel}/${name}`;
    const out = { mime: type.mime, ext: type.ext, kind: type.kind === "svg" || type.kind === "icon" ? "image" : type.kind, width: null, height: null, webp: null, srcset: [], optimized: false };

    if (type.kind === "svg") {
      const clean = sanitizeSvg(fs.readFileSync(file.tmp, "utf8"));
      const name = `${base}.svg`;
      fs.writeFileSync(path.join(dir, name), clean, "utf8");
      Object.assign(out, svgSize(clean), { url: urlOf(name), filename: name, size: Buffer.byteLength(clean) });
      return out;
    }

    const sharp = type.kind === "image" && type.ext !== "gif" && type.ext !== "ico" ? await getSharp() : null;
    const name = `${base}.${type.ext}`;
    const dest = path.join(dir, name);
    if (sharp) {
      const img = sharp(file.tmp, { failOn: "error" });
      const meta = await img.metadata();
      if (!meta.width || !meta.height) throw Object.assign(new Error("Could not read that image"), { status: 400 });
      if (meta.width * meta.height > 60_000_000) throw Object.assign(new Error("Image dimensions are too large"), { status: 400 });
      // Re-encode to apply orientation and drop EXIF/GPS metadata.
      const encoded = sharp(file.tmp).rotate();
      if (type.ext === "jpg") await encoded.jpeg({ quality: 88, mozjpeg: true }).toFile(dest);
      else if (type.ext === "png") await encoded.png({ compressionLevel: 9 }).toFile(dest);
      else if (type.ext === "webp") await encoded.webp({ quality: 88 }).toFile(dest);
      else await encoded.avif({ quality: 60 }).toFile(dest);
      const m2 = await sharp(dest).metadata();
      out.width = m2.width; out.height = m2.height;
      // WebP delivery copy + responsive widths
      const webpName = `${base}.webp`;
      if (type.ext !== "webp") await sharp(dest).webp({ quality: 80 }).toFile(path.join(dir, webpName));
      out.webp = type.ext === "webp" ? urlOf(name) : urlOf(webpName);
      for (const w of WIDTHS) {
        if (w >= out.width) continue;
        const vn = `${base}-${w}.webp`;
        await sharp(dest).resize({ width: w }).webp({ quality: 78 }).toFile(path.join(dir, vn));
        out.srcset.push({ url: urlOf(vn), w });
      }
      out.srcset.push({ url: out.webp, w: out.width });
      out.optimized = true;
      out.size = fs.statSync(dest).size;
      fs.rmSync(file.tmp, { force: true });
    } else {
      fs.renameSync(file.tmp, dest);
      out.size = file.size;
      if (type.ext === "gif") {
        const s = await getSharp();
        if (s) { try { const m = await s(dest, { animated: true }).metadata(); out.width = m.width; out.height = m.pageHeight || m.height; } catch { /* keep null */ } }
      }
    }
    out.url = urlOf(name);
    out.filename = name;
    return out;
  }

  // ---------------------------------------------------------------- usage
  function allDocs() {
    const pub = content.loadPublished();
    const draftIds = content.listDraftIds();
    const ids = new Set([...Object.keys(pub.docs), ...draftIds]);
    const out = [];
    for (const id of ids) {
      if (pub.docs[id]) out.push({ docId: id, where: "live", data: pub.docs[id].data });
      const d = content.loadDraft(id);
      if (d?.data) out.push({ docId: id, where: "draft", data: d.data });
    }
    return out;
  }
  function usageOf(item, docs = allDocs()) {
    const urls = urlsOf(item);
    const uses = [];
    for (const d of docs) {
      const refs = findRefs(d.data, urls);
      if (refs.length) uses.push({ docId: d.docId, where: d.where, keys: refs.slice(0, 20) });
    }
    return uses;
  }

  const publicItem = (m, docs) => {
    const usage = docs ? usageOf(m, docs) : undefined;
    return { ...m, ...(usage ? { usage, usedLive: usage.some((u) => u.where === "live"), usedCount: new Set(usage.map((u) => u.docId)).size } : {}) };
  };

  // ---------------------------------------------------------------- routes
  function registerRoutes(app) {
    // Public file serving
    app.use("/uploads", (req, res, next) => {
      if (req.path.includes("/.tmp") || req.path.includes("..")) return res.status(404).end();
      next();
    }, express.static(uploadsDir, {
      dotfiles: "deny",
      index: false,
      fallthrough: false,
      immutable: true,
      maxAge: "365d",
      setHeaders: (res, filePath) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        if (filePath.endsWith(".svg")) {
          res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
        }
        if (filePath.endsWith(".pdf")) res.setHeader("Content-Disposition", "inline");
      },
    }));

    app.get("/api/admin/media", requireAuth("media.view"), (req, res) => {
      const q = String(req.query.q || "").trim().toLowerCase();
      const type = String(req.query.type || "");
      const folder = req.query.folder != null ? String(req.query.folder) : null;
      const tag = String(req.query.tag || "");
      const trash = req.query.trash === "1";
      const docs = allDocs();
      let list = load().filter((m) => (trash ? !!m.deletedAt : !m.deletedAt));
      if (type) list = list.filter((m) => (type === "svg" ? m.mime === "image/svg+xml" : m.kind === type));
      if (folder !== null && folder !== "") list = list.filter((m) => (m.folder || "") === folder);
      if (tag) list = list.filter((m) => (m.tags || []).includes(tag));
      if (q) list = list.filter((m) => [m.originalName, m.title, m.alt, m.caption, m.description, ...(m.tags || [])].join(" ").toLowerCase().includes(q));
      let items = list.map((m) => publicItem(m, docs));
      if (req.query.unused === "1") items = items.filter((m) => !m.usedCount);
      const sort = String(req.query.sort || "new");
      items.sort((a, b) => sort === "name" ? String(a.originalName).localeCompare(b.originalName) : sort === "size" ? b.size - a.size : Date.parse(b.createdAt) - Date.parse(a.createdAt));
      const all = load().filter((m) => !m.deletedAt);
      res.json({
        ok: true,
        items,
        folders: [...new Set(all.map((m) => m.folder || "").filter(Boolean))].sort(),
        tags: [...new Set(all.flatMap((m) => m.tags || []))].sort(),
        totals: { count: all.length, bytes: all.reduce((n, m) => n + (m.size || 0), 0), trash: load().filter((m) => m.deletedAt).length },
        optimizer: !!(sharpState.available),
      });
    });

    app.post("/api/admin/media", requireAuth("media.upload"), async (req, res, next) => {
      let received;
      try {
        received = await receive(req);
        const { file, fields } = received;
        const id = newId("m_");
        const processed = await processFile({ file, id });
        const list = load();
        const dupe = list.find((m) => !m.deletedAt && m.hash === file.hash);
        const item = {
          id,
          ...processed,
          originalName: file.originalName,
          hash: file.hash,
          alt: clampStr(fields.alt, 300),
          title: clampStr(fields.title || file.originalName.replace(/\.[^.]+$/, ""), 200),
          caption: clampStr(fields.caption, 500),
          description: clampStr(fields.description, 1000),
          folder: cleanFolder(fields.folder),
          tags: cleanTags(fields.tags),
          versions: [],
          uploadedBy: { id: req.user.id, name: req.user.name },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        };
        list.push(item);
        save(list);
        audit.log(req, { action: "media.upload", target: item.originalName, details: { id, mime: item.mime, size: item.size } });
        res.status(201).json({ ok: true, item: publicItem(item, allDocs()), duplicateOf: dupe ? dupe.id : null });
      } catch (e) {
        if (received?.file?.tmp) fs.rm(received.file.tmp, { force: true }, () => {});
        if (e.status) return res.status(e.status).json({ ok: false, error: e.message });
        next(e);
      }
    });

    app.get("/api/admin/media/:id", requireAuth("media.view"), (req, res) => {
      const item = load().find((m) => m.id === req.params.id);
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, item: publicItem(item, allDocs()) });
    });

    app.patch("/api/admin/media/:id", requireAuth("media.edit"), (req, res) => {
      const list = load();
      const item = list.find((m) => m.id === req.params.id);
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      const b = req.body || {};
      if (b.alt != null) item.alt = clampStr(b.alt, 300);
      if (b.title != null) item.title = clampStr(b.title, 200);
      if (b.caption != null) item.caption = clampStr(b.caption, 500);
      if (b.description != null) item.description = clampStr(b.description, 1000);
      if (b.folder != null) item.folder = cleanFolder(b.folder);
      if (b.tags != null) item.tags = cleanTags(b.tags);
      item.updatedAt = new Date().toISOString();
      save(list);
      audit.log(req, { action: "media.update", target: item.originalName, details: { id: item.id } });
      res.json({ ok: true, item: publicItem(item, allDocs()) });
    });

    app.post("/api/admin/media/:id/replace", requireAuth("media.upload"), async (req, res, next) => {
      let received;
      try {
        const list0 = load();
        const cur = list0.find((m) => m.id === req.params.id && !m.deletedAt);
        if (!cur) return res.status(404).json({ ok: false, error: "Not found" });
        received = await receive(req);
        const processed = await processFile({ file: received.file, id: cur.id });
        const list = load();
        const item = list.find((m) => m.id === cur.id);
        const oldUrls = currentUrls(item);
        item.versions = [...(item.versions || []), { url: item.url, webp: item.webp, srcset: item.srcset, width: item.width, height: item.height, replacedAt: new Date().toISOString(), by: req.user.name }].slice(-20);
        Object.assign(item, processed, { hash: received.file.hash, updatedAt: new Date().toISOString() });
        save(list);
        // Point DRAFTS at the new file. Live pages keep the old URL (still
        // served) until someone publishes - so replacing never changes the
        // live site by itself.
        const map = [];
        const newSet = new Map((item.srcset || []).map((s) => [s.w, s.url]));
        const prev = item.versions[item.versions.length - 1];
        if (prev.url) map.push([prev.url, item.url]);
        if (prev.webp && item.webp) map.push([prev.webp, item.webp]);
        for (const s of prev.srcset || []) { const n = newSet.get(s.w) || item.webp || item.url; if (n) map.push([s.url, n]); }
        // only drafts this uploader may edit are switched to the new file
        const touched = content.rewriteWorkingCopies((data) => replaceRefs(data, map), oldUrls, req.user, (docId) => content.canEditDoc(req, docId));
        audit.log(req, { action: "media.replace", target: item.originalName, details: { id: item.id, draftsUpdated: touched } });
        res.json({ ok: true, item: publicItem(item, allDocs()), draftsUpdated: touched });
      } catch (e) {
        if (received?.file?.tmp) fs.rm(received.file.tmp, { force: true }, () => {});
        if (e.status) return res.status(e.status).json({ ok: false, error: e.message });
        next(e);
      }
    });

    app.get("/api/admin/media/:id/usage", requireAuth("media.view"), (req, res) => {
      const item = load().find((m) => m.id === req.params.id);
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      res.json({ ok: true, usage: usageOf(item) });
    });

    // Soft delete -> trash. Files keep serving so nothing live can break.
    app.delete("/api/admin/media/:id", requireAuth("media.delete"), (req, res) => {
      const list = load();
      const item = list.find((m) => m.id === req.params.id && !m.deletedAt);
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      const usage = usageOf(item);
      if (usage.length && req.query.force !== "1") {
        return res.status(409).json({ ok: false, error: "This file is in use", usage, usedLive: usage.some((u) => u.where === "live") });
      }
      item.deletedAt = new Date().toISOString();
      item.deletedBy = req.user.name;
      save(list);
      audit.log(req, { action: "media.trash", target: item.originalName, details: { id: item.id, inUse: usage.length } });
      res.json({ ok: true });
    });

    app.post("/api/admin/media/:id/restore", requireAuth("media.delete"), (req, res) => {
      const list = load();
      const item = list.find((m) => m.id === req.params.id && m.deletedAt);
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      item.deletedAt = null;
      save(list);
      audit.log(req, { action: "media.restore", target: item.originalName });
      res.json({ ok: true, item });
    });

    // Permanent delete - refused while any LIVE page still references it.
    app.delete("/api/admin/media/:id/purge", requireAuth("media.delete"), (req, res) => {
      const list = load();
      const item = list.find((m) => m.id === req.params.id);
      if (!item) return res.status(404).json({ ok: false, error: "Not found" });
      if (!item.deletedAt) return res.status(400).json({ ok: false, error: "Move the file to trash first" });
      const usage = usageOf(item);
      if (usage.some((u) => u.where === "live")) return res.status(409).json({ ok: false, error: "A published page still uses this file - replace it there and publish first", usage });
      if (usage.length && req.query.force !== "1") return res.status(409).json({ ok: false, error: "Drafts still use this file", usage });
      for (const u of urlsOf(item)) {
        if (!u.startsWith("/uploads/")) continue;
        const p = path.join(uploadsDir, u.slice("/uploads/".length));
        if (p.startsWith(uploadsDir)) fs.rmSync(p, { force: true });
      }
      save(list.filter((m) => m.id !== item.id));
      audit.log(req, { action: "media.purge", target: item.originalName, details: { id: item.id } });
      res.json({ ok: true });
    });
  }

  const sharpState = { available: false };
  getSharp().then((s) => { sharpState.available = !!s; });

  return { registerRoutes, load, usageOf };
}

function cleanFolder(v) {
  return String(v || "").trim().replace(/[^A-Za-z0-9 _/-]/g, "").replace(/\/{2,}/g, "/").replace(/^\/|\/$/g, "").slice(0, 80);
}
function cleanTags(v) {
  const arr = Array.isArray(v) ? v : String(v || "").split(",");
  return [...new Set(arr.map((t) => String(t).trim().toLowerCase().replace(/[^a-z0-9 _-]/g, "").slice(0, 30)).filter(Boolean))].slice(0, 20);
}
