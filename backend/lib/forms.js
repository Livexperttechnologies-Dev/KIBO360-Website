import { newId, clampStr, rateLimit } from "./security.js";
import { normForms } from "./schema.js";

// ---------------------------------------------------------------------------
// Forms, submissions and leads.
// - Form DEFINITIONS are content (draft -> publish, doc "forms").
// - Submissions are validated server-side against the PUBLISHED definition,
//   so a tampered client can't smuggle extra fields or skip required ones.
// - Every submission is linked to a Lead (deduplicated by email, else phone).
// - UTM / click-id / landing page / referrer are captured when present.
// ---------------------------------------------------------------------------

const SUBS = "submissions.json";
const LEADS = "leads.json";
export const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost", "closed"];
const TIME_SLOTS = ["10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
const PHONE_RE = /^[+]?[0-9][0-9\s\-().]{6,}$/;

export function defaultForms() {
  const f = (id, type, name, submitLabel, fields, extra = {}) => ({
    id, type, name, enabled: true, submitLabel, fields,
    success: { mode: "redirect", redirect: "/thank-you", message: "" },
    notify: { team: true, autoReply: true, extraEmails: [] },
    spam: { honeypot: true, minSeconds: 3 },
    leadStage: "new",
    ...extra,
  });
  const name = { id: "name", type: "text", label: "Full Name", placeholder: "Dr. A. Sharma", required: true, width: "half", mapTo: "name", pattern: "letters", maxLength: 120 };
  const email = { id: "email", type: "email", label: "Email", placeholder: "you@example.com", required: true, width: "half", mapTo: "email" };
  const phone = { id: "phone", type: "tel", label: "Phone", placeholder: "+91-98xxxxxxx", required: false, width: "half", mapTo: "phone", pattern: "phone", maxLength: 20 };
  const org = { id: "organization", type: "text", label: "Organization", placeholder: "Hospital / Clinic name", required: false, width: "half", mapTo: "organization", maxLength: 200 };
  const message = { id: "message", type: "textarea", label: "Message", placeholder: "Tell us about your requirements - beds, departments, locations…", required: true, width: "full", mapTo: "message", maxLength: 5000 };
  return normForms({
    forms: [
      f("demo", "demo", "Book a Demo", "Send Message", [
        name, email, phone, org,
        { id: "preferredDate", type: "date", label: "Preferred demo date", required: false, width: "full", mapTo: "preferredDate" },
        { id: "preferredTimes", type: "timeslots", label: "Preferred time slots", help: "pick 2-3 - if one is busy, our team uses your next choice", required: false, width: "full", mapTo: "preferredTime", options: TIME_SLOTS, min: 2, max: 3 },
        { id: "product", type: "select", label: "I'm interested in", required: false, width: "full", mapTo: "product", options: ["General enquiry", "Hospital Management Software (HMS)", "Clinic Management Software (CMS)", "Partnership"] },
        message,
      ]),
      f("contact", "contact", "Contact Us", "Send Message", [name, email, phone, { ...message, label: "How can we help?" }]),
      f("callback", "callback", "Request a Callback", "Call Me Back", [
        { ...name, width: "full" },
        { ...phone, required: true, width: "full" },
        { id: "preferredTimes", type: "timeslots", label: "Best time to call", required: false, width: "full", mapTo: "preferredTime", options: TIME_SLOTS, min: 1, max: 3 },
        { ...message, required: false, label: "Anything we should know?" },
      ]),
      f("partner", "partner", "Partner With Us", "Apply to Partner", [
        name, email, phone, { ...org, label: "Company", required: true },
        { id: "partnerType", type: "select", label: "Partnership type", required: true, width: "full", options: ["Reseller / Channel partner", "Implementation partner", "Technology / integration partner", "Referral partner"] },
        { ...message, label: "Tell us about your business" },
      ]),
      f("newsletter", "newsletter", "Newsletter", "Subscribe", [
        { ...email, width: "full", label: "Email address" },
        { id: "consent", type: "consent", label: "Consent", required: true, width: "full", html: "I agree to receive product updates from KIBO360. Unsubscribe any time." },
      ], { success: { mode: "message", redirect: "/thank-you", message: "Thanks for subscribing!" }, notify: { team: false, autoReply: true, extraEmails: [] } }),
    ],
  });
}

/** Validate one value against a field definition. Returns [value, error]. */
function checkField(field, raw) {
  const empty = raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0) || raw === false;
  if (empty) return field.required ? [null, `${field.label || field.id} is required.`] : [field.type === "timeslots" || field.type === "checkbox" ? [] : "", null];
  const max = field.maxLength || (field.type === "textarea" ? 5000 : 300);
  const str = () => clampStr(raw, max).trim();
  switch (field.type) {
    case "email": { const v = str(); return EMAIL_RE.test(v) ? [v, null] : [null, "Please enter a valid email address."]; }
    case "tel": { const v = str(); return PHONE_RE.test(v) ? [v, null] : [null, "Please enter a valid phone number."]; }
    case "url": {
      const v = str();
      try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? [u.toString(), null] : [null, "Please enter a valid web address."]; } catch { return [null, "Please enter a valid web address."]; }
    }
    case "number": { const n = Number(raw); return Number.isFinite(n) ? [n, null] : [null, `${field.label} must be a number.`]; }
    case "date": { const v = str(); return /^\d{4}-\d{2}-\d{2}$/.test(v) || (!Number.isNaN(Date.parse(v)) && v.length < 60) ? [v, null] : [null, "Please pick a valid date."]; }
    case "select": case "radio": { const v = str(); return (field.options || []).includes(v) ? [v, null] : [null, `Please choose a valid ${field.label || "option"}.`]; }
    case "checkbox": {
      const arr = (Array.isArray(raw) ? raw : [raw]).map((x) => String(x));
      const ok = arr.every((x) => (field.options || []).includes(x));
      return ok ? [arr.slice(0, 40), null] : [null, `Please choose valid options for ${field.label}.`];
    }
    case "timeslots": {
      const arr = [...new Set((Array.isArray(raw) ? raw : String(raw).split(",")).map((x) => String(x).trim()).filter(Boolean))];
      if (!arr.every((x) => (field.options || []).includes(x))) return [null, "Please pick valid time slots."];
      if (arr.length > (field.max || 3)) return [null, `Pick at most ${field.max || 3} time slots.`];
      if (arr.length && arr.length < (field.min || 0)) return [null, `Please select ${field.min}-${field.max || 3} time slots, so we have a backup if one is busy.`];
      return [arr, null];
    }
    case "consent": return raw === true || raw === "true" || raw === "on" ? [true, null] : [null, "Please accept to continue."];
    case "hidden": return [clampStr(field.value ?? raw, 200), null];
    default: {
      const v = str();
      if (field.pattern === "letters" && !NAME_RE.test(v)) return [null, `${field.label || "This field"} can contain letters only.`];
      if (field.pattern === "digits" && !/^\d+$/.test(v)) return [null, `${field.label || "This field"} can contain digits only.`];
      if (field.pattern === "phone" && !PHONE_RE.test(v)) return [null, "Please enter a valid phone number."];
      return [v, null];
    }
  }
}

