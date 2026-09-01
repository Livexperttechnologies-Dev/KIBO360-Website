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
const CHATS_FILE = path.join(DATA_DIR, "chats.json");

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
  // Atomic write (tmp + rename) so a crash mid-write can never leave a
  // corrupt file that readJson would silently replace with the fallback.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

// Every text the chatbot sends lives here so the admin console can change it
// without a code deploy. Buttons: type "demo" opens the demo form, "link" goes
// to href, "wa" opens WhatsApp, "tel" calls the phone number.
const DEFAULT_INTENTS = [
  {
    id: "greeting",
    keywords: "hello, hi, hey, namaste, good morning, good afternoon, good evening",
    answer: "Hello! How can I help you today? You can ask about our products, book a demo, or talk to our support team.",
    actions: [],
  },
  {
    id: "products",
    keywords: "product, solution, software, what do you, offer, our products",
    answer:
      "Kibo360 brings business software together on one platform:\n• HMS - Hospital Management Software (live)\n• CMS - Clinic Management Software (live)\n• ERP, CRM, LIS and Inventory - coming soon\n\nEverything shares one intelligent database, so you can add products as you grow.",
    actions: [{ label: "View All Products", type: "link", href: "/products" }],
  },
  {
    id: "hms",
    keywords: "hms, hospital",
    answer:
      "KIBO360 HMS runs your whole hospital - OPD/IPD, EMR/EHR, diagnostics, pharmacy, billing, finance, HR & payroll and AI analytics on one intelligent database, with ABHA health ID support built in.",
    actions: [
      { label: "Explore HMS", type: "link", href: "/products/hms" },
      { label: "Book a Demo", type: "demo" },
    ],
  },
  {
    id: "cms",
    keywords: "cms, clinic",
    answer:
      "KIBO360 CMS is built for clinics - appointments, queue & token, doctor EMR, e-prescriptions, GST billing, pharmacy and WhatsApp reminders. Live in days, and it upgrades to full HMS without any data migration.",
    actions: [
      { label: "Explore CMS", type: "link", href: "/products/cms" },
      { label: "Book a Demo", type: "demo" },
    ],
  },
  {
    id: "pricing",
    keywords: "price, pricing, cost, charges, fees, quote, subscription",
    answer:
      "Pricing depends on your facility size and the modules you need. Book a free demo and our team will prepare a quote tailored to you - usually within one business day.",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
  {
    id: "demo",
    keywords: "demo, book, trial, see it",
    answer: "Happy to set that up! Click below and tell us a little about your facility - we respond within one business day.",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
  {
    id: "support",
    keywords: "contact, support, help, talk, human, agent, team, call, phone, email",
    answer:
      "You can reach our team directly:\n• Call +91-800 800 5672\n• Email info@livexperttechnologies.com\n• Or chat with us on WhatsApp\n\nYou can also just keep typing here - our support team sees this chat and can jump in.",
    actions: [
      { label: "WhatsApp Us", type: "wa" },
      { label: "Call +91-800 800 5672", type: "tel" },
      { label: "Send a Message", type: "demo" },
    ],
  },
  {
    id: "certifications",
    keywords: "certif, iso, cmmi, quality",
    answer:
      "Livexpert Technologies is ISO 9001:2015 certified (Quality Management Systems) and appraised at CMMI Level 3. Kibo360 also holds ABHA certification.",
    actions: [{ label: "About Us", type: "link", href: "/about" }],
  },
  {
    id: "security",
    keywords: "abha, compliance, secure, security, data",
    answer:
      "Kibo360 is ABHA certified, and your data is protected with AES-256 encryption, role-based access, two-factor authentication, audit logs and disaster recovery.",
    actions: [],
  },
  {
    id: "address",
    keywords: "address, location, office, where",
    answer: "We're at Bhutani Cyber Park, Block C, Sector 62, Noida - 201305, India.",
    actions: [],
  },
  {
    id: "thanks",
    keywords: "thank, thanks, great, ok, okay",
    answer: "You're welcome! Anything else I can help with?",
    actions: [],
  },
];

const DEFAULT_NUDGES = [
  { path: "/products/hms", text: "I see you're exploring KIBO360 HMS! Can I answer anything - modules, pricing, or how it fits your hospital?" },
  { path: "/products/cms", text: "Looking at our Clinical Management System? Happy to answer anything - features, pricing, or how fast your clinic can go live." },
  { path: "/products", text: "Looking for the right solution? Tell me a little about your organisation and I'll point you to the right product." },
  { path: "/contact", text: "Need a hand reaching us? I can connect you with our team right here, or you can book a demo below." },
  { path: "/about", text: "Getting to know Kibo360? Ask me anything about our platform, certifications or the team behind it." },
];

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
    quickReplies: ["Our Products", "Book a Demo", "HMS", "CMS", "Contact & Support"],
    fallback:
      "I'm not sure about that one - but our team will know! Your message has been shared with our support team, and you can also book a demo, message us on WhatsApp, or call us.",
    intents: DEFAULT_INTENTS,
    customFaqs: [], // [{ q, keywords, a }]
    nudgeSeconds: 30,
    nudgeDefault: "Welcome to Kibo360! Can I help you find the right solution for your business?",
    nudges: DEFAULT_NUDGES,
  },
  notifications: {
    smtp: { host: "", port: 587, user: "", pass: "", from: "" },
    teamEmails: ["info@livexperttechnologies.com"],
    notifyTeam: true,
    offlineChatEmail: true,    // email the team when a visitor chats and no support user is online
    offlineVisitorEmail: true, // email the team when a visitor browses and no support user is online
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
  // Merge per section so settings saved before a field existed still pick up
  // its default (e.g. chatbot.intents added after settings.json was written).
  const out = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    out[key] = { ...DEFAULT_SETTINGS[key], ...(s[key] || {}) };
  }
  return out;
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
      permissions: { leads: true, chats: true, whatsapp: true, chatbot: true, notifications: true },
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
          `Organization: ${submission.organization || "-"}\nInterest: ${submission.product}\n` +
          (submission.preferredDate || submission.preferredTime
            ? `Preferred demo slot: ${submission.preferredDate || "any date"}${submission.preferredTime ? ` at ${submission.preferredTime}` : ""}\n`
            : "") +
          `\nMessage:\n${submission.message}\n\nReceived: ${submission.receivedAt}`,
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
// Exactly one proxy hop (Traefik / the local test proxy) so req.ip is the real
// client address, not a spoofable X-Forwarded-For entry.
app.set("trust proxy", 1);
app.use(cors({ origin: ["http://localhost:3001","https://kibo360.in", "https://www.kibo360.in", "http://127.0.0.1:3001", "http://localhost:4599"] }));
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
      quickReplies: s.chatbot.quickReplies || [],
      fallback: s.chatbot.fallback,
      intents: (s.chatbot.intents || []).map(({ id, keywords, answer, actions }) => ({ id, keywords, answer, actions })),
      customFaqs: (s.chatbot.customFaqs || []).map(({ q, keywords, a }) => ({ q, keywords, a })),
      nudgeSeconds: s.chatbot.nudgeSeconds,
      nudgeDefault: s.chatbot.nudgeDefault,
      nudges: (s.chatbot.nudges || []).map(({ path: p, text }) => ({ path: p, text })),
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
    preferredDate: String(req.body?.preferredDate || "").trim().slice(0, 60),
    preferredTime: String(req.body?.preferredTime || "").trim().slice(0, 40),
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

// Only the sections the user may edit are returned, and the SMTP password is
// never sent back to the browser (hasPass tells the UI one is saved).
function settingsForUser(user) {
  const s = loadSettings();
  const out = {};
  for (const key of ["whatsapp", "chatbot", "notifications"]) {
    if (user.role !== "superadmin" && !user.permissions?.[key]) continue;
    out[key] = key === "notifications"
      ? { ...s.notifications, smtp: { ...s.notifications.smtp, pass: "", hasPass: !!s.notifications.smtp?.pass } }
      : { ...s[key] };
  }
  return out;
}

app.get("/api/admin/settings", requireAuth(), (req, res) => {
  res.json({ ok: true, settings: settingsForUser(req.user) });
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
  // Chatbot content: null means "restore the defaults"; arrays are capped so
  // a bad save can't bloat the settings file.
  if (patch.chatbot) {
    if (patch.chatbot.intents === null) settings.chatbot.intents = DEFAULT_INTENTS;
    else if (Array.isArray(patch.chatbot.intents)) settings.chatbot.intents = patch.chatbot.intents.slice(0, 60);
    if (patch.chatbot.nudges === null) settings.chatbot.nudges = DEFAULT_NUDGES;
    else if (Array.isArray(patch.chatbot.nudges)) settings.chatbot.nudges = patch.chatbot.nudges.slice(0, 40);
    if (Array.isArray(patch.chatbot.quickReplies)) settings.chatbot.quickReplies = patch.chatbot.quickReplies.slice(0, 12);
    if (patch.chatbot.nudgeSeconds !== undefined) {
      settings.chatbot.nudgeSeconds = Math.min(600, Math.max(5, Number(patch.chatbot.nudgeSeconds) || 30));
    }
  }
  // An empty password from the form means "keep the saved one"
  if (patch.notifications?.smtp) {
    const stored = loadSettings().notifications?.smtp || {};
    const smtp = { ...stored, ...patch.notifications.smtp };
    delete smtp.hasPass;
    if (!patch.notifications.smtp.pass) smtp.pass = stored.pass || "";
    settings.notifications.smtp = smtp;
  }
  writeJson(SETTINGS_FILE, settings);
  res.json({ ok: true, settings: settingsForUser(req.user) });
});

// Send a test email so admins can verify SMTP settings; unlike the
// fire-and-forget alerts this awaits the send and reports the exact error.
app.post("/api/admin/test-email", requireAuth("notifications"), async (req, res) => {
  const { notifications } = loadSettings();
  const smtp = notifications?.smtp || {};
  if (!smtp.host || !smtp.user) {
    return res.status(400).json({ ok: false, error: "Configure the SMTP host and username first, then save." });
  }
  if (!notifications.teamEmails?.length) {
    return res.status(400).json({ ok: false, error: "Add at least one team email first, then save." });
  }
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 587,
      secure: Number(smtp.port) === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transport.sendMail({
      from: smtp.from || smtp.user,
      to: notifications.teamEmails.join(","),
      subject: "Test email from the KIBO360 admin console",
      text: `This is a test email sent by ${req.user.name} (${req.user.email}) from the KIBO360 admin console.\n\nIf you received it, SMTP and team notifications are working.`,
    });
    res.json({ ok: true, sentTo: notifications.teamEmails });
  } catch (e) {
    res.status(502).json({ ok: false, error: `SMTP error: ${e.message}` });
  }
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
      chats: !!permissions?.chats,
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
      chats: !!req.body.permissions.chats,
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

// ---------------------------------------------------------------------------
// Live visitors + live chat
// Presence is in-memory (ephemeral by nature); chat transcripts persist in
// chats.json. Admins with the "chats" permission poll /api/admin/chats, which
// doubles as their "support is online" heartbeat - if nobody with chat access
// has the console open when a visitor writes, the team gets one email alert
// per conversation.
// ---------------------------------------------------------------------------

const loadChats = () => readJson(CHATS_FILE, []);
let chatVisitorSet = null; // cache: which visitorIds have a conversation
const saveChats = (list) => { chatVisitorSet = null; writeJson(CHATS_FILE, list); };
function visitorHasChat(visitorId) {
  if (!chatVisitorSet) chatVisitorSet = new Set(loadChats().map((c) => c.visitorId));
  return chatVisitorSet.has(visitorId);
}

const visitors = new Map();   // visitorId -> { firstSeen, lastSeen, page, ip, location }
const adminWatch = new Map(); // userId -> lastSeen (ms) - updated on chat polls
const VISITOR_ONLINE_MS = 45 * 1000;   // ping every 15s -> 3 missed pings = gone
const ADMIN_ONLINE_MS = 40 * 1000;     // console polls every 10s
const VID_RE = /^[a-z0-9-]{10,64}$/i;

const anyAdminOnline = () => {
  const now = Date.now();
  for (const t of adminWatch.values()) if (now - t < ADMIN_ONLINE_MS) return true;
  return false;
};
const onlineVisitors = () => {
  const now = Date.now();
  const list = [];
  for (const [id, v] of visitors) {
    if (now - v.lastSeen < VISITOR_ONLINE_MS) {
      list.push({ visitorId: id, page: v.page, location: v.location, sinceMs: now - v.firstSeen });
    }
  }
  return list.sort((a, b) => b.sinceMs - a.sinceMs);
};

// Keep the presence map bounded
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, v] of visitors) if (v.lastSeen < cutoff) visitors.delete(id);
  const aCut = Date.now() - 60 * 60 * 1000;
  for (const [id, t] of adminWatch) if (t < aCut) adminWatch.delete(id);
}, 60 * 1000).unref();

