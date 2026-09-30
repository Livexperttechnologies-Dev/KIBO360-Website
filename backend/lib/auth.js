import net from "net";
import { hashPassword, verifyPassword, passwordProblem, randomToken, sha256, newId, clampStr } from "./security.js";
import { BUILTIN_ROLES, LEGACY_MAP, PERMISSIONS, PERMISSION_KEYS, cleanPermissionList, effectivePermissions } from "./rbac.js";

export const SUPER_ADMIN_EMAIL = "livexperttechnologies@gmail.com";
const USERS = "users.json";
const ROLES = "roles.json";
const SESSIONS = "sessions.json";
const RESET_MARKER = "admin-reset.json";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_CHANGE_PATHS = new Set(["/api/admin/me", "/api/admin/password", "/api/admin/logout"]);
// The old server shipped this default in its public source - an upgraded
// account still using it must choose a new password.
const OLD_DEFAULT_PASSWORD = "Kibo360@Admin";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmtWait = (ms) => { const m = Math.ceil(ms / 60_000); return m <= 1 ? "a minute" : `${m} minutes`; };

/**
 * A password taken from an environment variable. Values that would silently
 * become something other than what the operator typed (surrounding spaces,
 * a Windows line ending, quotes kept by an env file) are refused loudly.
 */
