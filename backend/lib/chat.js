import crypto from "crypto";
import { rateLimit } from "./security.js";

// ---------------------------------------------------------------------------
// Live visitors + live chat (ported unchanged from the original server).
// Presence is in-memory; transcripts persist in chats.json. Admin chat polls
// double as the "support is online" heartbeat that pauses offline emails.
// ---------------------------------------------------------------------------

const CHATS = "chats.json";
const VISITOR_ONLINE_MS = 45 * 1000;
const ADMIN_ONLINE_MS = 40 * 1000;
const VID_RE = /^[a-z0-9-]{10,64}$/i;
const AGENT_ACTIVE_MS = 60 * 60 * 1000;

export function createChat({ store, audit, requireAuth, can, settings, notify, forms }) {
  const loadChats = () => store.readJson(CHATS, []) || [];
  let chatVisitorSet = null;
  const saveChats = (list) => { chatVisitorSet = null; store.writeJson(CHATS, list); };
  const visitorHasChat = (id) => {
    if (!chatVisitorSet) chatVisitorSet = new Set(loadChats().map((c) => c.visitorId));
    return chatVisitorSet.has(id);
  };

  const visitors = new Map();
  const adminWatch = new Map();
  const anyAdminOnline = () => { const now = Date.now(); for (const t of adminWatch.values()) if (now - t < ADMIN_ONLINE_MS) return true; return false; };
  const onlineVisitors = () => {
    const now = Date.now();
    const list = [];
    for (const [id, v] of visitors) if (now - v.lastSeen < VISITOR_ONLINE_MS) list.push({ visitorId: id, page: v.page, location: v.location, sinceMs: now - v.firstSeen });
    return list.sort((a, b) => b.sinceMs - a.sinceMs);
  };
  const sweep = setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [id, v] of visitors) if (v.lastSeen < cutoff) visitors.delete(id);
    const aCut = Date.now() - 60 * 60 * 1000;
    for (const [id, t] of adminWatch) if (t < aCut) adminWatch.delete(id);
  }, 60 * 1000);
  sweep.unref();

  const geoCache = new Map();
  const isPrivateIp = (ip) => !ip || /^(::1|::ffff:)?(127\.|10\.|192\.168\.|169\.254\.)/.test(ip) || /^(::ffff:)?172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip === "::1" || /^f[cde]/i.test(ip);
  async function lookupLocation(ip) {
    if (isPrivateIp(ip)) return "Local network";
    if (geoCache.has(ip)) return geoCache.get(ip);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctrl.signal });
      clearTimeout(t);
      const d = await r.json();
      const loc = d && d.success !== false ? [d.city, d.region, d.country].filter(Boolean).join(", ") || null : null;
      if (geoCache.size > 2000) geoCache.clear();
      geoCache.set(ip, loc);
      return loc;
    } catch { return null; }
  }

  const hits = new Map();
  const limited = (key, max, windowMs = 5 * 60 * 1000) => {
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || now > rec.reset) { rec = { count: 0, reset: now + windowMs }; hits.set(key, rec); }
    rec.count += 1;
    if (hits.size > 10000) hits.clear();
    return rec.count > max;
  };
  const agentRecently = (chat) => chat.messages.some((m) => m.from === "agent" && Date.now() - new Date(m.at).getTime() < AGENT_ACTIVE_MS);

  function pruneChats(list) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let out = list.filter((c) => new Date(c.lastActiveAt || c.createdAt).getTime() > cutoff);
    const CAP = 800;
    if (out.length > CAP) {
      const hourAgo = Date.now() - 60 * 60 * 1000;
      const junk = out.filter((c) => c.messages.length <= 2 && !c.messages.some((m) => m.from === "agent") && new Date(c.lastActiveAt || c.createdAt).getTime() < hourAgo)
        .sort((a, b) => new Date(a.lastActiveAt || 0) - new Date(b.lastActiveAt || 0));
      const drop = new Set(junk.slice(0, out.length - CAP).map((c) => c.id));
      out = out.filter((c) => !drop.has(c.id));
      if (out.length > CAP) { out.sort((a, b) => new Date(a.lastActiveAt || 0) - new Date(b.lastActiveAt || 0)); out = out.slice(out.length - CAP); }
    }
    return out;
  }

  let chatAlertBudget = { count: 0, reset: 0 };
  function sendChatAlert(chat, msg) {
    const { notifications } = settings.load();
    if (notifications.offlineChatEmail === false) return;
    const now = Date.now();
    if (now > chatAlertBudget.reset) chatAlertBudget = { count: 0, reset: now + 60 * 60 * 1000 };
    if (chatAlertBudget.count >= 20) return;
    chatAlertBudget.count += 1;
    notify.team("Visitor waiting in live chat on kibo360.in",
      `A visitor is chatting on the website and no support user is online in the admin console.\n\nLocation: ${chat.visitor?.location || "Unknown"}\nPage: ${chat.visitor?.page || "-"}\nMessage: ${msg.text}\nTime: ${msg.at}\n\nReply from the admin console: https://kibo360.in/admin/chat`);
  }
  const emailedVisitors = new Map();
  let visitorAlertBudget = { count: 0, reset: 0 };
  function sendVisitorAlert(visitorId, v) {
    const { notifications } = settings.load();
    if (notifications.offlineVisitorEmail === false) return;
    const now = Date.now();
    const seen = emailedVisitors.get(visitorId);
    if (seen && now - seen < 24 * 60 * 60 * 1000) return;
    if (now > visitorAlertBudget.reset) visitorAlertBudget = { count: 0, reset: now + 60 * 60 * 1000 };
    if (visitorAlertBudget.count >= 20) return;
    visitorAlertBudget.count += 1;
    emailedVisitors.set(visitorId, now);
    if (emailedVisitors.size > 5000) emailedVisitors.clear();
    notify.team("New visitor on kibo360.in",
      `Someone is browsing the website while no support user is online in the admin console.\n\nLocation: ${v.location || "Unknown"}\nPage: ${v.page || "/"}\nTime: ${new Date().toISOString()}\n\nOpen the admin console to chat live: https://kibo360.in/admin/chat`);
  }

  const newChat = (visitorId, visitor) => ({
    id: crypto.randomUUID(), visitorId, createdAt: new Date().toISOString(), status: "open", unread: 0, lastAlertAt: null, visitor, messages: [],
  });

  function registerRoutes(app) {
    app.post("/api/presence/ping", (req, res) => {
      if (limited(`ping:${req.ip || "unknown"}`, 600)) return res.status(429).json({ ok: false });
      const { visitorId, page } = req.body || {};
      if (!VID_RE.test(String(visitorId || ""))) return res.status(400).json({ ok: false });
      const now = Date.now();
      let v = visitors.get(visitorId);
      if (!v) {
        v = { firstSeen: now, ip: req.ip, location: null };
        visitors.set(visitorId, v);
        if (visitors.size > 2000) for (const id of visitors.keys()) { if (visitors.size <= 1500) break; visitors.delete(id); }
        v.page = String(page || "/").slice(0, 200);
        lookupLocation(req.ip).then((loc) => { if (loc) v.location = loc; if (!anyAdminOnline()) sendVisitorAlert(visitorId, v); });
      }
      v.lastSeen = now;
      v.page = String(page || "/").slice(0, 200);
      res.json({ ok: true, agentOnline: anyAdminOnline(), hasChat: visitorHasChat(visitorId) });
    });

    app.post("/api/chat/message", (req, res) => {
      const ip = req.ip || "unknown";
      if (limited(`msg:${ip}`, 60)) return res.status(429).json({ ok: false, error: "Too many messages. Please slow down." });
      const { visitorId, from, text, page } = req.body || {};
      if (!VID_RE.test(String(visitorId || ""))) return res.status(400).json({ ok: false, error: "Bad visitor id" });
      if (!["visitor", "bot"].includes(from)) return res.status(400).json({ ok: false, error: "Bad sender" });
      const clean = String(text || "").trim().slice(0, 1500);
      if (!clean) return res.status(400).json({ ok: false, error: "Empty message" });
      const chats = loadChats();
      let chat = chats.find((c) => c.visitorId === visitorId);
      if (!chat) {
        if (limited(`newchat:${ip}`, 15, 60 * 60 * 1000)) return res.status(429).json({ ok: false, error: "Too many new conversations." });
        const pv = visitors.get(visitorId);
        chat = newChat(visitorId, { ip, location: pv?.location || null, page: String(page || pv?.page || "/").slice(0, 200) });
        chats.push(chat);
      }
      if (chat.messages.length >= 400) return res.status(429).json({ ok: false, error: "This conversation is full." });
      if (!chat.visitor.location) { const pv = visitors.get(visitorId); if (pv?.location) chat.visitor.location = pv.location; }
      if (page) chat.visitor.page = String(page).slice(0, 200);
      const msg = { from, text: clean, at: new Date().toISOString() };
      chat.messages.push(msg);
      chat.lastActiveAt = msg.at;
      let alert = false;
      if (from === "visitor") {
        chat.unread = (chat.unread || 0) + 1;
        chat.status = "open";
        const lastAlert = chat.lastAlertAt ? new Date(chat.lastAlertAt).getTime() : 0;
        if (!anyAdminOnline() && Date.now() - lastAlert > 6 * 60 * 60 * 1000) { chat.lastAlertAt = msg.at; alert = true; }
      }
      saveChats(pruneChats(chats));
      if (alert) sendChatAlert(chat, msg);
      res.json({ ok: true, total: chat.messages.length, agentJoined: agentRecently(chat), agentOnline: anyAdminOnline() });
    });

    app.get("/api/chat/messages", (req, res) => {
      const visitorId = String(req.query.visitorId || "");
      if (!VID_RE.test(visitorId)) return res.status(400).json({ ok: false, error: "Bad visitor id" });
      const chat = loadChats().find((c) => c.visitorId === visitorId);
      const agentOnline = anyAdminOnline();
      if (!chat) return res.json({ ok: true, total: 0, messages: [], agentJoined: false, agentOnline });
      const after = Math.max(0, Number(req.query.after) || 0);
      res.json({ ok: true, total: chat.messages.length, messages: chat.messages.slice(after).map(({ from, name, text, at }) => ({ from, name, text, at })), agentJoined: agentRecently(chat), agentOnline, status: chat.status });
    });

    app.get("/api/admin/chats", requireAuth("chats"), (req, res) => {
      adminWatch.set(req.user.id, Date.now());
      const rawChats = loadChats();
      const chats = rawChats.slice().sort((a, b) => new Date(b.lastActiveAt || b.createdAt) - new Date(a.lastActiveAt || a.createdAt)).map((c) => {
        const last = c.messages[c.messages.length - 1];
        const v = visitors.get(c.visitorId);
        return {
          id: c.id, createdAt: c.createdAt, lastActiveAt: c.lastActiveAt || c.createdAt, status: c.status, unread: c.unread || 0,
          location: c.visitor?.location || "Unknown", page: c.visitor?.page || "-", online: !!v && Date.now() - v.lastSeen < VISITOR_ONLINE_MS,
          messageCount: c.messages.length, lastMessage: last ? { from: last.from, text: String(last.text).slice(0, 120) } : null,
        };
      });
      const online = onlineVisitors();
      const byVisitor = new Map(rawChats.map((c) => [c.visitorId, c.id]));
      res.json({
        ok: true, chats, unreadTotal: chats.reduce((n, c) => n + c.unread, 0),
        presence: { count: online.length, visitors: online.slice(0, 60).map((v) => ({ ...v, chatId: byVisitor.get(v.visitorId) || null })) },
        leadsCount: can(req, "leads.view") ? forms.loadLeads().length : null,
      });
    });

    app.post("/api/admin/chats/start", requireAuth("chats"), (req, res) => {
      const { visitorId, text } = req.body || {};
      if (!VID_RE.test(String(visitorId || ""))) return res.status(400).json({ ok: false, error: "Bad visitor id" });
      const clean = String(text || "").trim().slice(0, 1500);
      if (!clean) return res.status(400).json({ ok: false, error: "Empty message" });
      const chats = loadChats();
      let chat = chats.find((c) => c.visitorId === visitorId);
      if (!chat) { const pv = visitors.get(visitorId); chat = newChat(visitorId, { ip: pv?.ip || null, location: pv?.location || null, page: pv?.page || "/" }); chats.push(chat); }
      const msg = { from: "agent", name: req.user.name, text: clean, at: new Date().toISOString() };
      chat.messages.push(msg);
      chat.lastActiveAt = msg.at;
      chat.status = "open";
      saveChats(chats);
      res.json({ ok: true, chatId: chat.id });
    });

    app.get("/api/admin/chats/:id", requireAuth("chats"), (req, res) => {
      adminWatch.set(req.user.id, Date.now());
      const chats = loadChats();
      const chat = chats.find((c) => c.id === req.params.id);
      if (!chat) return res.status(404).json({ ok: false, error: "Chat not found" });
      if (chat.unread) { chat.unread = 0; saveChats(chats); }
      const v = visitors.get(chat.visitorId);
      res.json({ ok: true, chat: { id: chat.id, createdAt: chat.createdAt, lastActiveAt: chat.lastActiveAt, status: chat.status, location: chat.visitor?.location || "Unknown", page: chat.visitor?.page || "-", online: !!v && Date.now() - v.lastSeen < VISITOR_ONLINE_MS, messages: chat.messages } });
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
      audit.log(req, { action: "chat.delete", target: req.params.id });
      res.json({ ok: true });
    });
  }

  return { registerRoutes, onlineVisitors, loadChats, stop: () => clearInterval(sweep) };
}