// --- IP -> location (best effort, cached; never blocks a request) -----------
const geoCache = new Map(); // ip -> string ("City, Region, Country" | "Local network")
function isPrivateIp(ip) {
  return !ip || /^(::1|::ffff:)?(127\.|10\.|192\.168\.|169\.254\.)/.test(ip) ||
    /^(::ffff:)?172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip === "::1" || /^f[cde]/i.test(ip);
}
async function lookupLocation(ip) {
  if (isPrivateIp(ip)) return "Local network";
  if (geoCache.has(ip)) return geoCache.get(ip);
  if (typeof fetch !== "function") return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctrl.signal });
    clearTimeout(t);
    const d = await r.json();
    const loc = d && d.success !== false
      ? [d.city, d.region, d.country].filter(Boolean).join(", ") || null
      : null;
    if (geoCache.size > 2000) geoCache.clear();
    geoCache.set(ip, loc);
    return loc;
  } catch { return null; }
}

// --- Simple keyed rate limits for the public endpoints ----------------------
const chatHits = new Map(); // key -> { count, reset }
function chatLimited(key, max, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  let rec = chatHits.get(key);
  if (!rec || now > rec.reset) { rec = { count: 0, reset: now + windowMs }; chatHits.set(key, rec); }
  rec.count += 1;
  if (chatHits.size > 10000) chatHits.clear();
  return rec.count > max;
}