function cleanContext(c) {
  const src = c && typeof c === "object" ? c : {};
  const s = (v, n = 300) => clampStr(v, n).trim();
  const utm = (u) => {
    const o = u && typeof u === "object" ? u : {};
    const out = {};
    for (const k of ["source", "medium", "campaign", "term", "content"]) if (o[k]) out[k] = s(o[k], 150);
    return out;
  };
  return {
    page: s(src.page, 300),
    referrer: s(src.referrer, 500),
    landingPage: s(src.landingPage, 300),
    utm: utm(src.utm),
    firstTouch: src.firstTouch && typeof src.firstTouch === "object"
      ? { utm: utm(src.firstTouch.utm), referrer: s(src.firstTouch.referrer, 500), landingPage: s(src.firstTouch.landingPage, 300), at: s(src.firstTouch.at, 40) }
      : null,
    gclid: s(src.gclid, 200),
    fbclid: s(src.fbclid, 200),
    channel: s(src.channel, 40) || "website",
  };
}

const csvCell = (v) => {
  let s = v == null ? "" : Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
  return `"${s.replace(/"/g, '""')}"`;
};
const toCsv = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

export function createForms({ store, audit, requireAuth, can, content, notify }) {
  const loadSubs = () => store.readJson(SUBS, []) || [];
  const saveSubs = (list) => store.writeJson(SUBS, list, { backup: true });
  const loadLeads = () => store.readJson(LEADS, []) || [];
  const saveLeads = (list) => store.writeJson(LEADS, list, { backup: true });

  /** The live form definitions (published), or the built-in defaults. */
  function liveForms() {
    const pub = content.loadPublished();
    const forms = pub.docs.forms?.data?.forms;
    return Array.isArray(forms) && forms.length ? forms : defaultForms().forms;
  }

  // -------------------------------------------------------------- migration
  function migrateLegacy() {
    const subs = loadSubs();
    if (!subs.some((s) => !s.formId)) return;
    store.writeJson("submissions.legacy-backup.json", subs);
    const leads = loadLeads();
    const migrated = subs.map((s) => {
      if (s.formId) return s;
      const isChat = /chat/i.test(s.product || "");
      const lead = { name: s.name, email: s.email, phone: s.phone, organization: s.organization, product: s.product, message: s.message, preferredDate: s.preferredDate, preferredTime: s.preferredTime };
      return {
        id: s.id || newId("sub_"), formId: isChat ? "chat-booking" : "demo", formName: isChat ? "Chat booking" : "Book a Demo",
        receivedAt: s.receivedAt || new Date().toISOString(),
        values: lead, lead, context: { channel: isChat ? "chatbot" : "website", migrated: true }, legacyStatus: s.status || "new",
      };
    });
    for (const s of migrated) linkLead(leads, s, s.legacyStatus);
    saveSubs(migrated);
    saveLeads(leads);
    console.log(`[forms] migrated ${migrated.length} legacy submissions into ${leads.length} leads`);
  }

  function linkLead(leads, sub, status = null) {
    const L = sub.lead || {};
    const key = (L.email || "").toLowerCase() || (L.phone || "").replace(/\D/g, "");
    let lead = key ? leads.find((l) => (l.email && l.email.toLowerCase() === key) || (!l.email && l.phoneKey === key)) : null;
    const now = sub.receivedAt;
    if (!lead) {
      lead = {
        id: newId("ld_"), email: L.email || "", phoneKey: (L.phone || "").replace(/\D/g, ""), name: L.name || "", phone: L.phone || "",
        organization: L.organization || "", status: status || "new", owner: null, tags: [], notes: [],
        source: sub.context?.firstTouch?.utm?.source || sub.context?.utm?.source || (sub.context?.referrer ? "referral" : sub.context?.channel || "direct"),
        firstTouch: sub.context?.firstTouch || null, landingPage: sub.context?.firstTouch?.landingPage || sub.context?.landingPage || "",
        submissions: [], forms: [], createdAt: now, lastActivityAt: now,
      };
      leads.push(lead);
    }
    for (const k of ["name", "phone", "organization"]) if (L[k] && !lead[k]) lead[k] = L[k];
    lead.submissions = [...new Set([...(lead.submissions || []), sub.id])];
    lead.forms = [...new Set([...(lead.forms || []), sub.formId])];
    if (now > (lead.lastActivityAt || "")) lead.lastActivityAt = now;
    sub.leadId = lead.id;
    return lead;
  }

  // --------------------------------------------------------------- submit
  function acceptSubmission({ form, values, context, req, skipSpam = false }) {
    const errors = {};
    const clean = {};
    for (const field of form.fields) {
      const [v, err] = checkField(field, values?.[field.id]);
      if (err) errors[field.id] = err;
      else clean[field.id] = v;
    }
    if (Object.keys(errors).length) return { errors };
    const lead = {};
    for (const field of form.fields) {
      if (!field.mapTo) continue;
      const v = clean[field.id];
      lead[field.mapTo] = Array.isArray(v) ? v.join(", ") : v;
    }
    const sub = {
      id: newId("sub_"), formId: form.id, formName: form.name, receivedAt: new Date().toISOString(),
      values: clean, lead, context: cleanContext(context),
      ip: req.ip || null, userAgent: clampStr(req.headers["user-agent"], 200),
    };
    const subs = loadSubs();
    subs.push(sub);
    const leads = loadLeads();
    linkLead(leads, sub, form.leadStage);
    saveSubs(subs);
    saveLeads(leads);
    notify.submission(sub, form).catch?.(() => {});
    return { sub };
  }

  const submitLimiter = rateLimit({ windowMs: 10 * 60_000, max: 12, message: "Too many submissions from your network - please try again later." });

  function registerRoutes(app) {
    // ---- public: form definitions are part of published content; this is
    // a convenience endpoint for clients that need just one form.
    app.get("/api/forms/:formId", (req, res) => {
      const form = liveForms().find((f) => f.id === req.params.formId && f.enabled);
      if (!form) return res.status(404).json({ ok: false, error: "Form not found" });
      const { notify, ...pub } = form; // notification addresses are internal
      res.json({ ok: true, form: pub });
    });

    app.post("/api/forms/:formId/submit", submitLimiter, (req, res) => {
      const form = liveForms().find((f) => f.id === req.params.formId && f.enabled);
      if (!form) return res.status(404).json({ ok: false, error: "This form is no longer available" });
      const b = req.body || {};
      if (form.spam?.honeypot !== false && b.hp) return res.status(201).json({ ok: true, id: "ok" }); // silently drop bots
      // Prefer the browser-measured elapsed time; the legacy absolute
      // startedAt is only trusted when it isn't in the future (clock skew).
      const elapsed = Number.isFinite(Number(b.elapsedMs)) ? Number(b.elapsedMs)
        : Number.isFinite(Number(b.startedAt)) ? Date.now() - Number(b.startedAt) : null;
      if (form.spam?.minSeconds && elapsed !== null && elapsed >= 0 && elapsed < form.spam.minSeconds * 1000) {
        return res.status(400).json({ ok: false, errors: { _global: "That was quick! Please take a moment and submit again." } });
      }
      const { errors, sub } = acceptSubmission({ form, values: b.values, context: b.context, req });
      if (errors) return res.status(400).json({ ok: false, errors });
      console.log(`[forms] ${form.id} submission ${sub.id} from ${sub.lead.email || sub.lead.phone || "anonymous"}`);
      res.status(201).json({ ok: true, id: sub.id, success: form.success });
    });

    // Legacy endpoint (old contact form + chatbot booking) -> "demo" form.
    app.post("/api/contact", submitLimiter, (req, res) => {
      const b = req.body || {};
      const base = liveForms().find((f) => f.id === "demo") || defaultForms().forms[0];
      const isChat = /chat/i.test(String(b.product || ""));
      const form = isChat
        ? { ...base, id: "chat-booking", name: "Chat booking", fields: base.fields.map((f) => (f.type === "select" ? { ...f, type: "text" } : f.type === "timeslots" ? { ...f, type: "text", mapTo: "preferredTime" } : f.type === "date" ? { ...f, type: "text" } : f)) }
        : { ...base, fields: base.fields.map((f) => (f.type === "select" ? { ...f, type: "text" } : f)) };
      const values = {
        name: b.name, email: b.email, phone: b.phone, organization: b.organization, message: b.message,
        product: b.product, preferredDate: b.preferredDate, preferredTimes: b.preferredTime || b.preferredTimes,
      };
      const { errors, sub } = acceptSubmission({ form, values, context: b.context || { channel: isChat ? "chatbot" : "website" }, req });
      if (errors) {
        // keep the old response shape: errors keyed by the legacy field names
        const legacy = {};
        for (const [k, v] of Object.entries(errors)) legacy[k === "preferredTimes" ? "preferredTime" : k] = v;
        return res.status(400).json({ ok: false, errors: legacy });
      }
      res.status(201).json({ ok: true, id: sub.id });
    });

    // ---- admin: submissions ---------------------------------------------
    const filterSubs = (q) => {
      let list = loadSubs();
      if (q.formId) list = list.filter((s) => s.formId === q.formId);
      if (q.from) list = list.filter((s) => s.receivedAt >= q.from);
      if (q.to) list = list.filter((s) => s.receivedAt <= q.to + "T23:59:59");
      if (q.q) { const needle = String(q.q).toLowerCase(); list = list.filter((s) => JSON.stringify(s.values).toLowerCase().includes(needle)); }
      return list.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    };
    app.get("/api/admin/submissions", requireAuth("submissions.view"), (req, res) => {
      const list = filterSubs(req.query);
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
      res.json({ ok: true, total: list.length, submissions: list.slice(0, limit), forms: [...new Set(loadSubs().map((s) => s.formId))] });
    });
    app.get("/api/admin/submissions/export.csv", requireAuth("leads.export"), (req, res) => {
      const list = filterSubs(req.query);
      const keys = [...new Set(list.flatMap((s) => Object.keys(s.values || {})))];
      const rows = [["Received", "Form", ...keys, "Page", "Landing page", "Referrer", "UTM source", "UTM medium", "UTM campaign", "Lead ID"]];
      for (const s of list) rows.push([s.receivedAt, s.formName, ...keys.map((k) => s.values?.[k]), s.context?.page, s.context?.firstTouch?.landingPage || s.context?.landingPage, s.context?.referrer, s.context?.utm?.source, s.context?.utm?.medium, s.context?.utm?.campaign, s.leadId]);
      audit.log(req, { action: "submissions.export", target: req.query.formId || "all", details: { rows: list.length } });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="kibo360-submissions-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(toCsv(rows));
    });
    app.delete("/api/admin/submissions/:id", requireAuth("leads.delete"), (req, res) => {
      const subs = loadSubs();
      const s = subs.find((x) => x.id === req.params.id);
      if (!s) return res.status(404).json({ ok: false, error: "Not found" });
      saveSubs(subs.filter((x) => x.id !== s.id));
      const leads = loadLeads();
      for (const l of leads) l.submissions = (l.submissions || []).filter((id) => id !== s.id);
      saveLeads(leads);
      audit.log(req, { action: "submission.delete", target: s.id, details: { formId: s.formId } });
      res.json({ ok: true });
    });

    // ---- admin: leads -----------------------------------------------------
    const filterLeads = (q) => {
      let list = loadLeads();
      if (q.status) list = list.filter((l) => l.status === q.status);
      if (q.form) list = list.filter((l) => (l.forms || []).includes(q.form));
      if (q.source) list = list.filter((l) => l.source === q.source);
      if (q.q) { const n = String(q.q).toLowerCase(); list = list.filter((l) => [l.name, l.email, l.phone, l.organization, ...(l.tags || [])].join(" ").toLowerCase().includes(n)); }
      return list.sort((a, b) => (b.lastActivityAt || "").localeCompare(a.lastActivityAt || ""));
    };
    app.get("/api/admin/leads", requireAuth("leads.view"), (req, res) => {
      const list = filterLeads(req.query);
      const all = loadLeads();
      const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, all.filter((l) => l.status === s).length]));
      res.json({ ok: true, total: list.length, leads: list.slice(0, 500), counts, statuses: LEAD_STATUSES, sources: [...new Set(all.map((l) => l.source).filter(Boolean))] });
    });
    app.get("/api/admin/leads/export.csv", requireAuth("leads.export"), (req, res) => {
      const list = filterLeads(req.query);
      const rows = [["Created", "Last activity", "Name", "Email", "Phone", "Organization", "Status", "Owner", "Source", "Landing page", "Forms", "Submissions", "Tags"]];
      for (const l of list) rows.push([l.createdAt, l.lastActivityAt, l.name, l.email, l.phone, l.organization, l.status, l.owner?.name, l.source, l.landingPage, (l.forms || []).join("; "), (l.submissions || []).length, (l.tags || []).join("; ")]);
      audit.log(req, { action: "leads.export", target: req.query.status || "all", details: { rows: list.length } });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="kibo360-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(toCsv(rows));
    });
    app.get("/api/admin/leads/:id", requireAuth("leads.view"), (req, res) => {
      const lead = loadLeads().find((l) => l.id === req.params.id);
      if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });
      const subs = loadSubs().filter((s) => (lead.submissions || []).includes(s.id)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      res.json({ ok: true, lead, submissions: can(req, "submissions.view") ? subs : subs.map(({ values, ...s }) => s) });
    });
    app.patch("/api/admin/leads/:id", requireAuth("leads.edit"), (req, res) => {
      const leads = loadLeads();
      const lead = leads.find((l) => l.id === req.params.id);
      if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });
      const b = req.body || {};
      const changes = {};
      if (b.status != null) {
        if (!LEAD_STATUSES.includes(b.status)) return res.status(400).json({ ok: false, error: "Invalid status" });
        lead.status = b.status; changes.status = b.status;
      }
      if (b.owner !== undefined) { lead.owner = b.owner ? { id: clampStr(b.owner.id, 40), name: clampStr(b.owner.name, 120) } : null; changes.owner = lead.owner?.name || null; }
      if (Array.isArray(b.tags)) { lead.tags = [...new Set(b.tags.map((t) => clampStr(t, 30).trim().toLowerCase()).filter(Boolean))].slice(0, 20); changes.tags = lead.tags; }
      if (b.note) {
        lead.notes = [...(lead.notes || []), { id: newId("n_"), text: clampStr(b.note, 2000), at: new Date().toISOString(), by: req.user.name }].slice(-200);
        changes.note = true;
      }
      for (const k of ["name", "phone", "organization"]) if (typeof b[k] === "string") { lead[k] = clampStr(b[k], 200).trim(); changes[k] = lead[k]; }
      lead.updatedAt = new Date().toISOString();
      saveLeads(leads);
      audit.log(req, { action: "lead.update", target: lead.email || lead.phone || lead.id, details: changes });
      res.json({ ok: true, lead });
    });
    app.delete("/api/admin/leads/:id", requireAuth("leads.delete"), (req, res) => {
      const leads = loadLeads();
      const lead = leads.find((l) => l.id === req.params.id);
      if (!lead) return res.status(404).json({ ok: false, error: "Lead not found" });
      saveLeads(leads.filter((l) => l.id !== lead.id));
      // Right to erasure: remove the person's submissions too.
      const ids = new Set(lead.submissions || []);
      saveSubs(loadSubs().filter((s) => !ids.has(s.id)));
      audit.log(req, { action: "lead.delete", target: lead.email || lead.phone || lead.id, details: { submissions: ids.size } });
      res.json({ ok: true });
    });
  }

  migrateLegacy();

  return { registerRoutes, liveForms, loadLeads, loadSubs };
}
