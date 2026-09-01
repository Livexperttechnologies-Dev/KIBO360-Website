import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5001;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "submissions.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Peppered hash - not a substitute for bcrypt at scale, but fine for a small
// internal admin; the pepper keeps raw rainbow-table lookups off the table.
const sha256 = (s) => crypto.createHash("sha256").update("kibo360::" + String(s)).digest("hex");

// ---------------------------------------------------------------------------
// Stores (simple JSON files)
// ---------------------------------------------------------------------------

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

const DEFAULT_SETTINGS = {
  whatsapp: {
    enabled: true,
    number: "918008005672", // digits only, country code first
    greeting: "Hi! I'd like to know more about KIBO360.",
  },
  chatbot: {
    enabled: true,
    botName: "Kibo Assistant",
    welcome: "Hi! I'm the Kibo360 assistant. Ask me about our products, demos or support - or pick an option below.",
    customFaqs: [], // [{ q, keywords, a }]
  },
  notifications: {
    smtp: { host: "", port: 587, user: "", pass: "", from: "" },
    teamEmails: ["info@livexperttechnologies.com"],
    notifyTeam: true,
    visitorAutoReply: true,
    visitorSubject: "Thanks for contacting KIBO360",
    visitorMessage:
      "Hi {name},\n\nThanks for reaching out to KIBO360. Our team has received your message and will get back to you within one business day.\n\n- Team KIBO360, Livexpert Technologies",
  },
};

const SUPER_ADMIN_EMAIL = "livexperttechnologies@gmail.com";

function loadSettings() {
  const s = readJson(SETTINGS_FILE, null);
  if (!s) { writeJson(SETTINGS_FILE, DEFAULT_SETTINGS); return { ...DEFAULT_SETTINGS }; }
  return { ...DEFAULT_SETTINGS, ...s };
}
function loadUsers() {
  let users = readJson(USERS_FILE, null);
  if (!users || !Array.isArray(users) || users.length === 0) {
    users = [{
      id: crypto.randomUUID(),
      email: SUPER_ADMIN_EMAIL,
      name: "Super Admin",
      passwordHash: sha256("Kibo360@Admin"), // change after first login!
      role: "superadmin",
      permissions: { leads: true, whatsapp: true, chatbot: true, notifications: true },
      createdAt: new Date().toISOString(),
    }];
    writeJson(USERS_FILE, users);
    console.log(`[auth] Seeded super admin ${SUPER_ADMIN_EMAIL} (default password: Kibo360@Admin - change it after first login)`);
  }
  return users;
}

const loadSubmissions = () => readJson(DATA_FILE, []);
const saveSubmissions = (list) => writeJson(DATA_FILE, list);

// ---------------------------------------------------------------------------
// Auth: token sessions (in-memory, 12h)
// ---------------------------------------------------------------------------

const sessions = new Map(); // token -> { userId, exp }
const SESSION_TTL = 12 * 60 * 60 * 1000;

function authUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const sess = sessions.get(token);
  if (!sess || sess.exp < Date.now()) { sessions.delete(token); return null; }
  const user = loadUsers().find((u) => u.id === sess.userId);
  return user || null;
}
function requireAuth(permission) {
  return (req, res, next) => {
    const user = authUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Not signed in" });
    if (permission && user.role !== "superadmin" && !user.permissions?.[permission]) {
      return res.status(403).json({ ok: false, error: "No access to this section" });
    }
    req.user = user;
    next();
  };
}
const requireSuperAdmin = (req, res, next) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ ok: false, error: "Not signed in" });
  if (user.role !== "superadmin") return res.status(403).json({ ok: false, error: "Super admin only" });
  req.user = user;
  next();
};

// ---------------------------------------------------------------------------
// Email notifications (best-effort; skipped when SMTP is not configured)
// ---------------------------------------------------------------------------