// A human agent counts as "handling" a conversation for an hour after their
// last reply; after that the auto-bot resumes and offline alerts can re-arm.
const AGENT_ACTIVE_MS = 60 * 60 * 1000;
const agentRecently = (chat) =>
  chat.messages.some((m) => m.from === "agent" && Date.now() - new Date(m.at).getTime() < AGENT_ACTIVE_MS);

function pruneChats(list) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let out = list.filter((c) => new Date(c.lastActiveAt || c.createdAt).getTime() > cutoff);
  // Over the cap, evict throwaway chats (1-2 messages, no human reply, >1h
  // idle) before touching real conversations, so junk floods can't wipe
  // genuine transcripts. Only then fall back to oldest-first.
  const CAP = 800;
  if (out.length > CAP) {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const isJunk = (c) =>
      c.messages.length <= 2 &&
      !c.messages.some((m) => m.from === "agent") &&
      new Date(c.lastActiveAt || c.createdAt).getTime() < hourAgo;
    const junk = out.filter(isJunk).sort((a, b) => new Date(a.lastActiveAt || 0) - new Date(b.lastActiveAt || 0));
    const dropJunk = new Set(junk.slice(0, out.length - CAP).map((c) => c.id));
    out = out.filter((c) => !dropJunk.has(c.id));
    if (out.length > CAP) {
      out.sort((a, b) => new Date(a.lastActiveAt || 0) - new Date(b.lastActiveAt || 0));
      out = out.slice(out.length - CAP);
    }
  }
  return out;
}

