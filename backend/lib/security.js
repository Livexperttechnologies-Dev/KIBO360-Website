import crypto from "crypto";
import net from "net";

// ---------------------------------------------------------------------------
// Passwords: scrypt with a per-user random salt. Hashes written by the old
// server (peppered SHA-256) still verify, and are transparently upgraded to
// scrypt on the next successful login (needsRehash).
// ---------------------------------------------------------------------------

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const legacySha = (s) => crypto.createHash("sha256").update("kibo360::" + String(s)).digest("hex");

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored) return { ok: false };
  if (stored.startsWith("scrypt$")) {
    const [, N, r, p, saltB64, hashB64] = stored.split("$");
    const expected = Buffer.from(hashB64 || "", "base64");
    let actual;
    try {
      actual = crypto.scryptSync(String(password), Buffer.from(saltB64 || "", "base64"), expected.length, {
        N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
      });
    } catch {
      return { ok: false };
    }
    const ok = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    return { ok, needsRehash: false };
  }
  // Legacy peppered SHA-256 (hex)
  const a = Buffer.from(legacySha(password), "utf8");
  const b = Buffer.from(stored, "utf8");
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, needsRehash: ok };
}

export function passwordProblem(pw) {
  const s = String(pw || "");
  if (s.length < 10) return "Password must be at least 10 characters";
  if (s.length > 200) return "Password is too long";
  if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) return "Password must contain letters and numbers";
  return null;
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
export const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
export const newId = (prefix = "") => `${prefix}${crypto.randomBytes(9).toString("base64url")}`;

// ---------------------------------------------------------------------------
// Rate limiting (fixed window, in-memory, per key). Returns a middleware.
// ---------------------------------------------------------------------------

export function rateLimit({ windowMs, max, key = (req) => req.ip || "unknown", message = "Too many requests. Please slow down." }) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }, Math.max(30_000, windowMs)).unref();
  const mw = (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let rec = hits.get(k);
    if (!rec || now > rec.reset) { rec = { count: 0, reset: now + windowMs }; hits.set(k, rec); }
    rec.count += 1;
    if (hits.size > 50_000) hits.clear(); // memory guard against key floods
    if (rec.count > max) {
      res.setHeader("Retry-After", Math.ceil((rec.reset - now) / 1000));
      return res.status(429).json({ ok: false, error: message });
    }
    next();
  };
  mw.stop = () => clearInterval(sweep);
  return mw;
}

// ---------------------------------------------------------------------------
// URL safety - used for every href/src stored by the CMS.
// ---------------------------------------------------------------------------

const CONTROL = new RegExp("[\x00-\x1F\x7F-\x9F" + String.fromCharCode(0x2028, 0x2029) + "]", "g");

export function safeUrl(value, { allowRelative = true, allowMailto = true, allowTel = true, allowHash = true, allowData = false } = {}) {
  if (value == null) return null;
  const v = String(value).replace(CONTROL, "").trim();
  if (!v) return null;
  if (v.length > 2048) return null;
  if (allowHash && v.startsWith("#")) return /^#[A-Za-z0-9_\-:.]*$/.test(v) ? v : null;
  if (allowRelative && v.startsWith("/") && !v.startsWith("//")) {
    return /^\/[^\s<>"'`\\]*$/.test(v) ? v : null;
  }
  let u;
  try { u = new URL(v); } catch { return null; }
  const proto = u.protocol.toLowerCase();
  if (proto === "https:" || proto === "http:") return u.toString();
  if (allowMailto && proto === "mailto:") return v;
  if (allowTel && proto === "tel:") return /^tel:[+0-9\-\s()]{3,30}$/i.test(v) ? v : null;
  if (allowData && proto === "data:" && /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return v;
  return null;
}

export function clampStr(v, max = 500) {
  if (v == null) return "";
  return String(v).replace(CONTROL, " ").slice(0, max);
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Security headers for API responses.
// ---------------------------------------------------------------------------

export function apiSecurityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}

// ---------------------------------------------------------------------------
// Private-network detection (SSRF guard for the link checker).
// ---------------------------------------------------------------------------

// Addresses a server-side fetch must never reach. Uses net.BlockList so
// every textual form is covered (e.g. [::ffff:7f00:1] = 127.0.0.1). All
// IPv6 ranges that embed an IPv4 address (mapped, compatible, NAT64, 6to4,
// Teredo) are refused outright.
const PRIVATE4 = new net.BlockList();
const PRIVATE6 = new net.BlockList(); // separate lists: a BlockList matches IPv4 against ::ffff:0:0/96 rules
for (const [a, p] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]]) PRIVATE4.addSubnet(a, p, "ipv4");
for (const [a, p] of [["::", 96], ["::ffff:0:0", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8]]) PRIVATE6.addSubnet(a, p, "ipv6");
export function isPrivateAddress(ip) {
  const v = net.isIP(String(ip || "").replace(/^[|]$/g, ""));
  if (!v) return true; // not an IP at all: refuse
  const addr = String(ip).replace(/^[|]$/g, "");
  try { return v === 4 ? PRIVATE4.check(addr, "ipv4") : PRIVATE6.check(addr, "ipv6"); } catch { return true; }
}