async function sendNotifications(submission) {
  const { notifications } = loadSettings();
  const smtp = notifications?.smtp || {};
  if (!smtp.host || !smtp.user) return; // not configured
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 587,
      secure: Number(smtp.port) === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    const from = smtp.from || smtp.user;
    if (notifications.notifyTeam && notifications.teamEmails?.length) {
      await transport.sendMail({
        from,
        to: notifications.teamEmails.join(","),
        subject: `New KIBO360 lead: ${submission.name} (${submission.product})`,
        text:
          `New enquiry received on kibo360.in\n\n` +
          `Name: ${submission.name}\nEmail: ${submission.email}\nPhone: ${submission.phone || "-"}\n` +
          `Organization: ${submission.organization || "-"}\nInterest: ${submission.product}\n\n` +
          `Message:\n${submission.message}\n\nReceived: ${submission.receivedAt}`,
      }).catch((e) => console.error("[mail] team notify failed:", e.message));
    }
    if (notifications.visitorAutoReply && submission.email) {
      await transport.sendMail({
        from,
        to: submission.email,
        subject: notifications.visitorSubject || "Thanks for contacting KIBO360",
        text: (notifications.visitorMessage || "").replaceAll("{name}", submission.name || "there"),
      }).catch((e) => console.error("[mail] visitor auto-reply failed:", e.message));
    }
  } catch (e) {
    console.error("[mail] notification error:", e.message);
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
app.use(cors({ origin: ["http://localhost:3001","https://kibo360.in", "http://127.0.0.1:3001", "http://localhost:4599"] }));
app.use(express.json({ limit: "200kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kibo360-backend", time: new Date().toISOString() });
});

// Public widget config (no secrets)
app.get("/api/settings", (_req, res) => {
  const s = loadSettings();
  res.json({
    ok: true,
    whatsapp: { enabled: s.whatsapp.enabled, number: s.whatsapp.number, greeting: s.whatsapp.greeting },
    chatbot: {
      enabled: s.chatbot.enabled,
      botName: s.chatbot.botName,
      welcome: s.chatbot.welcome,
      customFaqs: (s.chatbot.customFaqs || []).map(({ q, keywords, a }) => ({ q, keywords, a })),
    },
  });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

app.post("/api/contact", (req, res) => {
  const { name, email, phone, organization, product, message } = req.body || {};
  const errors = {};
  if (!name || !String(name).trim()) errors.name = "Name is required.";
  if (!email || !EMAIL_RE.test(String(email).trim())) errors.email = "A valid email is required.";
  if (!message || !String(message).trim()) errors.message = "Message is required.";
  if (Object.keys(errors).length > 0) return res.status(400).json({ ok: false, errors });

  const submission = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    status: "new",
    name: String(name).trim().slice(0, 200),
    email: String(email).trim().slice(0, 200),
    phone: String(phone || "").trim().slice(0, 40),
    organization: String(organization || "").trim().slice(0, 200),
    product: String(product || "General").trim().slice(0, 80),
    message: String(message).trim().slice(0, 5000),
  };
  const list = loadSubmissions();
  list.push(submission);
  saveSubmissions(list);
  console.log(`[contact] ${submission.receivedAt} - ${submission.name} <${submission.email}> (${submission.product})`);
  sendNotifications(submission); // fire and forget
  res.status(201).json({ ok: true, id: submission.id });
});

// ---------------------------- Admin: auth ----------------------------------

// Basic brute-force protection: 8 failed attempts per IP per 10 minutes
const loginAttempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, reset: now + 600000 };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + 600000; }
  loginAttempts.set(ip, rec);
  return rec.count >= 8;
}

app.post("/api/admin/login", (req, res) => {
  const ip = req.ip || "unknown";
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ ok: false, error: "Too many attempts. Try again in a few minutes." });
  }
  const { email, password } = req.body || {};
  const user = loadUsers().find(
    (u) => u.email.toLowerCase() === String(email || "").trim().toLowerCase()
  );
  if (!user || user.passwordHash !== sha256(password || "")) {
    const rec = loginAttempts.get(ip);
    if (rec) rec.count += 1;
    return res.status(401).json({ ok: false, error: "Invalid email or password" });
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId: user.id, exp: Date.now() + SESSION_TTL });
  res.json({
    ok: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, permissions: user.permissions },
  });
});

app.post("/api/admin/password", requireAuth(), (req, res) => {
  const { current, next } = req.body || {};
  if (!next || String(next).length < 8) {
    return res.status(400).json({ ok: false, error: "New password must be at least 8 characters" });
  }
  const users = loadUsers();
  const me = users.find((u) => u.id === req.user.id);
  if (me.passwordHash !== sha256(current || "")) {
    return res.status(400).json({ ok: false, error: "Current password is incorrect" });
  }
  me.passwordHash = sha256(next);
  writeJson(USERS_FILE, users);
  res.json({ ok: true });
});

// ---------------------------- Admin: settings ------------------------------

