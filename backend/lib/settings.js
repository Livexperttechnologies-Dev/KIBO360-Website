// ---------------------------------------------------------------------------
// Chat / WhatsApp / email-notification settings (settings.json).
// Unchanged behaviour from the original admin: these operational settings
// apply immediately (they are not website content).
// ---------------------------------------------------------------------------

export const DEFAULT_INTENTS = [
  {
    id: "greeting",
    keywords: "hello, hi, hey, namaste, good morning, good afternoon, good evening",
    answer: "Hello! Great to have you here. I can walk you through our products, share how pricing works, or book your free demo right in this chat. What would you like to do?",
    actions: [{ label: "View Products", type: "link", href: "/products" }, { label: "Book a Free Demo", type: "demo" }],
  },
  {
    id: "products",
    keywords: "product, solution, software, what do you, offer, our products",
    answer: "Kibo360 puts your whole business on one platform:\n• HMS - complete Hospital Management Software (live)\n• CMS - Clinical Management System for clinics (live)\n• ERP, CRM, LIS and Inventory - launching soon\n\nEvery product shares one intelligent database, so your teams stop juggling disconnected tools - and you simply add products as you grow.",
    actions: [{ label: "View All Products", type: "link", href: "/products" }, { label: "Book a Free Demo", type: "demo" }],
  },
  {
    id: "hms",
    keywords: "hms, hospital",
    answer: "KIBO360 HMS runs your entire hospital on one intelligent database - OPD/IPD, EMR/EHR, diagnostics, pharmacy, billing, finance, HR & payroll and AI-powered analytics, with ABHA health IDs built in. Want to see it working on your own workflows?",
    actions: [{ label: "Explore HMS", type: "link", href: "/products/hospitalmanagementsoftware" }, { label: "Book a Free Demo", type: "demo" }],
  },
  {
    id: "cms",
    keywords: "cms, clinic",
    answer: "KIBO360 CMS keeps your clinic running smoothly - appointments, queue & token, doctor EMR, e-prescriptions, GST billing, pharmacy and WhatsApp reminders. Most clinics go live within days, and you can upgrade to the full HMS anytime without migrating data.",
    actions: [{ label: "Explore CMS", type: "link", href: "/products/clinicalmanagementsoftware" }, { label: "Book a Free Demo", type: "demo" }],
  },
  {
    id: "pricing",
    keywords: "price, pricing, cost, charges, fees, quote, subscription, plan",
    answer: "Fair question! Pricing depends on your facility's size and the modules you pick, so we prepare a personalised quote for every customer. Book a free demo right here in the chat and you'll have your tailored quote within one business day.",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
  {
    id: "demo",
    keywords: "demo, book, trial, see it, appointment",
    answer: "Excellent choice! I can book your free demo right here in the chat - I'll just ask for a few details and your preferred date and time. Ready when you are!",
    actions: [{ label: "Book My Demo", type: "demo" }],
  },
  {
    id: "support",
    keywords: "contact, support, help, talk, human, agent, team, call, phone, email",
    answer: "Our team is happy to help:\n• Call +91-800 800 5672\n• Email support@kibo360.in\n• Or message us on WhatsApp\n\nYou can also simply keep typing here - our support team sees this chat and can jump in anytime.",
    actions: [{ label: "WhatsApp Us", type: "wa" }, { label: "Call +91-800 800 5672", type: "tel" }, { label: "Book a Free Demo", type: "demo" }],
  },
  {
    id: "certifications",
    keywords: "certif, iso, cmmi, quality",
    answer: "We take quality seriously. Livexpert Technologies is ISO 9001:2015 certified for Quality Management Systems and appraised at CMMI Level 3, and Kibo360 holds ABHA certification. You'll find the details on our About page.",
    actions: [{ label: "About Us", type: "link", href: "/about" }],
  },
  {
    id: "security",
    keywords: "abha, compliance, secure, security, data, privacy",
    answer: "Your data is in safe hands. Kibo360 is ABHA certified and protects every record with AES-256 encryption, role-based access, two-factor authentication, full audit logs and disaster recovery.",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
  {
    id: "address",
    keywords: "address, location, office, where",
    answer: "You'll find us at Bhutani Cyber Park, Block C, Sector 62, Noida - 201305, India. Drop by any time - or book a demo and we'll bring Kibo360 to you, virtually!",
    actions: [{ label: "Contact Us", type: "link", href: "/contact" }],
  },
  {
    id: "thanks",
    keywords: "thank, thanks, great, ok, okay",
    answer: "You're most welcome! Anything else I can help with - products, pricing, or a quick demo?",
    actions: [{ label: "Book a Free Demo", type: "demo" }],
  },
];

export const DEFAULT_NUDGES = [
  { path: "/products/hospitalmanagementsoftware", text: "I see you're exploring KIBO360 HMS! Ask me anything - modules, pricing, implementation - or I can book you a quick demo right here." },
  { path: "/products/clinicalmanagementsoftware", text: "Checking out our Clinical Management System? Happy to answer anything - features, pricing, go-live time - or book you a quick demo right here." },
  { path: "/products", text: "Finding the right fit? Tell me a little about your organisation and I'll point you to the right product - or show you everything in a quick demo." },
  { path: "/contact", text: "Need a hand reaching us? I can connect you with the team right here in chat, or book you a demo at a time that suits you." },
  { path: "/about", text: "Getting to know Kibo360? Ask me anything about the platform, our certifications, or the team behind it." },
];

export const DEFAULT_SETTINGS = {
  whatsapp: { enabled: true, number: "918008005672", greeting: "Hi! I'd like to know more about KIBO360." },
  chatbot: {
    enabled: true,
    botName: "Kibo Assistant",
    welcome: "Hi! I'm your KIBO360 assistant. Ask me about our products or pricing - or I can book your free demo right here in the chat.",
    quickReplies: ["Our Products", "Book a Demo", "Pricing", "HMS", "CMS", "Talk to Support"],
    fallback: "That's a good question - and our team will have the answer! I've shared your message with them. Meanwhile I can book you a demo right here in chat, or you can reach us on WhatsApp or by phone.",
    intents: DEFAULT_INTENTS,
    customFaqs: [],
    nudgeSeconds: 30,
    nudgeDefault: "Welcome to Kibo360! Can I help you find the right solution for your business - or book you a free demo right here in the chat?",
    nudges: DEFAULT_NUDGES,
  },
  notifications: {
    smtp: { host: "", port: 587, user: "", pass: "", from: "" },
    teamEmails: ["info@livexperttechnologies.com"],
    notifyTeam: true,
    offlineChatEmail: true,
    offlineVisitorEmail: true,
    visitorAutoReply: true,
    visitorSubject: "Thanks for contacting KIBO360",
    visitorMessage: "Hi {name},\n\nThanks for reaching out to KIBO360. Our team has received your message and will get back to you within one business day.\n\n- Team KIBO360, Livexpert Technologies",
  },
};

const FILE = "settings.json";
const SECTION_PERMS = { whatsapp: "whatsapp", chatbot: "chatbot", notifications: "notifications" };

// Chatbot content is shown to every visitor, so everything is normalized:
// button actions come from a fixed list and links must be site-relative or
// http(s) (never javascript:/data:), strings are capped.
const ACTION_TYPES = ["link", "demo", "wa", "tel"];
const str = (v, n) => String(v ?? "").slice(0, n);
export function safeHref(h) {
  const v = String(h ?? "").trim();
  if (/^\/(?!\/)[^\s<>"'`\\]*$/.test(v)) return v.slice(0, 500);
  if (/^https?:\/\/[^\s<>"'`]+$/i.test(v)) return v.slice(0, 500);
  return null;
}
function cleanActions(list) {
  return (Array.isArray(list) ? list : []).slice(0, 6).map((a) => {
    if (!a || typeof a !== "object" || !ACTION_TYPES.includes(a.type)) return null;
    const out = { label: str(a.label, 60), type: a.type };
    if (a.type === "link") { const h = safeHref(a.href); if (!h) return null; out.href = h; }
    return out;
  }).filter(Boolean);
}
export const cleanIntents = (list) => (Array.isArray(list) ? list : []).slice(0, 60).filter((x) => x && typeof x === "object")
  .map((x, i) => ({ id: str(x.id, 60).replace(/[^A-Za-z0-9_-]/g, "") || `custom-${i}`, keywords: str(x.keywords, 500), answer: str(x.answer, 2000), actions: cleanActions(x.actions) }));
export const cleanNudges = (list) => (Array.isArray(list) ? list : []).slice(0, 40).filter((x) => x && typeof x === "object")
  .map((x) => ({ path: /^\/[^\s]*$/.test(String(x.path || "")) ? str(x.path, 200) : "", text: str(x.text, 500) }));
export const cleanFaqs = (list) => (Array.isArray(list) ? list : []).slice(0, 60).filter((x) => x && typeof x === "object")
  .map((x) => ({ q: str(x.q, 200), keywords: str(x.keywords, 500), a: str(x.a, 2000) }));

export function createSettings({ store, audit, requireAuth }) {
  function load() {
    const s = store.readJson(FILE, null);
    if (!s) { store.writeJson(FILE, DEFAULT_SETTINGS); return structuredClone(DEFAULT_SETTINGS); }
    const out = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) out[key] = { ...DEFAULT_SETTINGS[key], ...(s[key] || {}) };
    return out;
  }

  function forUser(req) {
    const s = load();
    const out = {};
    for (const [key, perm] of Object.entries(SECTION_PERMS)) {
      if (!req.perms.has(perm)) continue;
      out[key] = key === "notifications"
        ? { ...s.notifications, smtp: { ...s.notifications.smtp, pass: "", hasPass: !!s.notifications.smtp?.pass } }
        : { ...s[key] };
    }
    return out;
  }

  function registerRoutes(app, { sendTestEmail }) {
    app.get("/api/settings", (_req, res) => {
      const s = load();
      res.json({
        ok: true,
        whatsapp: { enabled: s.whatsapp.enabled, number: s.whatsapp.number, greeting: s.whatsapp.greeting },
        chatbot: {
          enabled: s.chatbot.enabled, botName: s.chatbot.botName, welcome: s.chatbot.welcome,
          quickReplies: s.chatbot.quickReplies || [], fallback: s.chatbot.fallback,
          intents: cleanIntents(s.chatbot.intents),
          customFaqs: cleanFaqs(s.chatbot.customFaqs),
          nudgeSeconds: s.chatbot.nudgeSeconds, nudgeDefault: s.chatbot.nudgeDefault,
          nudges: cleanNudges(s.chatbot.nudges),
        },
      });
    });

    app.get("/api/admin/settings", requireAuth(["whatsapp", "chatbot", "notifications"]), (req, res) => {
      res.json({ ok: true, settings: forUser(req) });
    });

    app.put("/api/admin/settings", requireAuth(["whatsapp", "chatbot", "notifications"]), (req, res) => {
      const patch = req.body || {};
      const settings = load();
      for (const [key, perm] of Object.entries(SECTION_PERMS)) {
        if (patch[key] === undefined) continue;
        if (!req.perms.has(perm)) return res.status(403).json({ ok: false, error: `No access to ${key} settings` });
        if (typeof patch[key] !== "object" || Array.isArray(patch[key])) return res.status(400).json({ ok: false, error: `Invalid ${key} settings` });
        settings[key] = { ...settings[key], ...patch[key] };
      }
      if (patch.whatsapp) {
        settings.whatsapp.number = String(settings.whatsapp.number || "").replace(/\D/g, "").slice(0, 15);
        settings.whatsapp.greeting = String(settings.whatsapp.greeting || "").slice(0, 300);
        settings.whatsapp.enabled = !!settings.whatsapp.enabled;
      }
      if (patch.chatbot) {
        const c = settings.chatbot;
        c.intents = patch.chatbot.intents === null ? DEFAULT_INTENTS : cleanIntents(c.intents);
        c.nudges = patch.chatbot.nudges === null ? DEFAULT_NUDGES : cleanNudges(c.nudges);
        c.customFaqs = cleanFaqs(c.customFaqs);
        c.enabled = !!c.enabled;
        if (Array.isArray(patch.chatbot.quickReplies)) c.quickReplies = patch.chatbot.quickReplies.map((q) => String(q).slice(0, 60)).slice(0, 12);
        if (patch.chatbot.nudgeSeconds !== undefined) c.nudgeSeconds = Math.min(600, Math.max(5, Number(patch.chatbot.nudgeSeconds) || 30));
        for (const k of ["botName", "welcome", "fallback", "nudgeDefault"]) if (c[k] != null) c[k] = String(c[k]).slice(0, 2000);
      }
      if (patch.notifications?.smtp) {
        const stored = load().notifications?.smtp || {};
        const smtp = { ...stored, ...patch.notifications.smtp };
        delete smtp.hasPass;
        // Keep the saved password only while it goes to the same server and
        // account - otherwise it could be sent to a host of someone's choosing.
        const sameTarget = ["host", "port", "user"].every((k) => String(smtp[k] ?? "") === String(stored[k] ?? ""));
        if (!patch.notifications.smtp.pass) smtp.pass = sameTarget ? stored.pass || "" : "";
        settings.notifications.smtp = smtp;
      }
      if (patch.notifications?.teamEmails) {
        settings.notifications.teamEmails = (Array.isArray(patch.notifications.teamEmails) ? patch.notifications.teamEmails : [])
          .map((e) => String(e).trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)).slice(0, 20);
      }
      store.writeJson(FILE, settings, { backup: true });
      audit.log(req, { action: "settings.update", target: Object.keys(patch).join(", ") });
      res.json({ ok: true, settings: forUser(req) });
    });

    app.post("/api/admin/test-email", requireAuth("notifications"), async (req, res) => {
      try {
        const sentTo = await sendTestEmail(req.user);
        res.json({ ok: true, sentTo });
      } catch (e) {
        // Don't echo raw SMTP/network errors (they reveal internal hosts/ports).
        const msg = e.status && e.status < 500 ? e.message : e.code === "EAUTH" ? "The SMTP server rejected the username or password" : "Could not send the test email - check the SMTP host, port, username and password";
        res.status(e.status || 502).json({ ok: false, error: msg });
      }
    });
  }

  return { load, registerRoutes };
}