async function sendTeamEmail(subject, text) {
  const { notifications } = loadSettings();
  const smtp = notifications?.smtp || {};
  if (!smtp.host || !smtp.user || !notifications.teamEmails?.length) return;
  try {
    const { default: nodemailer } = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 587,
      secure: Number(smtp.port) === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transport.sendMail({ from: smtp.from || smtp.user, to: notifications.teamEmails.join(","), subject, text });
  } catch (e) {
    console.error("[mail] team alert failed:", e.message);
  }
}

// Global budget shared by chat alerts so a flood of fake conversations can't
// spam the team inbox or burn the SMTP account's reputation.
let chatAlertBudget = { count: 0, reset: 0 };
function sendChatAlert(chat, msg) {
  const { notifications } = loadSettings();
  if (notifications.offlineChatEmail === false) return;
  const now = Date.now();
  if (now > chatAlertBudget.reset) chatAlertBudget = { count: 0, reset: now + 60 * 60 * 1000 };
  if (chatAlertBudget.count >= 20) return;
  chatAlertBudget.count += 1;
  sendTeamEmail(
    "Visitor waiting in live chat on kibo360.in",
    `A visitor is chatting on the website and no support user is online in the admin console.\n\n` +
      `Location: ${chat.visitor?.location || "Unknown"}\n` +
      `Page: ${chat.visitor?.page || "-"}\n` +
      `Message: ${msg.text}\n` +
      `Time: ${msg.at}\n\n` +
      `Reply from the admin console: https://kibo360.in/admin (Live Chat tab)`
  );
}