app.get("/api/admin/settings", requireAuth(), (req, res) => {
  res.json({ ok: true, settings: loadSettings() });
});

app.put("/api/admin/settings", requireAuth(), (req, res) => {
  const patch = req.body || {};
  const sections = ["whatsapp", "chatbot", "notifications"];
  const settings = loadSettings();
  for (const key of sections) {
    if (patch[key] === undefined) continue;
    if (req.user.role !== "superadmin" && !req.user.permissions?.[key]) {
      return res.status(403).json({ ok: false, error: `No access to ${key} settings` });
    }
    settings[key] = { ...settings[key], ...patch[key] };
  }
  writeJson(SETTINGS_FILE, settings);
  res.json({ ok: true, settings });
});

// ---------------------------- Admin: leads ---------------------------------

app.get("/api/admin/leads", requireAuth("leads"), (_req, res) => {
  const leads = loadSubmissions().slice().reverse(); // newest first
  res.json({ ok: true, count: leads.length, leads });
});

app.patch("/api/admin/leads/:id", requireAuth("leads"), (req, res) => {
  const list = loadSubmissions();
  const lead = list.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });
  const status = String(req.body?.status || "");
  if (!["new", "contacted", "closed"].includes(status)) {
    return res.status(400).json({ ok: false, error: "Invalid status" });
  }
  lead.status = status;
  saveSubmissions(list);
  res.json({ ok: true, lead });
});

app.delete("/api/admin/leads/:id", requireAuth("leads"), (req, res) => {
  const list = loadSubmissions();
  const idx = list.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Lead not found" });
  list.splice(idx, 1);
  saveSubmissions(list);
  res.json({ ok: true });
});

// ------------------------ Admin: user management ---------------------------
// Super admin (livexperttechnologies@gmail.com) only.

app.get("/api/admin/users", requireSuperAdmin, (_req, res) => {
  const users = loadUsers().map(({ passwordHash, ...u }) => u);
  res.json({ ok: true, users });
});

app.post("/api/admin/users", requireSuperAdmin, (req, res) => {
  const { email, name, password, permissions } = req.body || {};
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ ok: false, error: "A valid email is required" });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
  }
  const users = loadUsers();
  if (users.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())) {
    return res.status(400).json({ ok: false, error: "A user with this email already exists" });
  }
  const user = {
    id: crypto.randomUUID(),
    email: String(email).trim(),
    name: String(name || "").trim().slice(0, 120) || String(email).split("@")[0],
    passwordHash: sha256(password),
    role: "admin",
    permissions: {
      leads: !!permissions?.leads,
      whatsapp: !!permissions?.whatsapp,
      chatbot: !!permissions?.chatbot,
      notifications: !!permissions?.notifications,
    },
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeJson(USERS_FILE, users);
  const { passwordHash, ...safe } = user;
  res.status(201).json({ ok: true, user: safe });
});

app.patch("/api/admin/users/:id", requireSuperAdmin, (req, res) => {
  const users = loadUsers();
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: "User not found" });
  if (user.role === "superadmin" && req.body?.permissions) {
    return res.status(400).json({ ok: false, error: "Super admin always has full access" });
  }
  if (req.body?.permissions) {
    user.permissions = {
      leads: !!req.body.permissions.leads,
      whatsapp: !!req.body.permissions.whatsapp,
      chatbot: !!req.body.permissions.chatbot,
      notifications: !!req.body.permissions.notifications,
    };
  }
  if (req.body?.password) {
    if (String(req.body.password).length < 8) {
      return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
    }
    user.passwordHash = sha256(req.body.password);
  }
  if (req.body?.name) user.name = String(req.body.name).trim().slice(0, 120);
  writeJson(USERS_FILE, users);
  const { passwordHash, ...safe } = user;
  res.json({ ok: true, user: safe });
});

app.delete("/api/admin/users/:id", requireSuperAdmin, (req, res) => {
  const users = loadUsers();
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: "User not found" });
  if (user.role === "superadmin") {
    return res.status(400).json({ ok: false, error: "The super admin account cannot be deleted" });
  }
  writeJson(USERS_FILE, users.filter((u) => u.id !== req.params.id));
  res.json({ ok: true });
});

// (The old public /api/submissions endpoint was removed - leads now require
// an authenticated admin session via /api/admin/leads.)

app.listen(PORT, () => {
  loadUsers(); // seed super admin on first boot
  console.log(`KIBO360 backend running at http://localhost:${PORT}`);
});
