import { randomToken, sha256, newId, clampStr, rateLimit } from "./security.js";
import { DOC_ID_RE, docType, normalizeDoc, PATCHABLE, ValidationError, normPage, validSlug, analyzeRedirects } from "./schema.js";

// ---------------------------------------------------------------------------
// Content engine: Draft -> Preview -> Publish -> Live.
//
//   content/drafts/<doc>.json    working copy per document (autosaved)
//   content/published.json       ALL live documents in ONE file, replaced
//                                atomically (tmp + rename). A publish either
//                                fully lands or leaves the old live file
//                                untouched - there is no partial state.
//   content/revisions/<doc>.json every published version (restore/compare)
//   content/schedules.json       frozen snapshots queued for a future time
//   content/previews.json        hashed, expiring preview tokens
//
// Live visitors only ever read published.json.
// ---------------------------------------------------------------------------

const PUB = "content/published.json";
const SCHED = "content/schedules.json";
const PREV = "content/previews.json";
const MAX_REVISIONS = 100;
const safeName = (docId) => docId.replace(":", "__");
const draftFile = (docId) => `content/drafts/${safeName(docId)}.json`;
const revFile = (docId) => `content/revisions/${safeName(docId)}.json`;

/** Deterministic stringify (sorted keys) for change detection. */
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
const same = (a, b) => stable(a ?? {}) === stable(b ?? {});
const who = (u) => (u ? { id: u.id, name: u.name, email: u.email } : { id: "system", name: "System", email: null });

/** Public copy of a document: internal notification addresses stay private. */
export function publicData(docId, data) {
  if (docId === "site" && Array.isArray(data?.code?.snippets)) {
    return { ...data, code: { snippets: data.code.snippets.filter((s) => s.enabled !== false) } };
  }
  if (docId !== "forms" || !Array.isArray(data?.forms)) return data;
  return { ...data, forms: data.forms.map(({ notify, ...f }) => f) };
}
/** Did the custom code (header/footer scripts) change between two site versions? */
export const codeChanged = (a, b) => stable(a?.code?.snippets || []) !== stable(b?.code?.snippets || []);