// One "new visitor on the site" email per visitor (24h dedupe), only while no
// support user is online, capped at 20/hour so crawlers can't flood the inbox.
const emailedVisitors = new Map(); // visitorId -> ts
let visitorAlertBudget = { count: 0, reset: 0 };
function sendVisitorAlert(visitorId, v) {
  const { notifications } = loadSettings();
  if (notifications.offlineVisitorEmail === false) return;
  const now = Date.now();
  const seen = emailedVisitors.get(visitorId);
  if (seen && now - seen < 24 * 60 * 60 * 1000) return;
  if (now > visitorAlertBudget.reset) visitorAlertBudget = { count: 0, reset: now + 60 * 60 * 1000 };
  if (visitorAlertBudget.count >= 20) return;
  visitorAlertBudget.count += 1;
  emailedVisitors.set(visitorId, now);
  if (emailedVisitors.size > 5000) emailedVisitors.clear();
  sendTeamEmail(
    "New visitor on kibo360.in",
    `Someone is browsing the website while no support user is online in the admin console.\n\n` +
      `Location: ${v.location || "Unknown"}\n` +
      `Page: ${v.page || "/"}\n` +
      `Time: ${new Date().toISOString()}\n\n` +
      `Open the admin console to chat live: https://kibo360.in/admin (Live Chat tab)`
  );
}

// --- Public: widget heartbeat ----------------------------------------------
app.post("/api/presence/ping", (req, res) => {
  // Generous per-IP cap (offices share IPs; a real tab pings every 15s) that
  // still stops high-rate floods.
  if (chatLimited(`ping:${req.ip || "unknown"}`, 600)) return res.status(429).json({ ok: false });
  const { visitorId, page } = req.body || {};
  if (!VID_RE.test(String(visitorId || ""))) return res.status(400).json({ ok: false });
  const now = Date.now();
  let v = visitors.get(visitorId);
  if (!v) {
    v = { firstSeen: now, ip: req.ip, location: null };
    visitors.set(visitorId, v);
    if (visitors.size > 2000) {
      // Hard cap against fake-id floods: evict oldest-inserted entries
      // unconditionally until back under the cap.
      for (const id of visitors.keys()) { if (visitors.size <= 1500) break; visitors.delete(id); }
    }
    v.page = String(page || "/").slice(0, 200);
    lookupLocation(req.ip).then((loc) => {
      if (loc) v.location = loc;
      if (!anyAdminOnline()) sendVisitorAlert(visitorId, v); // fire and forget
    });
  }
  v.lastSeen = now;
  v.page = String(page || "/").slice(0, 200);
  // hasChat lets the widget start polling when an agent opened a conversation
  // with a visitor who never wrote first.
  res.json({ ok: true, agentOnline: anyAdminOnline(), hasChat: visitorHasChat(visitorId) });
});