export function envPassword(name, env = process.env) {
  const raw = env[name];
  if (raw == null || raw === "") return null;
  let problem = null;
  if (raw !== raw.trim()) problem = "it starts or ends with a space or line break";
  else if (/^(["']).*\1$/.test(raw)) problem = "it is wrapped in quotes - remove them";
  else if (/[\x00-\x1F\x7F]/.test(raw)) problem = "it contains control characters";
  else if (raw === OLD_DEFAULT_PASSWORD) problem = "that password is publicly known - choose another";
  else problem = passwordProblem(raw);
  if (problem) { console.error(`[auth] ${name} ignored (${raw.length} characters): ${problem}`); return null; }
  return raw;
}

export function createAuth({ store, audit, sessionTtlMs = 12 * 60 * 60 * 1000 }) {
  const ENV_INITIAL = envPassword("KIBO_ADMIN_PASSWORD");
  const ENV_RESET = envPassword("KIBO_ADMIN_RESET_PASSWORD");
  // Records that a given KIBO_ADMIN_RESET_PASSWORD value was applied - a
  // salted slow hash on the user record (never a fast, guessable digest).
  const resetApplied = (u) => !!(ENV_RESET && u?.resetHash && verifyPassword(ENV_RESET, u.resetHash).ok);
  const hadUsers = (() => { try { const u = store.readJson(USERS, null); return Array.isArray(u) && u.length > 0; } catch { return true; } })();
  // ------------------------------------------------------------------ roles
  function loadRoles() {
    let roles = store.readJson(ROLES, null);
    if (!Array.isArray(roles)) roles = [];
    let changed = false;
    // Seed/refresh built-ins without clobbering admin customisations.
    for (const b of BUILTIN_ROLES) {
      const cur = roles.find((r) => r.id === b.id);
      if (!cur) { roles.push({ ...b, permissions: [...b.permissions] }); changed = true; }
      else if (b.id === "superadmin") {
        // Super admin always has every permission (new permission keys included).
        if (cur.permissions.length !== PERMISSION_KEYS.length) { cur.permissions = [...PERMISSION_KEYS]; changed = true; }
      }
    }
    if (changed) store.writeJson(ROLES, roles);
    return roles;
  }
  const saveRoles = (roles) => store.writeJson(ROLES, roles);

  // ------------------------------------------------------------------ users
  function loadUsers() {
    let users = store.readJson(USERS, null);
    if (!Array.isArray(users) || users.length === 0) {
      // Fresh install: the first password comes from KIBO_ADMIN_PASSWORD, or is
      // generated and printed ONCE to the server log (never a known default).
      const initial = ENV_INITIAL || ENV_RESET || randomToken(9).replace(/[^A-Za-z0-9]/g, "").slice(0, 12) + "a7";
      users = [{
        id: newId("u_"),
        email: SUPER_ADMIN_EMAIL,
        name: "Super Admin",
        passwordHash: hashPassword(initial),
        roleId: "superadmin",
        extraPermissions: [],
        active: true,
        mustChangePassword: true,
        sessionEpoch: 0,
        ...(!ENV_INITIAL && ENV_RESET ? { resetHash: hashPassword(ENV_RESET) } : {}),
        createdAt: new Date().toISOString(),
      }];
      store.writeJson(USERS, users, { backup: true });
      console.log(ENV_INITIAL || ENV_RESET
        ? `[auth] Created super admin ${SUPER_ADMIN_EMAIL} with the password from the environment (must be changed at first sign-in)`
        : `\n[auth] ================================================================\n[auth] Created super admin ${SUPER_ADMIN_EMAIL}\n[auth] Temporary password: ${initial}\n[auth] (shown once - must be changed at first sign-in; lost it? run "npm run admin -- reset-password")\n[auth] ================================================================\n`);
      return users;
    }
    // One-time migration from the legacy {role, permissions:{leads:true...}} shape.
    let migrated = false;
    for (const u of users) {
      if (!u.roleId) {
        u.roleId = u.role === "superadmin" ? "superadmin" : "viewer";
        const extras = new Set();
        for (const [legacy, keys] of Object.entries(LEGACY_MAP)) {
          if (u.permissions?.[legacy]) keys.forEach((k) => extras.add(k));
        }
        u.extraPermissions = [...extras];
        u.active = u.active !== false;
        delete u.role;
        delete u.permissions;
        migrated = true;
      }
    }
    if (migrated) store.writeJson(USERS, users, { backup: true });
    return users;
  }
  const saveUsers = (users) => store.writeJson(USERS, users, { backup: true });
  /**
   * Read -> change one user -> write, synchronously and with nothing slow in
   * between, so a concurrent writer (another request, the recovery CLI) is
   * never overwritten with a stale copy. Hash passwords BEFORE calling this.
   */
  function updateUser(id, fn) {
    const users = loadUsers();
    const u = users.find((x) => x.id === id);
    if (!u) return null;
    fn(u, users);
    saveUsers(users);
    return u;
  }
  let dummyHash = null; // equalises timing for unknown emails
  const dummyCheck = (pw) => { dummyHash ||= hashPassword(randomToken(8)); verifyPassword(pw, dummyHash); };

  const publicUser = (u, roles = loadRoles()) => {
    const role = roles.find((r) => r.id === u.roleId);
    return {
      id: u.id, email: u.email, name: u.name, roleId: u.roleId,
      roleName: role?.name || u.roleId, extraPermissions: u.extraPermissions || [],
      active: u.active !== false, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null,
      mustChangePassword: !!u.mustChangePassword,
      isSuperAdmin: u.roleId === "superadmin",
      permissions: [...effectivePermissions(u, roles)],
    };
  };

  // --------------------------------------------------------------- sessions
  // token -> never stored; we persist sha256(token) so a leaked sessions.json
  // cannot be replayed.
  const sessions = new Map(Object.entries(store.readJson(SESSIONS, {}) || {}));
  const persistSessions = () => {
    const now = Date.now();
    for (const [k, s] of sessions) if (s.exp < now) sessions.delete(k);
    store.writeJson(SESSIONS, Object.fromEntries(sessions));
  };

  let lastPersist = 0;
  function createSession(user, req) {
    const token = randomToken(32);
    sessions.set(sha256(token), {
      userId: user.id,
      epoch: user.sessionEpoch || 0,
      exp: Date.now() + sessionTtlMs,
      createdAt: new Date().toISOString(),
      ip: req.ip || null,
      ua: clampStr(req.headers["user-agent"], 200),
    });
    persistSessions();
    return token;
  }
  function revokeUserSessions(userId, exceptHash = null) {
    for (const [k, s] of sessions) if (s.userId === userId && k !== exceptHash) sessions.delete(k);
    persistSessions();
  }

  function authenticate(req) {
    const header = req.headers.authorization || "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token || token.length > 200) return null;
    const hash = sha256(token);
    const sess = sessions.get(hash);
    if (!sess) return null;
    const now = Date.now();
    if (sess.exp < now) { sessions.delete(hash); return null; }
    const user = loadUsers().find((u) => u.id === sess.userId);
    if (!user || user.active === false) return null;
    // A reset from the server console / environment bumps sessionEpoch and
    // so signs out older sessions - no clocks involved, no restart needed
    // (users.json is read per request).
    if ((sess.epoch || 0) !== (user.sessionEpoch || 0)) { sessions.delete(hash); return null; }
    // Sliding expiry: an active editor isn't signed out mid-work (idle
    // timeout = the TTL), but no session lives longer than 7 days.
    if (sess.exp - now < sessionTtlMs / 2) {
      const next = Math.min(now + sessionTtlMs, (Date.parse(sess.createdAt) || now) + 7 * 86400_000);
      if (next > sess.exp) { sess.exp = next; if (now - lastPersist > 60_000) { lastPersist = now; persistSessions(); } }
    }
    return { user, hash };
  }

  /** Middleware. perm: undefined | "key" | ["any", "of"] */
  function requireAuth(perm) {
    const needed = perm == null ? [] : Array.isArray(perm) ? perm : [perm];
    return (req, res, next) => {
      let a;
      try { a = authenticate(req); } catch (e) { return next(e); }
      if (!a) return res.status(401).json({ ok: false, error: "Not signed in" });
      // A temporary password only unlocks "choose your own password".
      if (a.user.mustChangePassword && !PASSWORD_CHANGE_PATHS.has(req.path)) {
        return res.status(403).json({ ok: false, code: "PASSWORD_CHANGE_REQUIRED", error: "Please choose a new password first" });
      }
      const perms = effectivePermissions(a.user, loadRoles());
      if (needed.length && !needed.some((p) => perms.has(p))) {
        return res.status(403).json({ ok: false, error: "You don't have permission for this action" });
      }
      req.user = a.user;
      req.perms = perms;
      req.sessionHash = a.hash;
      next();
    };
  }
  const can = (req, perm) => !!req.perms?.has(perm);

  // ------------------------------------------------------------ throttling
  // Hard limits only per network (IP) and per email+network. Guessing one
  // account from many networks is slowed down (attempts queue up), never
  // locked: a hard per-email lock would let anyone keep the owner out.
  const failures = new Map(); // key -> { count, reset }
  const gates = new Map();    // email -> time the next attempt may run
  const pending = new Map();  // key -> attempts still being processed (queued)
  const current = (key) => { const r = failures.get(key); return r && Date.now() <= r.reset ? r : null; };
  /** ms until `key` may try again (failures + attempts still in flight count). */
  const retryAfter = (key, max) => {
    const r = current(key);
    if ((r?.count || 0) + (pending.get(key) || 0) < max) return 0;
    return r ? r.reset - Date.now() : 30_000;
  };
  const hold = (keys, delta) => { for (const k of keys) { const n = (pending.get(k) || 0) + delta; if (n > 0) pending.set(k, n); else pending.delete(k); } };
  const fail = (key, windowMs) => {
    const now = Date.now();
    let rec = failures.get(key);
    if (!rec || now > rec.reset) { rec = { count: 0, reset: now + windowMs }; failures.set(key, rec); }
    rec.count += 1;
    if (failures.size > 20000) {
      // evict expired entries, then the oldest - never wipe every lockout
      for (const [k, v] of failures) if (now > v.reset) failures.delete(k);
      for (const k of failures.keys()) { if (failures.size <= 15000) break; failures.delete(k); }
    }
  };
  /**
   * Place in the per-email queue. Returns the wait and a commit() that takes
   * the slot - called only when the attempt is accepted, so refused attempts
   * never push the queue further out. Spacing tops out at 8s, so one network
   * (max 5 attempts per email) can't fill the 45s queue on its own.
   */
  const planQueue = (email) => {
    const fails = current(`em:${email}`)?.count || 0;
    if (fails <= 10) { gates.delete(email); return { wait: 0, commit: () => {} }; }
    const now = Date.now();
    const start = Math.max(now, gates.get(email) || 0);
    return {
      wait: start - now,
      commit: () => {
        gates.set(email, start + Math.min(8000, (fails - 10) * 500));
        if (gates.size > 5000) for (const [k, v] of gates) if (v < now) gates.delete(k);
      },
    };
  };
  /** Client network: an IPv6 address counts as its /64 (one household or server). */
  function netOf(ip) {
    const a = String(ip || "unknown").replace(/^::ffff:(?=\d+\.)/i, "");
    if (!net.isIPv6(a)) return a;
    const [head, tail = ""] = a.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
    return `${full.slice(0, 4).map((x) => x.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
  }

  // ------------------------------------------------- recovery via env var
  // KIBO_ADMIN_RESET_PASSWORD=... on the next start sets that as the Super
  // Admin's TEMPORARY password (must be changed at sign-in). Applied once per
  // value: the fingerprint is kept both in admin-reset.json and on the user
  // record, so a restart (or a lost marker file) does not reset it again.
  (function startupAccountChecks() {
    if (process.env.KIBO_ADMIN_PASSWORD && hadUsers) {
      console.log("[auth] KIBO_ADMIN_PASSWORD only applies to a brand-new data folder - to reset a password run: npm run admin -- reset-password");
    }
    // older builds kept a fast digest here - drop it
    try { store.remove(RESET_MARKER); } catch { /* not there */ }
    if (!ENV_RESET) return;
    const users = loadUsers();
    let su = users.find((u) => u.roleId === "superadmin") || users.find((u) => String(u.email || "").toLowerCase() === SUPER_ADMIN_EMAIL);
    if (resetApplied(su)) {
      console.warn("[auth] KIBO_ADMIN_RESET_PASSWORD is still set (already applied). Remove it from the server environment now.");
      return;
    }
    const hash = hashPassword(ENV_RESET);
    if (!su) {
      su = { id: newId("u_"), email: SUPER_ADMIN_EMAIL, name: "Super Admin", roleId: "superadmin", extraPermissions: [], createdAt: new Date().toISOString() };
      users.push(su);
    }
    su.roleId = "superadmin";
    su.passwordHash = hash;
    su.mustChangePassword = true;
    su.active = true;
    su.sessionEpoch = (su.sessionEpoch || 0) + 1;
    su.resetHash = hashPassword(ENV_RESET);
    delete su.resetFingerprint;
    su.passwordChangedAt = new Date().toISOString();
    delete su.sessionsNotBefore;
    saveUsers(users);
    audit.log(null, { action: "auth.password_reset_env", target: su.email, actor: { name: "Server environment" } });
    console.warn(`[auth] Super Admin password for ${su.email} was reset from KIBO_ADMIN_RESET_PASSWORD - sign in, choose a new password, then REMOVE the variable.`);
  })();

  // ----------------------------------------------------------------- routes
  function registerRoutes(app) {
    app.post("/api/admin/login", async (req, res, next) => {
      try {
        const ip = req.ip || "unknown";
        const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 200);
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        if (!email || !password) return res.status(400).json({ ok: false, error: "Enter your email and password" });
        const network = netOf(ip);
        const ipKey = `ip:${network}`;
        const pairKey = `pair:${email}|${network}`;
        const emKey = `em:${email}`;
        const blocked = Math.max(retryAfter(ipKey, 8), retryAfter(pairKey, 5));
        if (blocked) {
          res.setHeader("Retry-After", String(Math.ceil(blocked / 1000)));
          return res.status(429).json({ ok: false, error: `Too many failed attempts from this network. Try again in ${fmtWait(blocked)} (or restart the server).` });
        }
        const slot = planQueue(email);
        if (slot.wait > 45_000) {
          res.setHeader("Retry-After", String(Math.ceil(slot.wait / 1000)));
          return res.status(429).json({ ok: false, error: "This account is receiving many sign-in attempts right now. Try again in a minute (or restart the server)." });
        }
        slot.commit();
        // queued attempts count against the network limits while they wait
        hold([ipKey, pairKey], 1);
        let user, check;
        try {
          if (slot.wait) await sleep(slot.wait);
          user = loadUsers().find((u) => String(u.email || "").toLowerCase() === email);
          check = user ? verifyPassword(password, user.passwordHash) : (dummyCheck(password), { ok: false });
          // old-format hashes verify fast - add the scrypt cost so timing doesn't tell
          if (user && !String(user.passwordHash || "").startsWith("scrypt$")) dummyCheck(password);
        } finally {
          hold([ipKey, pairKey], -1);
        }
        if (!user || !check.ok || user.active === false) {
          fail(ipKey, 10 * 60_000);
          fail(pairKey, 15 * 60_000);
          fail(emKey, 60 * 60_000);
          audit.log(req, { action: "auth.login_failed", target: email, actor: { email } });
          return res.status(401).json({ ok: false, error: "Invalid email or password" });
        }
        failures.delete(ipKey);
        failures.delete(pairKey);
        failures.delete(emKey);
        gates.delete(email);
        const newHash = check.needsRehash ? hashPassword(password) : null;
        const saved = updateUser(user.id, (u) => {
          if (newHash && u.passwordHash === user.passwordHash) u.passwordHash = newHash;
          if (password === OLD_DEFAULT_PASSWORD) u.mustChangePassword = true; // published in the old source
          u.lastLoginAt = new Date().toISOString();
        }) || user;
        const token = createSession(saved, req);
        audit.log(req, { action: "auth.login", target: saved.email, actor: saved });
        res.json({ ok: true, token, user: publicUser(saved) });
      } catch (e) { next(e); }
    });

    app.post("/api/admin/logout", requireAuth(), (req, res) => {
      sessions.delete(req.sessionHash);
      persistSessions();
      audit.log(req, { action: "auth.logout", target: req.user.email });
      res.json({ ok: true });
    });

    app.get("/api/admin/me", requireAuth(), (req, res) => {
      res.json({ ok: true, user: publicUser(req.user) });
    });

    app.post("/api/admin/password", requireAuth(), (req, res) => {
      const { current, next } = req.body || {};
      const problem = passwordProblem(next);
      if (problem) return res.status(400).json({ ok: false, error: problem });
      if (next === OLD_DEFAULT_PASSWORD) return res.status(400).json({ ok: false, error: "That password is publicly known - choose a different one" });
      if (String(next) === String(current || "")) return res.status(400).json({ ok: false, error: "Choose a new password that is different from the current one" });
      const me = loadUsers().find((u) => u.id === req.user.id);
      if (!me || !verifyPassword(String(current || ""), me.passwordHash).ok) {
        return res.status(400).json({ ok: false, error: "Current password is incorrect" });
      }
      const newHash = hashPassword(String(next));
      const saved = updateUser(me.id, (u) => {
        u.passwordHash = newHash;
        u.mustChangePassword = false;
        u.passwordChangedAt = new Date().toISOString();
      });
      revokeUserSessions(me.id, req.sessionHash); // sign out other devices
      audit.log(req, { action: "auth.password_changed", target: me.email });
      res.json({ ok: true, user: publicUser(saved || me) });
    });

    // ------------------------------------------------------ team (users)
    app.get("/api/admin/users", requireAuth("users.manage"), (req, res) => {
      const roles = loadRoles();
      res.json({ ok: true, users: loadUsers().map((u) => publicUser(u, roles)) });
    });

    // Without these checks "users.manage" alone could take over a stronger
    // account (reset its password) or hand out rights the actor lacks.
    const isSuper = (req) => req.user.roleId === "superadmin";
    const within = (req, perms) => isSuper(req) || [...perms].every((p) => req.perms.has(p));
    const rolePerms = (roles, roleId) => new Set(roles.find((r) => r.id === roleId)?.permissions || []);

    app.post("/api/admin/users", requireAuth("users.manage"), (req, res) => {
      const b = req.body || {};
      const email = String(b.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 200) return res.status(400).json({ ok: false, error: "A valid email is required" });
      const problem = passwordProblem(b.password);
      if (problem) return res.status(400).json({ ok: false, error: problem });
      const roles = loadRoles();
      const roleId = String(b.roleId || "viewer");
      if (roleId === "superadmin") return res.status(400).json({ ok: false, error: "The Super Admin role belongs to the owner account only" });
      if (!roles.some((r) => r.id === roleId)) return res.status(400).json({ ok: false, error: "Unknown role" });
      if (!within(req, rolePerms(roles, roleId)) || !within(req, cleanPermissionList(b.extraPermissions))) {
        return res.status(403).json({ ok: false, error: "You can't give someone permissions you don't have yourself" });
      }
      const passwordHash = hashPassword(String(b.password)); // before the read-modify-write
      const users = loadUsers();
      if (users.some((u) => String(u.email || "").toLowerCase() === email)) return res.status(400).json({ ok: false, error: "A user with this email already exists" });
      const user = {
        id: newId("u_"),
        email,
        name: clampStr(b.name, 120).trim() || email.split("@")[0],
        passwordHash,
        roleId,
        extraPermissions: req.perms.has("roles.manage") ? cleanPermissionList(b.extraPermissions) : [],
        active: true,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      saveUsers(users);
      audit.log(req, { action: "user.create", target: email, details: { roleId } });
      res.status(201).json({ ok: true, user: publicUser(user, roles) });
    });

    app.patch("/api/admin/users/:id", requireAuth("users.manage"), (req, res) => {
      if (req.body?.password) {
        const problem = passwordProblem(req.body.password);
        if (problem) return res.status(400).json({ ok: false, error: problem });
      }
      const newHash = req.body?.password ? hashPassword(String(req.body.password)) : null; // before the read-modify-write
      const users = loadUsers();
      const user = users.find((u) => u.id === req.params.id);
      if (!user) return res.status(404).json({ ok: false, error: "User not found" });
      const b = req.body || {};
      const roles = loadRoles();
      const changes = {};
      if (user.id !== req.user.id && !within(req, effectivePermissions(user, roles))) {
        return res.status(403).json({ ok: false, error: "You can't manage someone with more rights than you" });
      }
      if (user.id === req.user.id && b.roleId != null && b.roleId !== user.roleId) {
        return res.status(400).json({ ok: false, error: "You can't change your own role" });
      }
      if (b.roleId != null && b.roleId !== user.roleId && !within(req, rolePerms(roles, b.roleId))) {
        return res.status(403).json({ ok: false, error: "You can't assign a role with permissions you don't have" });
      }
      if (b.extraPermissions != null && !within(req, cleanPermissionList(b.extraPermissions))) {
        return res.status(403).json({ ok: false, error: "You can't grant permissions you don't have" });
      }
      if (user.roleId === "superadmin") {
        if (b.roleId && b.roleId !== "superadmin") return res.status(400).json({ ok: false, error: "The Super Admin role cannot be changed" });
        if (b.active === false) return res.status(400).json({ ok: false, error: "The Super Admin cannot be deactivated" });
        if (b.password && req.user.id !== user.id) return res.status(403).json({ ok: false, error: "Only the Super Admin can change their own password" });
      }
      if (b.name != null) { user.name = clampStr(b.name, 120).trim() || user.name; changes.name = user.name; }
      if (b.roleId != null && user.roleId !== "superadmin") {
        if (b.roleId === "superadmin") return res.status(400).json({ ok: false, error: "The Super Admin role belongs to the owner account only" });
        if (!roles.some((r) => r.id === b.roleId)) return res.status(400).json({ ok: false, error: "Unknown role" });
        user.roleId = b.roleId; changes.roleId = b.roleId;
      }
      if (b.extraPermissions != null && user.roleId !== "superadmin") {
        if (!req.perms.has("roles.manage")) return res.status(403).json({ ok: false, error: "Changing individual permissions requires role management rights" });
        user.extraPermissions = cleanPermissionList(b.extraPermissions); changes.extraPermissions = user.extraPermissions;
      }
      if (b.active != null && user.id !== req.user.id) {
        user.active = !!b.active; changes.active = user.active;
        if (!user.active) revokeUserSessions(user.id);
      }
      if (b.password && user.id === req.user.id) {
        return res.status(400).json({ ok: false, error: "Change your own password under My Account" });
      }
      if (b.password) {
        user.passwordHash = newHash;
        user.mustChangePassword = user.id !== req.user.id;
        revokeUserSessions(user.id, user.id === req.user.id ? req.sessionHash : null);
        changes.password = "reset";
      }
      user.updatedAt = new Date().toISOString();
      saveUsers(users);
      audit.log(req, { action: "user.update", target: user.email, details: changes });
      res.json({ ok: true, user: publicUser(user, roles) });
    });

    app.delete("/api/admin/users/:id", requireAuth("users.manage"), (req, res) => {
      const users = loadUsers();
      const user = users.find((u) => u.id === req.params.id);
      if (!user) return res.status(404).json({ ok: false, error: "User not found" });
      if (user.roleId === "superadmin") return res.status(400).json({ ok: false, error: "The Super Admin account cannot be deleted" });
      if (user.id === req.user.id) return res.status(400).json({ ok: false, error: "You cannot delete your own account" });
      if (!within(req, effectivePermissions(user, loadRoles()))) return res.status(403).json({ ok: false, error: "You can't remove someone with more rights than you" });
      saveUsers(users.filter((u) => u.id !== user.id));
      revokeUserSessions(user.id);
      audit.log(req, { action: "user.delete", target: user.email });
      res.json({ ok: true });
    });

    // ------------------------------------------------------------- roles
    app.get("/api/admin/roles", requireAuth(["roles.manage", "users.manage"]), (req, res) => {
      const users = loadUsers();
      const roles = loadRoles().map((r) => ({ ...r, userCount: users.filter((u) => u.roleId === r.id).length }));
      res.json({ ok: true, roles, permissions: PERMISSIONS });
    });

    const cleanRoleInput = (b) => ({
      name: clampStr(b.name, 60).trim(),
      description: clampStr(b.description, 300).trim(),
      permissions: cleanPermissionList(b.permissions),
    });

    app.post("/api/admin/roles", requireAuth("roles.manage"), (req, res) => {
      const input = cleanRoleInput(req.body || {});
      if (!input.name) return res.status(400).json({ ok: false, error: "Role name is required" });
      const roles = loadRoles();
      if (roles.some((r) => r.name.toLowerCase() === input.name.toLowerCase())) return res.status(400).json({ ok: false, error: "A role with this name already exists" });
      const role = { id: newId("r_"), ...input, builtin: false, createdAt: new Date().toISOString() };
      roles.push(role);
      saveRoles(roles);
      audit.log(req, { action: "role.create", target: role.name, details: { permissions: role.permissions } });
      res.status(201).json({ ok: true, role });
    });

    app.patch("/api/admin/roles/:id", requireAuth("roles.manage"), (req, res) => {
      const roles = loadRoles();
      const role = roles.find((r) => r.id === req.params.id);
      if (!role) return res.status(404).json({ ok: false, error: "Role not found" });
      if (role.locked) return res.status(400).json({ ok: false, error: "The Super Admin role cannot be modified" });
      const input = cleanRoleInput({ ...role, ...req.body });
      if (!input.name) return res.status(400).json({ ok: false, error: "Role name is required" });
      Object.assign(role, input, { updatedAt: new Date().toISOString() });
      saveRoles(roles);
      audit.log(req, { action: "role.update", target: role.name, details: { permissions: role.permissions } });
      res.json({ ok: true, role });
    });

    app.delete("/api/admin/roles/:id", requireAuth("roles.manage"), (req, res) => {
      const roles = loadRoles();
      const role = roles.find((r) => r.id === req.params.id);
      if (!role) return res.status(404).json({ ok: false, error: "Role not found" });
      if (role.builtin) return res.status(400).json({ ok: false, error: "Built-in roles can be edited but not deleted" });
      if (loadUsers().some((u) => u.roleId === role.id)) return res.status(400).json({ ok: false, error: "Reassign the users in this role before deleting it" });
      saveRoles(roles.filter((r) => r.id !== role.id));
      audit.log(req, { action: "role.delete", target: role.name });
      res.json({ ok: true });
    });
  }

  // Seed on boot so a fresh deployment always has its owner account.
  loadRoles();
  loadUsers();

  /** Current permissions of a user id (null = gone or deactivated). */
  function permissionsOf(userId) {
    const u = loadUsers().find((x) => x.id === userId);
    return u && u.active !== false ? effectivePermissions(u, loadRoles()) : null;
  }

  return { requireAuth, can, loadUsers, loadRoles, publicUser, registerRoutes, authenticate, permissionsOf };
}