export function createContent({ store, audit, requireAuth, can, validators = {}, onPublish = () => {}, permissionsOf = null }) {
  // ---------------------------------------------------------------- stores
  const loadPublished = () => {
    const p = store.readJson(PUB, null);
    return p && typeof p === "object" && p.docs ? p : { version: 0, updatedAt: null, docs: {} };
  };
  const loadDraft = (docId) => store.readJson(draftFile(docId), null);
  const saveDraft = (docId, rec) => store.writeJson(draftFile(docId), rec);
  const deleteDraft = (docId) => store.remove(draftFile(docId));
  const loadRevisions = (docId) => store.readJson(revFile(docId), []) || [];

  function listDraftIds() {
    return store.listDir("content/drafts")
      .filter((n) => n.endsWith(".json"))
      .map((n) => n.slice(0, -5).replace("__", ":"))
      .filter((id) => DOC_ID_RE.test(id) && loadDraft(id));
  }

  /** The working copy: draft if there is one, else the live version. */
  function workingData(docId, pub = loadPublished()) {
    const d = loadDraft(docId);
    if (d?.data) return d.data;
    return pub.docs[docId]?.data || emptyDoc(docId);
  }
  function emptyDoc(docId) {
    return docType(docId) === "page" ? normPage({}) : docType(docId) === "forms" ? (validators.defaultForms?.() || { forms: [] }) : {};
  }

  function docStatus(docId, pub = loadPublished()) {
    const d = loadDraft(docId);
    const p = pub.docs[docId];
    const dirty = !!d?.data && !same(d.data, p?.data || emptyDoc(docId));
    const sched = loadSchedules().filter((s) => s.status === "pending" && s.docIds.includes(docId));
    return {
      docId,
      published: !!p,
      publishedRev: p?.rev || 0,
      publishedAt: p?.publishedAt || null,
      publishedBy: p?.publishedBy || null,
      hasDraft: !!d?.data,
      dirty,
      draftUpdatedAt: d?.updatedAt || null,
      draftUpdatedBy: d?.updatedBy || null,
      scheduled: sched.map((s) => ({ id: s.id, at: s.at })),
      label: (d?.data || p?.data)?.meta?.label || null,
      slug: (d?.data || p?.data)?.meta?.slug || null,
    };
  }

  // ------------------------------------------------------------ permissions
  function editPermFor(docId, key) {
    const t = docType(docId);
    if (t === "page") return key === "seo" ? ["seo.edit", "pages.edit"] : ["pages.edit"];
    if (t === "site") return key === "code" ? ["site.code"] : ["site.edit"];
    if (t === "seo") return ["seo.edit"];
    if (t === "forms") return ["forms.edit"];
    return ["__none__"];
  }
  /** Which publish permission is needed, based on what actually changed. */
  function publishPermFor(docId, draftData, pubData) {
    const t = docType(docId);
    if (t === "page") {
      // Compare against the normalized empty doc when never published, so an
      // empty layout skeleton doesn't count as a content change.
      const baseline = pubData || emptyDoc(docId);
      const changed = PATCHABLE.page.filter((k) => !same(draftData?.[k], baseline?.[k]));
      if (changed.length && changed.every((k) => k === "seo")) return ["pages.publish", "seo.publish"];
      return ["pages.publish"];
    }
    return [{ site: "site.publish", seo: "seo.publish", forms: "forms.publish" }[t] || "__none__"];
  }
  const hasAny = (req, perms) => perms.some((p) => can(req, p));
  /** Parts of a doc this user may NOT edit (only the site doc has split permissions). */
  const lockedKeys = (req, docId) => (docType(docId) === "site" ? PATCHABLE.site.filter((k) => !hasAny(req, editPermFor(docId, k))) : []);
  const mayEditSome = (req, docId) => (docType(docId) === "site" ? PATCHABLE.site.some((k) => hasAny(req, editPermFor(docId, k))) : hasAny(req, editPermFor(docId, "fields")));
  /** Copy the parts this user may not edit from `from` onto `into`. */
  function keepLocked(req, docId, into, from) {
    for (const k of lockedKeys(req, docId)) { if (from?.[k] === undefined) delete into[k]; else into[k] = structuredClone(from[k]); }
    return into;
  }
  /**
   * May someone with permission check `has` publish this version? Publishing
   * changed custom code additionally needs "site.code" - otherwise anyone with
   * site.publish could push someone else's script live.
   */
  function mayPublish(has, docId, draftData, pubData) {
    if (!publishPermFor(docId, draftData, pubData).some(has)) return false;
    if (docType(docId) === "site" && codeChanged(draftData, pubData) && !has("site.code")) return false;
    return true;
  }

  // --------------------------------------------------------------- publish
  function publishDocs(entries, { user, note = "", source = "publish" }) {
    const pub = loadPublished();
    const next = { version: (pub.version || 0) + 1, updatedAt: new Date().toISOString(), docs: { ...pub.docs } };
    const revs = [];
    for (const { docId, data, remove } of entries) {
      if (!DOC_ID_RE.test(docId)) throw new ValidationError(`Invalid document id ${docId}`);
      if (remove) { delete next.docs[docId]; revs.push({ docId, removed: true }); continue; }
      const clean = normalizeDoc(docId, data, { strict: true }); // throws on invalid JSON-LD etc.
      if (docId === "seo" && clean.redirects) {
        const errors = analyzeRedirects(clean.redirects).filter((i) => i.level === "error");
        if (errors.length) throw new ValidationError(`Fix redirect errors before publishing: ${errors[0].message}`, errors);
      }
      if (docType(docId) === "page" && clean.meta?.slug) {
        const clash = Object.entries(next.docs).find(([id, d]) => id !== docId && d.data?.meta?.slug === clean.meta.slug);
        if (clash) throw new ValidationError(`Another page already uses the URL ${clean.meta.slug}`);
      }
      const rev = (pub.docs[docId]?.rev || 0) + 1;
      next.docs[docId] = { data: clean, rev, publishedAt: next.updatedAt, publishedBy: who(user) };
      revs.push({ docId, rev, data: clean });
    }
    // ---- the atomic switch: one rename replaces the whole live set ----
    store.writeJson(PUB, next, { backup: true });
    // Revisions are appended after the switch (best effort, never blocks live).
    for (const r of revs) {
      if (r.removed) continue;
      try {
        const list = loadRevisions(r.docId);
        list.push({ rev: r.rev, data: r.data, publishedAt: next.updatedAt, publishedBy: who(user), note: clampStr(note, 300), source });
        store.writeJson(revFile(r.docId), list.slice(-MAX_REVISIONS));
      } catch (e) { console.error("[content] revision write failed:", e.message); }
    }
    try { onPublish(next, revs.map((r) => r.docId)); } catch (e) { console.error("[content] onPublish hook failed:", e.message); }
    return next;
  }

  // -------------------------------------------------------------- schedules
  const loadSchedules = () => store.readJson(SCHED, []) || [];
  const saveSchedules = (list) => store.writeJson(SCHED, list.slice(-500));

  function runDueSchedules() {
    const list = loadSchedules();
    const now = Date.now();
    let changed = false;
    for (const s of list) {
      if (s.status !== "pending" || Date.parse(s.at) > now) continue;
      try {
        // re-check the creator's CURRENT rights (they may have been demoted)
        if (permissionsOf && s.createdBy?.id && s.createdBy.id !== "system") {
          const perms = permissionsOf(s.createdBy.id);
          const pubNow = loadPublished();
          const allowed = perms && s.docIds.every((id) => mayPublish((p) => perms.has(p), id, s.snapshot[id], pubNow.docs[id]?.data));
          if (!allowed) throw new ValidationError(`${s.createdBy.name || "The scheduler"} no longer has permission to publish this`);
        }
        publishDocs(Object.entries(s.snapshot).map(([docId, data]) => ({ docId, data })), { user: s.createdBy, note: s.note || "Scheduled publish", source: "schedule" });
        s.status = "done";
        s.doneAt = new Date().toISOString();
        audit.log(null, { action: "content.schedule_published", target: s.docIds.join(", "), actor: s.createdBy });
      } catch (e) {
        s.status = "failed";
        s.error = e.message;
        audit.log(null, { action: "content.schedule_failed", target: s.docIds.join(", "), details: { error: e.message }, actor: s.createdBy });
      }
      changed = true;
    }
    if (changed) saveSchedules(list);
  }
  const scheduler = setInterval(() => { try { runDueSchedules(); } catch (e) { console.error("[content] scheduler:", e.message); } }, 20_000);
  scheduler.unref();

  // --------------------------------------------------------------- previews
  const loadPreviews = () => (store.readJson(PREV, []) || []).filter((p) => Date.parse(p.exp) > Date.now());
  function previewDocs() {
    const pub = loadPublished();
    const docs = {};
    for (const [id, d] of Object.entries(pub.docs)) docs[id] = publicData(id, d.data);
    for (const id of listDraftIds()) docs[id] = publicData(id, loadDraft(id).data);
    return docs;
  }

  // ---------------------------------------------------------------- presence
  const editing = new Map(); // docId -> Map(userId -> {name, at})

  // ------------------------------------------------------------------ routes
  function registerRoutes(app) {
    const docParam = (req, res) => {
      const id = String(req.params.docId || "");
      if (!DOC_ID_RE.test(id)) { res.status(400).json({ ok: false, error: "Invalid document id" }); return null; }
      return id;
    };
    const handle = (fn) => (req, res, next) => {
      try { fn(req, res, next); } catch (e) {
        if (e instanceof ValidationError) return res.status(400).json({ ok: false, error: e.message, details: e.details || null });
        next(e);
      }
    };

    // ---- public ----------------------------------------------------------
    app.get("/api/content/version", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.json({ ok: true, version: loadPublished().version || 0 });
    });

    app.get("/api/content/published", (req, res) => {
      const pub = loadPublished();
      const etag = `"v${pub.version || 0}"`;
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=30, must-revalidate");
      if (req.headers["if-none-match"] === etag) return res.status(304).end();
      const docs = {};
      for (const [id, d] of Object.entries(pub.docs)) docs[id] = publicData(id, d.data);
      res.json({ ok: true, version: pub.version || 0, docs });
    });

    const previewLimiter = rateLimit({ windowMs: 60_000, max: 60 });
    app.get("/api/preview/:token", previewLimiter, (req, res) => {
      const token = String(req.params.token || "");
      if (!/^[a-f0-9]{64}$/.test(token)) return res.status(404).json({ ok: false, error: "Preview link not found" });
      const found = loadPreviews().find((p) => p.tokenHash === sha256(token));
      if (!found) return res.status(404).json({ ok: false, error: "This preview link has expired or was revoked" });
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.json({ ok: true, version: `preview-${Date.now()}`, label: found.label, expiresAt: found.exp, docs: previewDocs() });
    });

    // ---- admin: documents -------------------------------------------------
    app.get("/api/admin/content/docs", requireAuth(["pages.view", "seo.view", "site.edit", "site.code", "forms.edit"]), handle((req, res) => {
      const pub = loadPublished();
      const ids = new Set([...Object.keys(pub.docs), ...listDraftIds()]);
      res.json({ ok: true, version: pub.version || 0, docs: [...ids].sort().map((id) => docStatus(id, pub)) });
    }));

    /** Every working copy at once - what the visual editor renders from. */
    app.get("/api/admin/content/working", requireAuth(["pages.view", "seo.view", "site.edit", "site.code", "forms.edit"]), handle((_req, res) => {
      const pub = loadPublished();
      const ids = new Set([...Object.keys(pub.docs), ...listDraftIds()]);
      const docs = {};
      const published = {};
      for (const id of ids) { docs[id] = workingData(id, pub); if (pub.docs[id]) published[id] = pub.docs[id].data; }
      res.json({ ok: true, version: pub.version || 0, docs, published });
    }));

    app.get("/api/admin/content/doc/:docId", requireAuth(["pages.view", "seo.view", "site.edit", "site.code", "forms.edit"]), handle((req, res) => {
      const docId = docParam(req, res); if (!docId) return;
      const pub = loadPublished();
      const d = loadDraft(docId);
      res.json({
        ok: true,
        docId,
        data: d?.data || pub.docs[docId]?.data || emptyDoc(docId),
        published: pub.docs[docId]?.data || null,
        status: docStatus(docId, pub),
        draftRev: d?.rev || 0,
      });
    }));

    app.patch("/api/admin/content/doc/:docId", requireAuth(), handle((req, res) => {
      const docId = docParam(req, res); if (!docId) return;
      const t = docType(docId);
      const patch = req.body || {};
      const keys = Object.keys(patch).filter((k) => PATCHABLE[t].includes(k));
      if (!keys.length) return res.status(400).json({ ok: false, error: "Nothing to save" });
      for (const k of keys) {
        if (!hasAny(req, editPermFor(docId, k))) return res.status(403).json({ ok: false, error: `You don't have permission to edit ${k}` });
      }
      const pub = loadPublished();
      if (t === "page" && docId.startsWith("page:c-") && !pub.docs[docId] && !loadDraft(docId)) {
        return res.status(404).json({ ok: false, error: "This page no longer exists" });
      }
      const base = structuredClone(workingData(docId, pub));
      for (const k of keys) {
        if (t === "page" && (k === "fields" || k === "lists")) {
          // merge per key; null deletes a single override
          base[k] = base[k] || {};
          for (const [fk, fv] of Object.entries(patch[k] || {})) {
            if (fv === null) delete base[k][fk];
            else base[k][fk] = fv;
          }
        } else {
          base[k] = patch[k];
        }
      }
      if (t === "page" && docId.startsWith("page:c-")) base.meta = { ...(base.meta || {}), template: "custom" };
      const clean = normalizeDoc(docId, base);
      if (t === "site" && keys.includes("code") && codeChanged(workingData(docId, pub), clean)) {
        const k = `code:${req.user.id}:${Math.floor(Date.now() / 60_000)}`;
        if (!editing.auditSeen) editing.auditSeen = new Set();
        if (!editing.auditSeen.has(k)) { editing.auditSeen.add(k); audit.log(req, { action: "content.scripts_edited", target: "site", details: { snippets: (clean.code?.snippets || []).length } }); }
      }
      const prev = loadDraft(docId);
      const rec = { data: clean, rev: (prev?.rev || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: who(req.user) };
      saveDraft(docId, rec);
      // Presence is refreshed by every save.
      const m = editing.get(docId) || new Map();
      m.set(req.user.id, { name: req.user.name, at: Date.now() });
      editing.set(docId, m);
      // Autosave is chatty - audit only the first save of each minute per doc/user.
      const auditKey = `${docId}:${req.user.id}:${Math.floor(Date.now() / 60_000)}`;
      if (!editing.auditSeen) editing.auditSeen = new Set();
      if (!editing.auditSeen.has(auditKey)) {
        editing.auditSeen.add(auditKey);
        if (editing.auditSeen.size > 5000) editing.auditSeen.clear();
        audit.log(req, { action: "content.draft_saved", target: docId, details: { keys } });
      }
      res.json({ ok: true, docId, draftRev: rec.rev, data: clean, status: docStatus(docId) });
    }));

    app.post("/api/admin/content/doc/:docId/discard", requireAuth(), handle((req, res) => {
      const docId = docParam(req, res); if (!docId) return;
      if (!mayEditSome(req, docId)) return res.status(403).json({ ok: false, error: "No permission" });
      const pub = loadPublished();
      if (docId.startsWith("page:c-") && !pub.docs[docId]) return res.status(400).json({ ok: false, error: "This page has never been published - delete it instead" });
      const draft = loadDraft(docId);
      const pubData = pub.docs[docId]?.data;
      const kept = draft ? lockedKeys(req, docId).filter((k) => !same(draft.data?.[k], pubData?.[k])) : [];
      if (kept.length) {
        const data = keepLocked(req, docId, structuredClone(pubData || emptyDoc(docId)), draft.data);
        saveDraft(docId, { data: normalizeDoc(docId, data), rev: (draft.rev || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: who(req.user) });
      } else deleteDraft(docId);
      audit.log(req, { action: "content.draft_discarded", target: docId, details: kept.length ? { kept } : undefined });
      res.json({ ok: true, kept, status: docStatus(docId) });
    }));

    app.post("/api/admin/content/publish", requireAuth(), handle((req, res) => {
      const ids = Array.isArray(req.body?.docIds) ? [...new Set(req.body.docIds)].filter((d) => DOC_ID_RE.test(d)) : [];
      if (!ids.length) return res.status(400).json({ ok: false, error: "Choose what to publish" });
      const pub = loadPublished();
      const entries = [];
      for (const docId of ids) {
        const d = loadDraft(docId);
        const data = d?.data || pub.docs[docId]?.data;
        if (!data) return res.status(400).json({ ok: false, error: `${docId} has nothing to publish` });
        if (!mayPublish((p) => can(req, p), docId, data, pub.docs[docId]?.data)) {
          return res.status(403).json({ ok: false, error: docId === "site" && codeChanged(data, pub.docs[docId]?.data) && !can(req, "site.code") ? "Publishing header/footer script changes needs the scripts permission" : `You don't have permission to publish ${docId}` });
        }
        entries.push({ docId, data });
      }
      const next = publishDocs(entries, { user: req.user, note: req.body?.note });
      // Draft now matches live: clear it so "dirty" is exact.
      for (const { docId } of entries) deleteDraft(docId);
      audit.log(req, { action: "content.publish", target: ids.join(", "), details: { version: next.version, note: clampStr(req.body?.note, 200) } });
      res.json({ ok: true, version: next.version, docs: ids.map((id) => docStatus(id, next)) });
    }));

    app.post("/api/admin/content/unpublish", requireAuth(["pages.publish"]), handle((req, res) => {
      const docId = String(req.body?.docId || "");
      if (!DOC_ID_RE.test(docId) || !docId.startsWith("page:c-")) return res.status(400).json({ ok: false, error: "Only custom pages can be unpublished" });
      const pub = loadPublished();
      if (!pub.docs[docId]) return res.status(400).json({ ok: false, error: "Page is not published" });
      // keep the content as a draft so nothing is lost
      if (!loadDraft(docId)) saveDraft(docId, { data: pub.docs[docId].data, rev: 1, updatedAt: new Date().toISOString(), updatedBy: who(req.user) });
      const next = publishDocs([{ docId, remove: true }], { user: req.user, note: "Unpublished" });
      audit.log(req, { action: "content.unpublish", target: docId });
      res.json({ ok: true, version: next.version, status: docStatus(docId, next) });
    }));

    // ---- revisions ----------------------------------------------------------
    app.get("/api/admin/content/doc/:docId/revisions", requireAuth(["pages.view", "seo.view", "site.edit", "site.code", "forms.edit"]), handle((req, res) => {
      const docId = docParam(req, res); if (!docId) return;
      const list = loadRevisions(docId).map(({ data, ...meta }) => meta).reverse();
      res.json({ ok: true, revisions: list });
    }));
    app.get("/api/admin/content/doc/:docId/revisions/:rev", requireAuth(["pages.view", "seo.view", "site.edit", "site.code", "forms.edit"]), handle((req, res) => {
      const docId = docParam(req, res); if (!docId) return;
      const r = loadRevisions(docId).find((x) => String(x.rev) === String(req.params.rev));
      if (!r) return res.status(404).json({ ok: false, error: "Revision not found" });
      res.json({ ok: true, revision: r });
    }));
    app.post("/api/admin/content/doc/:docId/restore", requireAuth(), handle((req, res) => {
      const docId = docParam(req, res); if (!docId) return;
      if (!mayEditSome(req, docId)) return res.status(403).json({ ok: false, error: "No permission" });
      const r = loadRevisions(docId).find((x) => String(x.rev) === String(req.body?.rev));
      if (!r) return res.status(404).json({ ok: false, error: "Revision not found" });
      const prev = loadDraft(docId);
      const restored = keepLocked(req, docId, structuredClone(r.data), workingData(docId, loadPublished()));
      saveDraft(docId, { data: normalizeDoc(docId, restored), rev: (prev?.rev || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: who(req.user), restoredFrom: r.rev });
      audit.log(req, { action: "content.restore_to_draft", target: docId, details: { rev: r.rev } });
      res.json({ ok: true, status: docStatus(docId) });
    }));

    // ---- schedules ----------------------------------------------------------
    app.get("/api/admin/content/schedules", requireAuth(["pages.view", "seo.view", "site.edit", "site.code", "forms.edit"]), (_req, res) => {
      res.json({ ok: true, schedules: loadSchedules().map(({ snapshot, ...s }) => s).reverse() });
    });
    app.post("/api/admin/content/schedules", requireAuth(), handle((req, res) => {
      const ids = Array.isArray(req.body?.docIds) ? [...new Set(req.body.docIds)].filter((d) => DOC_ID_RE.test(d)) : [];
      const at = Date.parse(req.body?.at);
      if (!ids.length) return res.status(400).json({ ok: false, error: "Choose what to schedule" });
      if (!Number.isFinite(at) || at < Date.now() + 30_000) return res.status(400).json({ ok: false, error: "Pick a time at least one minute in the future" });
      if (at > Date.now() + 366 * 86400_000) return res.status(400).json({ ok: false, error: "Schedules can be at most one year ahead" });
      const pub = loadPublished();
      const snapshot = {};
      for (const docId of ids) {
        const data = loadDraft(docId)?.data;
        if (!data) return res.status(400).json({ ok: false, error: `${docId} has no draft changes to schedule` });
        if (!mayPublish((p) => can(req, p), docId, data, pub.docs[docId]?.data)) return res.status(403).json({ ok: false, error: `You don't have permission to publish ${docId}` });
        snapshot[docId] = normalizeDoc(docId, data, { strict: true });
      }
      const s = { id: newId("s_"), docIds: ids, at: new Date(at).toISOString(), snapshot, note: clampStr(req.body?.note, 200), status: "pending", createdAt: new Date().toISOString(), createdBy: who(req.user) };
      const list = loadSchedules();
      list.push(s);
      saveSchedules(list);
      audit.log(req, { action: "content.schedule", target: ids.join(", "), details: { at: s.at } });
      const { snapshot: _snap, ...meta } = s;
      res.status(201).json({ ok: true, schedule: meta });
    }));
    app.delete("/api/admin/content/schedules/:id", requireAuth(["pages.publish", "seo.publish", "site.publish", "forms.publish"]), (req, res) => {
      const list = loadSchedules();
      const s = list.find((x) => x.id === req.params.id);
      if (!s || s.status !== "pending") return res.status(404).json({ ok: false, error: "Schedule not found" });
      const pub = loadPublished();
      if (s.createdBy?.id !== req.user.id && !s.docIds.every((id) => mayPublish((p) => can(req, p), id, s.snapshot?.[id], pub.docs[id]?.data))) {
        return res.status(403).json({ ok: false, error: "You can only cancel schedules for content you may publish" });
      }
      s.status = "cancelled";
      s.cancelledBy = who(req.user);
      saveSchedules(list);
      audit.log(req, { action: "content.schedule_cancelled", target: s.docIds.join(", ") });
      res.json({ ok: true });
    });

    // ---- preview links --------------------------------------------------------
    app.get("/api/admin/content/previews", requireAuth("pages.view"), (_req, res) => {
      res.json({ ok: true, previews: loadPreviews().map(({ tokenHash, ...p }) => p).reverse() });
    });
    const PREVIEW_PERMS = ["pages.edit", "pages.publish", "seo.edit", "seo.publish", "site.edit", "site.publish", "forms.edit", "forms.publish"];
    app.post("/api/admin/content/previews", requireAuth(PREVIEW_PERMS), (req, res) => {
      const hours = Math.min(24 * 30, Math.max(1, Number(req.body?.hours) || 72));
      const token = randomToken(32);
      const p = { id: newId("pv_"), tokenHash: sha256(token), label: clampStr(req.body?.label, 120) || "Draft preview", createdAt: new Date().toISOString(), createdBy: who(req.user), exp: new Date(Date.now() + hours * 3600_000).toISOString() };
      const list = loadPreviews();
      list.push(p);
      store.writeJson(PREV, list.slice(-200));
      audit.log(req, { action: "content.preview_link_created", target: p.label, details: { hours } });
      const { tokenHash, ...meta } = p;
      res.status(201).json({ ok: true, preview: meta, token });
    });
    app.delete("/api/admin/content/previews/:id", requireAuth(PREVIEW_PERMS), (req, res) => {
      const list = loadPreviews();
      const found = list.find((x) => x.id === req.params.id);
      if (!found) return res.status(404).json({ ok: false, error: "Not found" });
      if (found.createdBy?.id !== req.user.id && !["pages.publish", "seo.publish", "site.publish"].some((x) => can(req, x))) {
        return res.status(403).json({ ok: false, error: "Only the person who created this link or a publisher can revoke it" });
      }
      store.writeJson(PREV, list.filter((p) => p.id !== req.params.id));
      audit.log(req, { action: "content.preview_link_revoked", target: req.params.id });
      res.json({ ok: true });
    });

    // ---- custom pages ----------------------------------------------------------
    app.post("/api/admin/content/pages", requireAuth("pages.create"), handle((req, res) => {
      const slug = validSlug(req.body?.slug);
      if (!slug) return res.status(400).json({ ok: false, error: "Use a URL like /landing/hospital-software (lowercase letters, numbers and dashes)" });
      const builtinPaths = Array.isArray(req.body?.reservedPaths) ? req.body.reservedPaths : [];
      if (builtinPaths.includes(slug)) return res.status(400).json({ ok: false, error: "That URL belongs to an existing page" });
      const pub = loadPublished();
      const all = [...new Set([...Object.keys(pub.docs), ...listDraftIds()])];
      if (all.some((id) => (loadDraft(id)?.data || pub.docs[id]?.data)?.meta?.slug === slug)) return res.status(400).json({ ok: false, error: "Another page already uses this URL" });
      const docId = `page:c-${newId().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)}`;
      const data = normalizeDoc(docId, { meta: { label: req.body?.label || slug, slug, template: "custom" }, layout: req.body?.layout || {}, fields: req.body?.fields || {} });
      saveDraft(docId, { data, rev: 1, updatedAt: new Date().toISOString(), updatedBy: who(req.user) });
      audit.log(req, { action: "content.page_created", target: slug, details: { docId } });
      res.status(201).json({ ok: true, docId, status: docStatus(docId) });
    }));
    app.delete("/api/admin/content/pages/:docId", requireAuth("pages.create"), handle((req, res) => {
      const docId = docParam(req, res); if (!docId) return;
      if (!docId.startsWith("page:c-")) return res.status(400).json({ ok: false, error: "Built-in pages cannot be deleted" });
      const pub = loadPublished();
      if (pub.docs[docId]) {
        if (!can(req, "pages.publish")) return res.status(403).json({ ok: false, error: "Deleting a live page requires publish permission" });
        publishDocs([{ docId, remove: true }], { user: req.user, note: "Page deleted" });
      }
      deleteDraft(docId);
      audit.log(req, { action: "content.page_deleted", target: docId });
      res.json({ ok: true });
    }));

    // ---- presence -----------------------------------------------------------
    app.post("/api/admin/content/presence", requireAuth(), (req, res) => {
      const docId = String(req.body?.docId || "");
      if (!DOC_ID_RE.test(docId)) return res.status(400).json({ ok: false });
      const m = editing.get(docId) || new Map();
      m.set(req.user.id, { name: req.user.name, at: Date.now() });
      editing.set(docId, m);
      const others = [...m.entries()].filter(([id, v]) => id !== req.user.id && Date.now() - v.at < 45_000).map(([, v]) => v.name);
      res.json({ ok: true, others });
    });
  }

  /**
   * Apply a transform to every working copy that mentions one of `needles`,
   * saving the result as a DRAFT (live content is never touched).
   * Used by media "replace". Returns the docIds that changed.
   */
  function rewriteWorkingCopies(transform, needles, user, filter = () => true) {
    const pub = loadPublished();
    const ids = new Set([...Object.keys(pub.docs), ...listDraftIds()]);
    const touched = [];
    for (const docId of ids) {
      if (!filter(docId)) continue;
      const cur = workingData(docId, pub);
      const json = JSON.stringify(cur);
      if (!needles.some((n) => n && json.includes(n))) continue;
      const next = normalizeDoc(docId, transform(structuredClone(cur)));
      if (docType(docId) === "site" && cur.code) next.code = cur.code; // custom code is never rewritten automatically
      if (same(next, cur)) continue;
      const prev = loadDraft(docId);
      saveDraft(docId, { data: next, rev: (prev?.rev || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: who(user) });
      touched.push(docId);
    }
    return touched;
  }

  return {
    registerRoutes, loadPublished, loadDraft, workingData, publishDocs, listDraftIds, docStatus, loadSchedules, runDueSchedules, previewDocs, loadPreviews,
    rewriteWorkingCopies,
    canEditDoc: (req, docId) => hasAny(req, editPermFor(docId, "fields")),
    stop: () => clearInterval(scheduler),
  };
}
