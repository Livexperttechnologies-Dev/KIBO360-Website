import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createStore } from "./lib/store.js";
import { createAudit } from "./lib/audit.js";
import { createAuth } from "./lib/auth.js";
import { createContent } from "./lib/content.js";
import { createMedia } from "./lib/media.js";
import { createSettings } from "./lib/settings.js";
import { createNotify } from "./lib/notify.js";
import { createForms, defaultForms } from "./lib/forms.js";
import { createChat } from "./lib/chat.js";
import { createSeoTools } from "./lib/seoTools.js";
import { apiSecurityHeaders } from "./lib/security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_ORIGINS = [
  "https://kibo360.in", "https://www.kibo360.in", "https://staging.kibo360.in",
  "http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:4599", "http://localhost:5001",
];

export async function createApp({
  dataDir = process.env.DATA_DIR || path.join(__dirname, "data"),
  siteDist = process.env.SITE_DIST || null,
  origins = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
} = {}) {
  const store = createStore(dataDir);
  const audit = createAudit({ store });
  const auth = createAuth({ store, audit });
  const { requireAuth, can } = auth;

  let site = null; // SSR site server, attached below when a build is present
  const content = createContent({
    store, audit, requireAuth, can,
    validators: { defaultForms },
    onPublish: (next, docIds) => site?.invalidate(next, docIds),
    permissionsOf: auth.permissionsOf,
  });
  const settings = createSettings({ store, audit, requireAuth });
  const notify = createNotify({ settings });
  const forms = createForms({ store, audit, requireAuth, can, content, notify });
  const media = createMedia({ store, audit, requireAuth, can, content });
  const chat = createChat({ store, audit, requireAuth, can, settings, notify, forms });
  const seoTools = createSeoTools({ store, audit, requireAuth, content });

  // First boot: publish the default form definitions so the live site and
  // the server validator agree from day one.
  if (!content.loadPublished().docs.forms) {
    content.publishDocs([{ docId: "forms", data: defaultForms() }], { user: null, note: "Initial form definitions", source: "seed" });
  }

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // exactly one hop (Traefik) -> req.ip is the real client
  app.use("/api", apiSecurityHeaders);
  app.use("/api", cors({
    origin: [...new Set([...DEFAULT_ORIGINS, ...origins])],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }));
  app.use("/api/admin", express.json({ limit: "2mb" }));
  app.use("/api", express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "kibo360-backend", time: new Date().toISOString(), contentVersion: content.loadPublished().version || 0 });
  });

  auth.registerRoutes(app);
  content.registerRoutes(app);
  media.registerRoutes(app);
  settings.registerRoutes(app, { sendTestEmail: notify.sendTestEmail });
  forms.registerRoutes(app);
  chat.registerRoutes(app);
  seoTools.registerRoutes(app);

  // ---- audit log ------------------------------------------------------------
  app.get("/api/admin/audit", requireAuth("audit.view"), (req, res) => {
    res.json({ ok: true, entries: audit.query({ limit: req.query.limit, action: req.query.action, userId: req.query.userId, target: req.query.target, since: req.query.since }) });
  });

  // ---- dashboard --------------------------------------------------------------
  app.get("/api/admin/dashboard", requireAuth("dashboard.view"), (req, res) => {
    const pub = content.loadPublished();
    const ids = new Set([...Object.keys(pub.docs), ...content.listDraftIds()]);
    const statuses = [...ids].map((id) => content.docStatus(id, pub));
    const pages = statuses.filter((s) => s.docId.startsWith("page:"));
    const week = Date.now() - 7 * 86400_000;
    const leads = can(req, "leads.view") ? forms.loadLeads() : null;
    const subs = can(req, "submissions.view") || can(req, "leads.view") ? forms.loadSubs() : null;
    const mediaItems = can(req, "media.view") ? media.load().filter((m) => !m.deletedAt) : null;
    const scan = store.readJson("seo-scan.json", null);
    res.json({
      ok: true,
      version: pub.version || 0,
      lastPublishedAt: pub.updatedAt,
      siteServer: !!site,
      content: {
        publishedPages: pages.filter((p) => p.published).length,
        customPages: pages.filter((p) => p.docId.startsWith("page:c-")).length,
        customPublished: pages.filter((p) => p.published && p.docId.startsWith("page:c-")).length,
        drafts: statuses.filter((s) => s.dirty).map((s) => ({ docId: s.docId, label: s.label, updatedAt: s.draftUpdatedAt, updatedBy: s.draftUpdatedBy?.name })),
      },
      schedules: content.loadSchedules().filter((s) => s.status === "pending").map(({ snapshot, ...s }) => s).slice(0, 10),
      leads: leads && {
        total: leads.length,
        new: leads.filter((l) => l.status === "new").length,
        last7d: leads.filter((l) => Date.parse(l.createdAt) >= week).length,
        recent: leads.slice().sort((a, b) => (b.lastActivityAt || "").localeCompare(a.lastActivityAt || "")).slice(0, 6).map((l) => ({ id: l.id, name: l.name, email: l.email, status: l.status, source: l.source, at: l.lastActivityAt })),
      },
      submissions: subs && {
        total: subs.length,
        last7d: subs.filter((s) => Date.parse(s.receivedAt) >= week).length,
        byForm: Object.entries(subs.filter((s) => Date.parse(s.receivedAt) >= Date.now() - 30 * 86400_000).reduce((m, s) => ({ ...m, [s.formName || s.formId]: (m[s.formName || s.formId] || 0) + 1 }), {})),
        daily: Array.from({ length: 14 }, (_, i) => {
          const day = new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10);
          return { day, count: subs.filter((s) => String(s.receivedAt).startsWith(day)).length };
        }),
      },
      media: mediaItems && { count: mediaItems.length, bytes: mediaItems.reduce((n, m) => n + (m.size || 0), 0) },
      seo: scan && { at: scan.at, totals: scan.totals, brokenLinks: scan.brokenLinks?.length || 0, mode: scan.mode },
      chat: can(req, "chats") ? { online: chat.onlineVisitors().length, unread: chat.loadChats().reduce((n, c) => n + (c.unread || 0), 0) } : null,
      recent: can(req, "audit.view") ? audit.query({ limit: 15 }).filter((e) => !e.action.startsWith("auth.")) : [],
    });
  });

  // ---- public site (server-side rendered) when a frontend build is present -----
  if (siteDist) {
    const { createSite } = await import("./lib/site.js");
    site = await createSite({ siteDist, content, store, media });
    if (site) site.mount(app);
  }

  app.use("/api", (_req, res) => res.status(404).json({ ok: false, error: "Not found" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(`[error] ${req.method} ${req.path}:`, err);
    if (res.headersSent) return;
    res.status(status).json({ ok: false, error: status >= 500 ? (err.code === "ECORRUPT" ? err.message : "Something went wrong on our side") : err.message });
  });

  const close = () => { content.stop(); chat.stop(); };
  return { app, services: { store, audit, auth, content, media, settings, forms, chat }, close, hasSite: !!site };
}