// --- Public: visitor sends / syncs a message -------------------------------
app.post("/api/chat/message", (req, res) => {
  const ip = req.ip || "unknown";
  if (chatLimited(`msg:${ip}`, 60)) {
    return res.status(429).json({ ok: false, error: "Too many messages. Please slow down." });
  }
  const { visitorId, from, text, page } = req.body || {};
  if (!VID_RE.test(String(visitorId || ""))) return res.status(400).json({ ok: false, error: "Bad visitor id" });
  if (!["visitor", "bot"].includes(from)) return res.status(400).json({ ok: false, error: "Bad sender" });
  const clean = String(text || "").trim().slice(0, 1500);
  if (!clean) return res.status(400).json({ ok: false, error: "Empty message" });

  const chats = loadChats();
  let chat = chats.find((c) => c.visitorId === visitorId);
  if (!chat) {
    // Starting a NEW conversation is limited much harder than messaging, so
    // minting random visitorIds can't flood the store or the team inbox.
    if (chatLimited(`newchat:${ip}`, 15, 60 * 60 * 1000)) {
      return res.status(429).json({ ok: false, error: "Too many new conversations." });
    }
    const pv = visitors.get(visitorId);
    chat = {
      id: crypto.randomUUID(),
      visitorId,
      createdAt: new Date().toISOString(),
      status: "open",
      unread: 0,
      lastAlertAt: null,
      visitor: {
        ip,
        location: pv?.location || null,
        page: String(page || pv?.page || "/").slice(0, 200),
      },
      messages: [],
    };
    chats.push(chat);
  }
  if (chat.messages.length >= 400) {
    return res.status(429).json({ ok: false, error: "This conversation is full." });
  }
  if (!chat.visitor.location) {
    const pv = visitors.get(visitorId);
    if (pv?.location) chat.visitor.location = pv.location;
  }
  if (page) chat.visitor.page = String(page).slice(0, 200);

  const msg = { from, text: clean, at: new Date().toISOString() };
  chat.messages.push(msg);
  chat.lastActiveAt = msg.at;
  let alert = false;
  if (from === "visitor") {
    chat.unread = (chat.unread || 0) + 1;
    chat.status = "open";
    // Offline alert re-arms after 6h so a visitor returning days later is
    // never silently missed just because this chat alerted once before.
    const lastAlert = chat.lastAlertAt ? new Date(chat.lastAlertAt).getTime() : 0;
    if (!anyAdminOnline() && Date.now() - lastAlert > 6 * 60 * 60 * 1000) {
      chat.lastAlertAt = msg.at; // set before the async send so it fires once
      alert = true;
    }
  }
  saveChats(pruneChats(chats));
  if (alert) sendChatAlert(chat, msg); // fire and forget
  res.json({ ok: true, total: chat.messages.length, agentJoined: agentRecently(chat), agentOnline: anyAdminOnline() });
});

// --- Public: visitor pulls new messages (agent replies) --------------------
app.get("/api/chat/messages", (req, res) => {
  const visitorId = String(req.query.visitorId || "");
  if (!VID_RE.test(visitorId)) return res.status(400).json({ ok: false, error: "Bad visitor id" });
  const chat = loadChats().find((c) => c.visitorId === visitorId);
  const agentOnline = anyAdminOnline();
  if (!chat) return res.json({ ok: true, total: 0, messages: [], agentJoined: false, agentOnline });
  const after = Math.max(0, Number(req.query.after) || 0);
  res.json({
    ok: true,
    total: chat.messages.length,
    messages: chat.messages.slice(after).map(({ from, name, text, at }) => ({ from, name, text, at })),
    agentJoined: agentRecently(chat),
    agentOnline,
    status: chat.status,
  });
});

// --- Admin: chat overview (doubles as the support-online heartbeat) --------
app.get("/api/admin/chats", requireAuth("chats"), (req, res) => {
  adminWatch.set(req.user.id, Date.now());
  const rawChats = loadChats();
  const chats = rawChats
    .slice()
    .sort((a, b) => new Date(b.lastActiveAt || b.createdAt) - new Date(a.lastActiveAt || a.createdAt))
    .map((c) => {
      const last = c.messages[c.messages.length - 1];
      return {
        id: c.id,
        createdAt: c.createdAt,
        lastActiveAt: c.lastActiveAt || c.createdAt,
        status: c.status,
        unread: c.unread || 0,
        location: c.visitor?.location || "Unknown",
        page: c.visitor?.page || "-",
        online: (() => { const v = visitors.get(c.visitorId); return !!v && Date.now() - v.lastSeen < VISITOR_ONLINE_MS; })(),
        messageCount: c.messages.length,
        lastMessage: last ? { from: last.from, text: String(last.text).slice(0, 120) } : null,
      };
    });
  const canLeads = req.user.role === "superadmin" || !!req.user.permissions?.leads;
  // Scales to thousands online: full count, but only the 60 longest-engaged
  // visitor cards are sent, each linked to its conversation when one exists.
  const online = onlineVisitors();
  const byVisitor = new Map(rawChats.map((c) => [c.visitorId, c.id]));
  const visitorCards = online.slice(0, 60).map((v) => ({ ...v, chatId: byVisitor.get(v.visitorId) || null }));
  res.json({
    ok: true,
    chats,
    unreadTotal: chats.reduce((n, c) => n + c.unread, 0),
    presence: { count: online.length, visitors: visitorCards },
    leadsCount: canLeads ? loadSubmissions().length : null,
  });
});

