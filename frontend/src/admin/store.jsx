import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { applyPatch, diffPatch, docType, emptyPage, PATCHABLE, same } from "./docOps.js";

// ---------------------------------------------------------------------------
// Shared working copies of every content document (pages, site, seo, forms)
// with autosave, undo/redo and publishing. Every module (visual editor,
// SEO, header & footer, form builder...) edits through this one store, so
// a change made in one place is instantly visible in the others.
//
//   working    what the editor shows (draft, or live when there is no draft)
//   saved      what the server has as the draft (diff base for autosave)
//   published  the live version
// ---------------------------------------------------------------------------

const Ctx = createContext(null);
const unsavedProbe = { current: () => false };
/** True while edits haven't reached the server (used before signing out). */
export const hasUnsavedChanges = () => unsavedProbe.current();
export const useContent = () => useContext(Ctx);

export const emptyFor = (docId) => (docType(docId) === "page" ? emptyPage() : {});
const SAVE_DELAY = 900;
const HISTORY_MAX = 200;

export function ContentStoreProvider({ children }) {
  const [state, setState] = useState({ loaded: false, error: null, working: {}, published: {}, status: {}, version: 0 });
  const [save, setSave] = useState({ state: "idle", error: null, at: null });
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const workingRef = useRef({});
  const savedRef = useRef({});
  const timers = useRef(new Map());
  const inflight = useRef(new Map());
  const retry = useRef(new Map());
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const listeners = useRef(new Set());
  const discarding = useRef(new Set());

  const syncHist = () => setHist({ undo: undoStack.current.length, redo: redoStack.current.length });
  const emit = (docId) => { for (const fn of listeners.current) { try { fn(docId); } catch { /* ignore */ } } };

  const setWorking = useCallback((docId, data) => {
    workingRef.current = { ...workingRef.current, [docId]: data };
    setState((s) => ({ ...s, working: workingRef.current }));
    emit(docId);
  }, []);

  // ---------------------------------------------------------------- load
  const load = useCallback(async () => {
    try {
      const [w, d] = await Promise.all([api("/api/admin/content/working"), api("/api/admin/content/docs")]);
      workingRef.current = w.docs;
      savedRef.current = structuredClone(w.docs);
      setState({ loaded: true, error: null, working: w.docs, published: w.published, status: Object.fromEntries(d.docs.map((x) => [x.docId, x])), version: w.version });
    } catch (e) {
      setState((s) => ({ ...s, loaded: true, error: e }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const refreshStatus = useCallback(async () => {
    try {
      const d = await api("/api/admin/content/docs");
      setState((s) => ({ ...s, version: d.version, status: Object.fromEntries(d.docs.map((x) => [x.docId, x])) }));
    } catch { /* keep old */ }
  }, []);

  const reloadDoc = useCallback(async (docId) => {
    const r = await api(`/api/admin/content/doc/${encodeURIComponent(docId)}`);
    savedRef.current = { ...savedRef.current, [docId]: structuredClone(r.data) };
    workingRef.current = { ...workingRef.current, [docId]: r.data };
    // the next edit starts a new undo step: merging it into one from before
    // the reload would make undo roll back what the reload brought in
    for (const e of undoStack.current) if (e.docId === docId) e.coalesce = null;
    setState((s) => ({
      ...s,
      working: workingRef.current,
      published: r.published ? { ...s.published, [docId]: r.published } : Object.fromEntries(Object.entries(s.published).filter(([k]) => k !== docId)),
      status: { ...s.status, [docId]: r.status },
    }));
    emit(docId);
    return r;
  }, []);

  // ---------------------------------------------------------------- save
  const saveDoc = useCallback(async (docId) => {
    clearTimeout(timers.current.get(docId));
    timers.current.delete(docId);
    if (discarding.current.has(docId)) return true;
    if (inflight.current.has(docId)) {
      // one request per doc at a time; queue a follow-up
      return inflight.current.get(docId).then(() => saveDoc(docId));
    }
    const sent = workingRef.current[docId];
    const base = savedRef.current[docId] || emptyFor(docId);
    const patch = diffPatch(docId, base, sent);
    if (!patch) {
      if (!inflight.current.size && !timers.current.size) setSave((s) => (s.state === "error" ? s : { ...s, state: "idle" }));
      return true;
    }
    setSave((s) => ({ ...s, state: "saving", error: null }));
    const p = (async () => {
      try {
        const r = await api(`/api/admin/content/doc/${encodeURIComponent(docId)}`, { method: "PATCH", body: patch });
        // Next diff base = what we sent, merged like the server does. (The
        // server's normalized copy is not pushed back into the editor:
        // trimming while someone is typing would eat their spaces, and it
        // may contain teammates' fields this editor must not send as deletes.)
        savedRef.current = { ...savedRef.current, [docId]: applyPatch(docId, base, patch) };
        retry.current.delete(docId);
        setState((s) => ({ ...s, status: { ...s.status, [docId]: r.status } }));
        return true;
      } catch (e) {
        setSave({ state: "error", error: e, at: null, docId });
        if (e.status === 0 || e.status >= 500) {
          // offline / server restarting (a proxy answers 502/503): retry with backoff
          const n = (retry.current.get(docId) || 0) + 1;
          retry.current.set(docId, n);
          timers.current.set(docId, setTimeout(() => saveDoc(docId), Math.min(30000, 2000 * 2 ** n)));
        }
        return false;
      } finally {
        inflight.current.delete(docId);
      }
    })();
    inflight.current.set(docId, p);
    const ok = await p;
    if (ok) {
      if (workingRef.current[docId] !== sent) return saveDoc(docId);
      if (!inflight.current.size && !timers.current.size) setSave({ state: "saved", error: null, at: new Date().toISOString() });
    }
    return ok;
  }, []);

  const schedule = useCallback((docId, delay = SAVE_DELAY) => {
    clearTimeout(timers.current.get(docId));
    timers.current.set(docId, setTimeout(() => saveDoc(docId), delay));
    setSave((s) => ({ ...s, state: s.state === "error" ? "error" : "pending" }));
  }, [saveDoc]);

  /** Save everything now; resolves true when all drafts are on the server. */
  const flush = useCallback(async () => {
    const ids = new Set([...timers.current.keys(), ...inflight.current.keys()]);
    for (const [docId, data] of Object.entries(workingRef.current)) {
      if (!same(data, savedRef.current[docId] || emptyFor(docId))) ids.add(docId);
    }
    const results = await Promise.all([...ids].map((id) => saveDoc(id)));
    return results.every(Boolean);
  }, [saveDoc]);

  const hasPending = useCallback(() => {
    if (timers.current.size > 0 || inflight.current.size > 0) return true;
    return Object.entries(workingRef.current).some(([docId, data]) => !same(data, savedRef.current[docId] || emptyFor(docId)));
  }, []);

  // ------------------------------------------------------------- update
  /**
   * Change a document. `updater` gets the current working data and returns
   * the new data. `coalesce` merges rapid edits of the same thing (typing)
   * into one undo step.
   */
  const update = useCallback((docId, updater, { label = "Edit", coalesce = null, history = true, target = null } = {}) => {
    const before = workingRef.current[docId] ?? emptyFor(docId);
    const after = typeof updater === "function" ? updater(before) : updater;
    if (after === before || after == null || same(before, after)) return false;
    if (history) {
      const last = undoStack.current[undoStack.current.length - 1];
      if (coalesce && last && last.docId === docId && last.coalesce === coalesce && Date.now() - last.at < 2500) {
        last.after = after;
        last.at = Date.now();
      } else {
        undoStack.current.push({ docId, before, after, label, coalesce, at: Date.now(), target });
        if (undoStack.current.length > HISTORY_MAX) undoStack.current.shift();
      }
      redoStack.current = [];
      syncHist();
    }
    setWorking(docId, after);
    schedule(docId);
    return true;
  }, [schedule, setWorking]);

  // Optional `docIds`: only undo changes to those documents (module bars).
  const takeLast = (stack, docIds) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (!docIds || docIds.includes(stack[i].docId)) return stack.splice(i, 1)[0];
    }
    return null;
  };
  /**
   * Site, SEO and forms documents are made of independent sections. Undo/redo
   * only puts back the sections that step changed, so a section reloaded in
   * the meantime (e.g. scripts someone else published) is never rolled back -
   * and never re-sent by someone who may not edit it.
   */
  const stepResult = (docId, target, other) => {
    const t = docType(docId);
    if (t === "page") return target;
    const out = { ...(workingRef.current[docId] ?? emptyFor(docId)) };
    for (const k of PATCHABLE[t] || []) {
      if (same(target?.[k], other?.[k])) continue;
      if (target?.[k] === undefined) delete out[k]; else out[k] = target[k];
    }
    return out;
  };
  const canUndo = (docIds) => undoStack.current.some((e) => !docIds || docIds.includes(e.docId));
  const undo = useCallback((docIds) => {
    const e = takeLast(undoStack.current, Array.isArray(docIds) ? docIds : null);
    if (!e) return null;
    redoStack.current.push(e);
    setWorking(e.docId, stepResult(e.docId, e.before, e.after));
    schedule(e.docId, 400);
    syncHist();
    return e;
  }, [schedule, setWorking]);
  const redo = useCallback((docIds) => {
    const e = takeLast(redoStack.current, Array.isArray(docIds) ? docIds : null);
    if (!e) return null;
    undoStack.current.push(e);
    setWorking(e.docId, stepResult(e.docId, e.after, e.before));
    schedule(e.docId, 400);
    syncHist();
    return e;
  }, [schedule, setWorking]);
  const peekUndo = () => undoStack.current[undoStack.current.length - 1] || null;
  const peekRedo = () => redoStack.current[redoStack.current.length - 1] || null;
  const dropHistory = (docId) => {
    undoStack.current = undoStack.current.filter((e) => e.docId !== docId);
    redoStack.current = redoStack.current.filter((e) => e.docId !== docId);
    syncHist();
  };

  // ---------------------------------------------------------- publishing
  const publish = useCallback(async (docIds, note = "") => {
    const ok = await flush();
    if (!ok) throw new Error("Some changes could not be saved - fix the error shown and try again");
    const r = await api("/api/admin/content/publish", { method: "POST", body: { docIds, note } });
    await Promise.all(docIds.map((id) => reloadDoc(id).catch(() => null)));
    await refreshStatus();
    return r;
  }, [flush, reloadDoc, refreshStatus]);

  const schedulePublish = useCallback(async (docIds, at, note = "") => {
    const ok = await flush();
    if (!ok) throw new Error("Some changes could not be saved yet");
    const r = await api("/api/admin/content/schedules", { method: "POST", body: { docIds, at, note } });
    await refreshStatus();
    return r;
  }, [flush, refreshStatus]);

  const discard = useCallback(async (docId) => {
    // Block queued autosaves for this doc until the discard has landed, or a
    // follow-up save could re-create the draft right after it was deleted.
    discarding.current.add(docId);
    try {
      clearTimeout(timers.current.get(docId));
      timers.current.delete(docId);
      await inflight.current.get(docId);
      const r = await api(`/api/admin/content/doc/${encodeURIComponent(docId)}/discard`, { method: "POST" });
      dropHistory(docId);
      await reloadDoc(docId);
      await refreshStatus();
      return r;
    } finally {
      discarding.current.delete(docId);
    }
  }, [reloadDoc, refreshStatus]);

  const restoreRevision = useCallback(async (docId, rev) => {
    await flush();
    const r = await api(`/api/admin/content/doc/${encodeURIComponent(docId)}/restore`, { method: "POST", body: { rev } });
    dropHistory(docId);
    await reloadDoc(docId);
    return r;
  }, [flush, reloadDoc]);

  const createPage = useCallback(async (body) => {
    const r = await api("/api/admin/content/pages", { method: "POST", body });
    await reloadDoc(r.docId);
    return r;
  }, [reloadDoc]);

  const deletePage = useCallback(async (docId) => {
    clearTimeout(timers.current.get(docId));
    timers.current.delete(docId);
    await api(`/api/admin/content/pages/${encodeURIComponent(docId)}`, { method: "DELETE" });
    dropHistory(docId);
    const { [docId]: _w, ...w } = workingRef.current;
    workingRef.current = w;
    const { [docId]: _s, ...sv } = savedRef.current;
    savedRef.current = sv;
    setState((s) => {
      const { [docId]: _p, ...published } = s.published;
      const { [docId]: _st, ...status } = s.status;
      return { ...s, working: w, published, status };
    });
  }, []);

  const unpublishPage = useCallback(async (docId) => {
    await flush();
    await api("/api/admin/content/unpublish", { method: "POST", body: { docId } });
    await reloadDoc(docId);
    await refreshStatus();
  }, [flush, reloadDoc, refreshStatus]);

  useEffect(() => { unsavedProbe.current = hasPending; return () => { unsavedProbe.current = () => false; }; }, [hasPending]);

  // After signing in again (expired session), push everything still unsaved.
  useEffect(() => {
    const onRelogin = () => { flush(); };
    window.addEventListener("kibo-relogin", onRelogin);
    return () => window.removeEventListener("kibo-relogin", onRelogin);
  }, [flush]);

  // Warn before leaving with unsaved edits; save on tab hide.
  useEffect(() => {
    const onBefore = (e) => { if (hasPending()) { flush(); e.preventDefault(); e.returnValue = ""; } };
    const onHide = () => { if (document.visibilityState === "hidden" && hasPending()) flush(); };
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("beforeunload", onBefore); document.removeEventListener("visibilitychange", onHide); };
  }, [flush, hasPending]);

  const isDirty = useCallback((docId) => !same(state.working[docId] ?? emptyFor(docId), state.published[docId] ?? emptyFor(docId)), [state.working, state.published]);

  const value = useMemo(() => ({
    ...state, save, hist,
    load, reloadDoc, refreshStatus, update, undo, redo, canUndo, peekUndo, peekRedo, flush, hasPending, saveDoc,
    publish, schedulePublish, discard, restoreRevision, createPage, deletePage, unpublishPage, isDirty,
    getWorking: (docId) => workingRef.current[docId] ?? emptyFor(docId),
    subscribe: (fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); },
    retrySave: () => flush(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, save, hist, load, reloadDoc, refreshStatus, update, undo, redo, flush, hasPending, saveDoc, publish, schedulePublish, discard, restoreRevision, createPage, deletePage, unpublishPage, isDirty]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Status chip text for the save indicator. */
export function saveLabel(save) {
  if (save.state === "saving") return "Saving…";
  if (save.state === "pending") return "Unsaved changes…";
  if (save.state === "error") return save.error?.status === 0 ? "Offline - will retry" : "Not saved";
  if (save.state === "saved") return "Draft saved";
  return "All changes saved";
}
