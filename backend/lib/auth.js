import { hashPassword, verifyPassword, passwordProblem, randomToken, sha256, newId, clampStr } from "./security.js";
import { BUILTIN_ROLES, LEGACY_MAP, PERMISSIONS, PERMISSION_KEYS, cleanPermissionList, effectivePermissions } from "./rbac.js";

export const SUPER_ADMIN_EMAIL = "livexperttechnologies@gmail.com";
const USERS = "users.json";
const ROLES = "roles.json";
const SESSIONS = "sessions.json";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_CHANGE_PATHS = new Set(["/api/admin/me", "/api/admin/password", "/api/admin/logout"]);

export function createAuth({ store, audit, sessionTtlMs = 12 * 60 * 60 * 1000 }) {
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
      const initial = process.env.KIBO_ADMIN_PASSWORD || randomToken(9).replace(/[^A-Za-z0-9]/g, "").slice(0, 12) + "a7";
      users = [{
        id: newId("u_"),
        email: SUPER_ADMIN_EMAIL,
        name: "Super Admin",
        passwordHash: hashPassword(initial),
        roleId: "superadmin",
        extraPermissions: [],
        active: true,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
      }];
      store.writeJson(USERS, users, { backup: true });
      console.log(process.env.KIBO_ADMIN_PASSWORD
        ? `[auth] Created super admin ${SUPER_ADMIN_EMAIL} with the password from KIBO_ADMIN_PASSWORD (must be changed at first sign-in)`
        : `[auth] Created super admin ${SUPER_ADMIN_EMAIL} - temporary password: ${initial} (shown once; must be changed at first sign-in)`);
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
  const failures = new Map(); // key -> { count, reset }
  const tooMany = (key, max, windowMs) => {
    const now = Date.now();
    const rec = failures.get(key);
    if (!rec || now > rec.reset) return false;
    return rec.count >= max;
  };
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

  // ----------------------------------------------------------------- routes
  function registerRoutes(app) {
    app.post("/api/admin/login", (req, res) => {
      const ip = req.ip || "unknown";
      const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 200);
      if (tooMany(`ip:${ip}`, 8, 10 * 60_000) || tooMany(`em:${email}`, 20, 60 * 60_000)) {
        return res.status(429).json({ ok: false, error: "Too many attempts. Try again in a few minutes." });
      }
      const users = loadUsers();
      const user = users.find((u) => u.email.toLowerCase() === email);
      const check = user ? verifyPassword(String(req.body?.password || ""), user.passwordHash) : { ok: false };
      if (!user || !check.ok || user.active === false) {
        fail(`ip:${ip}`, 10 * 60_000);
        if (email) fail(`em:${email}`, 60 * 60_000);
        audit.log(req, { action: "auth.login_failed", target: email || "(blank)", actor: { email } });
        return res.status(401).json({ ok: false, error: "Invalid email or password" });
      }
      failures.delete(`ip:${ip}`);
      if (check.needsRehash) user.passwordHash = hashPassword(String(req.body.password));
      user.lastLoginAt = new Date().toISOString();
      saveUsers(users);
      const token = createSession(user, req);
      audit.log(req, { action: "auth.login", target: user.email, actor: user });
      res.json({ ok: true, token, user: publicUser(user) });
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
      const users = loadUsers();
      const me = users.find((u) => u.id === req.user.id);
      if (!verifyPassword(String(current || ""), me.passwordHash).ok) {
        return res.status(400).json({ ok: false, error: "Current password is incorrect" });
      }
      me.passwordHash = hashPassword(String(next));
      me.mustChangePassword = false;
      me.passwordChangedAt = new Date().toISOString();
      saveUsers(users);
      revokeUserSessions(me.id, req.sessionHash); // sign out other devices
      audit.log(req, { action: "auth.password_changed", target: me.email });
      res.json({ ok: true });
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
      const users = loadUsers();
      if (users.some((u) => u.email.toLowerCase() === email)) return res.status(400).json({ ok: false, error: "A user with this email already exists" });
      const user = {
        id: newId("u_"),
        email,
        name: clampStr(b.name, 120).trim() || email.split("@")[0],
        passwordHash: hashPassword(String(b.password)),
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
      if (b.password) {
        const problem = passwordProblem(b.password);
        if (problem) return res.status(400).json({ ok: false, error: problem });
        user.passwordHash = hashPassword(String(b.password));
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