// --- Admin: proactively start (or join) a chat with a browsing visitor -----
app.post("/api/admin/chats/start", requireAuth("chats"), (req, res) => {
  const { visitorId, text } = req.body || {};
  if (!VID_RE.test(String(visitorId || ""))) return res.status(400).json({ ok: false, error: "Bad visitor id" });
  const clean = String(text || "").trim().slice(0, 1500);
  if (!clean) return res.status(400).json({ ok: false, error: "Empty message" });
  const chats = loadChats();
  let chat = chats.find((c) => c.visitorId === visitorId);
  if (!chat) {
    const pv = visitors.get(visitorId);
    chat = {
      id: crypto.randomUUID(),
      visitorId,
      createdAt: new Date().toISOString(),
      status: "open",
      unread: 0,
      lastAlertAt: null,
      visitor: {
        ip: pv?.ip || null,
        location: pv?.location || null,
        page: pv?.page || "/",
      },
      messages: [],
    };
    chats.push(chat);
  }
  const msg = { from: "agent", name: req.user.name, text: clean, at: new Date().toISOString() };
  chat.messages.push(msg);
  chat.lastActiveAt = msg.at;
  chat.status = "open";
  saveChats(chats);
  res.json({ ok: true, chatId: chat.id });
});

// --- Admin: one thread (opening it marks it read) --------------------------
app.get("/api/admin/chats/:id", requireAuth("chats"), (req, res) => {
  adminWatch.set(req.user.id, Date.now());
  const chats = loadChats();
  const chat = chats.find((c) => c.id === req.params.id);
  if (!chat) return res.status(404).json({ ok: false, error: "Chat not found" });
  if (chat.unread) { chat.unread = 0; saveChats(chats); }
  const v = visitors.get(chat.visitorId);
  res.json({
    ok: true,
    chat: {
      id: chat.id,
      createdAt: chat.createdAt,
      lastActiveAt: chat.lastActiveAt,
      status: chat.status,
      location: chat.visitor?.location || "Unknown",
      page: chat.visitor?.page || "-",
      online: !!v && Date.now() - v.lastSeen < VISITOR_ONLINE_MS,
      messages: chat.messages,
    },
  });
});

app.post("/api/admin/chats/:id/reply", requireAuth("chats"), (req, res) => {
  adminWatch.set(req.user.id, Date.now());
  const clean = String(req.body?.text || "").trim().slice(0, 1500);
  if (!clean) return res.status(400).json({ ok: false, error: "Empty message" });
  const chats = loadChats();
  const chat = chats.find((c) => c.id === req.params.id);
  if (!chat) return res.status(404).json({ ok: false, error: "Chat not found" });
  const msg = { from: "agent", name: req.user.name, text: clean, at: new Date().toISOString() };
  chat.messages.push(msg);
  chat.lastActiveAt = msg.at;
  chat.status = "open";
  saveChats(chats);
  res.json({ ok: true, message: msg, total: chat.messages.length });
});

app.patch("/api/admin/chats/:id", requireAuth("chats"), (req, res) => {
  const status = String(req.body?.status || "");
  if (!["open", "closed"].includes(status)) return res.status(400).json({ ok: false, error: "Invalid status" });
  const chats = loadChats();
  const chat = chats.find((c) => c.id === req.params.id);
  if (!chat) return res.status(404).json({ ok: false, error: "Chat not found" });
  chat.status = status;
  saveChats(chats);
  res.json({ ok: true });
});

app.delete("/api/admin/chats/:id", requireAuth("chats"), (req, res) => {
  const chats = loadChats();
  const idx = chats.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: "Chat not found" });
  chats.splice(idx, 1);
  saveChats(chats);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  loadUsers(); // seed super admin on first boot
  console.log(`KIBO360 backend running at http://localhost:${PORT}`);
});
