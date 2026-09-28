import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../AdminApp.jsx";
import { useContent, saveLabel } from "../store.jsx";
import { api, upload } from "../api.js";
import { Button, I, IconButton, Select, Spinner, Tabs, timeAgo, useConfirm, useNow, useToast, Badge } from "../ui.jsx";
import { docType, itemAction, sectionAction, setField, setSectionOrder, imageValue } from "../docOps.js";
import { siteEntries } from "../../cms/seo.js";
import { BLOCKS } from "../../cms/blocks.jsx";
import Inspector from "./Inspector.jsx";
import { Layers, BlockLibrary, PublishDialog, HistoryDialog, PreviewDialog, ChangesList, PageSettings } from "./panels.jsx";
import SeoPanel from "../SeoPanel.jsx";
import { MediaPicker } from "../modules/Media.jsx";

// ---------------------------------------------------------------------------
// Visual editor: the REAL website page runs in a same-origin iframe in edit
// mode (?kibo_editor=1) and renders the working drafts from the shared store.
// Clicks and typing on the page arrive here as messages and are applied to
// the draft (with undo/redo + autosave). Nothing is live until Publish.
// ---------------------------------------------------------------------------

const ORIGIN = window.location.origin;
const DEVICES = [
  { id: "desktop", icon: "monitor", label: "Desktop" },
  { id: "tablet", icon: "tablet", label: "Tablet (834px)" },
  { id: "mobile", icon: "phone", label: "Mobile (390px)" },
];

/** A site-relative path ("/about"), or "/" for anything else. */
export function safePath(p) {
  const v = String(p || "/");
  return /^\/(?!\/)[A-Za-z0-9\-._~/%]*$/.test(v) && !v.includes("..") ? v : "/";
}
const frameUrl = (path) => {
  const u = new URL(safePath(path), window.location.origin);
  u.searchParams.set("kibo_editor", "1");
  return u.origin === window.location.origin ? `${u.pathname}${u.search}` : "/?kibo_editor=1";
};
const send = (frame, type, data) => {
  try { frame?.contentWindow?.postMessage({ source: "kibo-admin", type, ...(data || {}) }, ORIGIN); } catch { /* frame gone */ }
};

export default function Editor() {
  const store = useContent();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Only same-site paths may reach the iframe (a crafted ?path=javascript:…
  // link must never run in the admin origin).
  const path = safePath(params.get("path"));
  useNow(10000);

  const entries = useMemo(() => siteEntries(store?.working || {}), [store?.working]);
  const entry = entries.find((e) => e.path === path) || null;
  const pageDocId = entry ? `page:${entry.id}` : null;

  const [device, setDevice] = useState("desktop");
  const [view, setView] = useState("edit"); // edit | compare | revision
  const [revision, setRevision] = useState(null); // { docId, rev, data, publishedAt }
  const [sel, setSel] = useState(null);
  const [structure, setStructure] = useState(null);
  const [leftTab, setLeftTab] = useState(params.get("panel") === "seo" ? "seo" : "layers");
  const [showLeft, setShowLeft] = useState(true);
  const [ready, setReady] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [media, setMedia] = useState(null); // { kind, resolve }
  const [others, setOthers] = useState([]);
  const [frameSrc] = useState(() => frameUrl(path));
  const frameRef = useRef(null);
  const liveRef = useRef(null);
  const sentRef = useRef(new WeakMap()); // frame -> { docId: dataRef }
  const flushWaiters = useRef(new Map());

  const canEditPage = can("pages.edit");
  const canEditSite = can("site.edit");
  // Header/footer editors without page rights can still click-edit the site parts.
  const readonly = view !== "edit" || (!canEditPage && !canEditSite);
  // Stable unless a page is added/renamed - a new array on every edit would
  // re-send the whole config (and all documents) to the frame each keystroke.
  const pagesKey = entries.map((e) => `${e.path}|${e.label}`).join(";");
  const pages = useMemo(() => entries.map((e) => ({ path: e.path, label: e.label })), [pagesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------ docs shown in frames
  const liveDocs = store?.published || {};
  const docsFor = useCallback((frame) => {
    if (frame === liveRef.current) return liveDocs;
    if (view === "revision" && revision) return { ...(store?.working || {}), [revision.docId]: revision.data };
    return store?.working || {};
  }, [liveDocs, view, revision, store?.working]);

  const pushDocs = useCallback((frame, full = false) => {
    if (!frame?.contentWindow) return;
    const docs = docsFor(frame);
    const prev = sentRef.current.get(frame);
    if (full || !prev) {
      send(frame, "docs", { docs });
    } else {
      const changed = {};
      let removed = false;
      for (const [id, d] of Object.entries(docs)) if (prev[id] !== d) changed[id] = d;
      for (const id of Object.keys(prev)) if (!(id in docs)) removed = true;
      if (removed) send(frame, "docs", { docs });
      else if (Object.keys(changed).length) send(frame, "patch-docs", { docs: changed });
    }
    sentRef.current.set(frame, { ...docs });
  }, [docsFor]);

  const configure = useCallback((frame) => {
    const ro = frame === liveRef.current || readonly;
    send(frame, "config", { readonly: ro, pages });
  }, [readonly, pages]);

  // keep frames in sync with the store
  useEffect(() => { if (ready) pushDocs(frameRef.current); }, [ready, pushDocs]);
  useEffect(() => { if (liveRef.current) pushDocs(liveRef.current); }, [pushDocs, view]);
  useEffect(() => { if (ready) configure(frameRef.current); }, [ready, configure]);

  // navigate the frame when the page picker changes
  useEffect(() => {
    if (!ready) return;
    send(frameRef.current, "navigate", { path });
    if (liveRef.current) send(liveRef.current, "navigate", { path });
    setSel(null);
  }, [path, ready]);

  // ------------------------------------------------------ latest values
  const latest = useRef({});
  latest.current = { store, path, pageDocId, canEditPage, canEditSite, view, sel };

  const flushFrame = useCallback(() => new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    flushWaiters.current.set(id, resolve);
    send(frameRef.current, "flush", { id });
    setTimeout(() => { if (flushWaiters.current.delete(id)) resolve(); }, 600);
  }), []);

  const scrollTo = useCallback((target) => send(frameRef.current, "scroll-to", target), []);

  const openMedia = useCallback((opts = {}) => new Promise((resolve) => setMedia({ ...opts, resolve })), []);

  const guard = useCallback((docId) => {
    const L = latest.current;
    if (L.view !== "edit") return false;
    const t = docType(docId);
    if (t === "page" && !L.canEditPage) { toast("You can view this page but not edit it.", { tone: "error" }); return false; }
    if (t === "site" && !L.canEditSite) {
      toast("Header and footer changes need the Website edit permission.", { tone: "error" });
      pushDocs(frameRef.current, true);
      return false;
    }
    return t === "page" || t === "site";
  }, [toast, pushDocs]);

  const setValue = useCallback((docId, key, value, label = "Edit") => {
    if (!guard(docId)) return;
    latest.current.store.update(docId, (d) => setField(d, docId, key, value), { label, coalesce: `${docId}|${key}`, target: { key } });
  }, [guard]);

  const doSection = useCallback(async (m) => {
    if (!guard(m.docId)) return;
    const st = latest.current.store;
    if (m.action === "add") { setDialog({ kind: "blocks", after: m.id, docId: m.docId, order: m.order }); return; }
    if (m.action === "remove") {
      const ok = await confirm({ title: "Delete this section?", message: "The section and its content are removed from the draft. You can undo this, and nothing changes on the live site until you publish.", confirmLabel: "Delete section", danger: true });
      if (!ok) return;
    }
    let newId = null;
    let error = null;
    st.update(m.docId, (d) => { const r = sectionAction(d, m); newId = r.newId; error = r.error; return r.data; }, { label: `${m.action} section` });
    if (error) { toast(error, { tone: "error" }); return; }
    if (newId) setTimeout(() => scrollTo({ section: newId, select: true }), 120);
    if (m.action === "remove") setSel(null);
  }, [guard, confirm, toast, scrollTo]);

  const doItem = useCallback(async (m) => {
    if (!guard(m.docId)) return;
    if (m.action === "remove") {
      const ok = await confirm({ title: "Delete this copy?", message: "This removes the duplicated item from the draft.", confirmLabel: "Delete", danger: true });
      if (!ok) return;
    }
    let newId = null;
    let error = null;
    latest.current.store.update(m.docId, (d) => { const r = itemAction(d, m); newId = r.newId; error = r.error; return r.data; }, { label: `${m.action} item` });
    if (error) toast(error, { tone: "error" });
    if (newId) setTimeout(() => scrollTo({ item: { list: m.list, id: newId } }), 120);
  }, [guard, confirm, toast, scrollTo]);

  const addBlock = useCallback((type) => {
    const d = dialog;
    setDialog(null);
    const docId = d?.docId || latest.current.pageDocId;
    if (!docId || !guard(docId)) return;
    let newId = null;
    latest.current.store.update(docId, (data) => { const r = sectionAction(data, { action: "add", id: d?.after || null, order: d?.order || structure?.sections?.map((s) => s.id) || [], blockType: type }); newId = r.newId; return r.data; }, { label: `Add ${BLOCKS[type]?.label || "section"}` });
    if (newId) setTimeout(() => scrollTo({ section: newId, select: true }), 150);
  }, [dialog, guard, structure, scrollTo]);

  const reorder = useCallback((order) => {
    const docId = latest.current.pageDocId;
    if (!docId || !guard(docId)) return;
    latest.current.store.update(docId, (d) => setSectionOrder(d, order), { label: "Reorder sections" });
  }, [guard]);

  // Undo/redo only what this screen shows, and never in read-only views.
  const scope = () => [latest.current.pageDocId, "site", "seo"].filter(Boolean);
  const undo = useCallback(() => {
    if (latest.current.view !== "edit") return;
    const e = latest.current.store.undo(scope());
    if (!e) return;
    toast(`Undone: ${e.label}`, { duration: 1800 });
    if (e.target?.key) scrollTo({ key: e.target.key, instant: true });
  }, [toast, scrollTo]);
  const redo = useCallback(() => {
    if (latest.current.view !== "edit") return;
    const e = latest.current.store.redo(scope());
    if (!e) return;
    toast(`Redone: ${e.label}`, { duration: 1800 });
    if (e.target?.key) scrollTo({ key: e.target.key, instant: true });
  }, [toast, scrollTo]);
  const saveNow = useCallback(async () => {
    await flushFrame();
    const ok = await latest.current.store.flush();
    toast(ok ? "Draft saved" : "Some changes could not be saved", { tone: ok ? "ok" : "error", duration: 1800 });
  }, [flushFrame, toast]);

  // Image dropped on the page: upload, then swap it in.
  const dropFile = useCallback(async (m) => {
    if (!guard(m.docId)) return;
    if (!can("media.upload")) { toast("You don't have permission to upload media.", { tone: "error" }); return; }
    toast(`Uploading ${m.file.name}…`, { duration: 2500 });
    try {
      const r = await upload("/api/admin/media", m.file, { alt: m.value?.alt || "" });
      setValue(m.docId, m.key, imageValue(r.item, m.value), "Replace image");
      toast("Image replaced in the draft");
    } catch (e) { toast(e.message, { tone: "error" }); }
  }, [guard, can, toast, setValue]);

  // ------------------------------------------------------ frame messages
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== ORIGIN) return;
      const m = e.data;
      if (!m || m.source !== "kibo-editor") return;
      const main = frameRef.current;
      const live = liveRef.current;
      const frame = e.source === main?.contentWindow ? main : e.source === live?.contentWindow ? live : null;
      if (!frame) return;
      if (m.type === "ready") {
        sentRef.current.delete(frame);
        pushDocs(frame, true);
        configure(frame);
        if (m.path !== latest.current.path) send(frame, "navigate", { path: latest.current.path });
        if (frame === main) setReady(true);
        return;
      }
      if (frame !== main) return;
      switch (m.type) {
        case "route":
          if (m.path && m.path !== latest.current.path) setParams((p) => { const n = new URLSearchParams(p); n.set("path", safePath(m.path)); return n; }, { replace: true });
          setStructure(null);
          break;
        case "structure": setStructure(m); break;
        case "select": setSel(m.sel || null); break;
        case "change": setValue(m.docId, m.key, m.value, `Edit ${String(m.label || "text").toLowerCase()}`); break;
        case "section": doSection(m); break;
        case "item": doItem(m); break;
        case "key":
          if (m.action === "undo") undo();
          else if (m.action === "redo") redo();
          else if (m.action === "save") saveNow();
          break;
        case "drop-file": dropFile(m); break;
        case "toast": toast(m.message); break;
        case "flushed": { const r = flushWaiters.current.get(m.id); if (r) { flushWaiters.current.delete(m.id); r(); } break; }
        default: break;
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [pushDocs, configure, setParams, setValue, doSection, doItem, undo, redo, saveNow, dropFile, toast]);

  // keyboard shortcuts in the admin window itself
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); saveNow(); return; }
      const typing = e.target.closest?.("input, textarea, select, [contenteditable]");
      if (typing) return;
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, saveNow]);

  // presence: warn when a teammate edits the same page
  useEffect(() => {
    if (!pageDocId || !canEditPage) return undefined;
    let stop = false;
    const ping = () => api("/api/admin/content/presence", { method: "POST", body: { docId: pageDocId } })
      .then((r) => { if (!stop) setOthers(r.others || []); }).catch(() => {});
    ping();
    const t = setInterval(ping, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [pageDocId, canEditPage]);

  // re-config when readonly changes (compare / revision views) - only then,
  // not on every edit (configure/pushDocs are read through a ref)
  const frameOps = useRef({ configure, pushDocs });
  frameOps.current = { configure, pushDocs };
  useEffect(() => {
    if (!ready) return;
    frameOps.current.configure(frameRef.current);
    frameOps.current.pushDocs(frameRef.current, true);
    if (readonly) setSel(null);
  }, [readonly, view, revision, ready]);

  if (!store) return <div className="a-main-pad"><Spinner /></div>;
  if (!store.loaded) return <div className="ed-root"><div className="ed-loading"><Spinner label="Loading drafts…" /></div></div>;

  const status = pageDocId ? store.status[pageDocId] : null;
  const pageDirty = pageDocId ? store.isDirty(pageDocId) : false;
  const anyDirty = Object.keys({ ...store.working, ...store.published }).some((id) => store.isDirty(id));
  const canPublish = can(["pages.publish", "seo.publish", "site.publish"]);

  const goPage = (p) => setParams((prev) => { const n = new URLSearchParams(prev); n.set("path", safePath(p)); n.delete("panel"); return n; });

  const ctx = {
    store, can, readonly, pageDocId, entry, path, pages, sel, structure,
    setValue, doSection, doItem, scrollTo, openMedia, goPage,
    select: (s) => setSel(s),
    frame: () => frameRef.current,
    updateSite: (section, value, label = "Edit site") => {
      if (!guard("site")) return;
      store.update("site", (d) => ({ ...(d || {}), [section]: value }), { label, coalesce: `site|${section}` });
    },
    openBlocks: (after) => setDialog({ kind: "blocks", after, docId: pageDocId, order: structure?.sections?.map((s) => s.id) || [] }),
    openPublish: () => setDialog({ kind: "publish" }),
  };

  return (
    <div className="ed-root">
      <header className="ed-top">
        <IconButton icon="chevronLeft" label="Back to pages" onClick={() => navigate("/admin/pages")} />
        <div className="ed-page-pick">
          <Select
            value={entry ? path : "__other"}
            onChange={(v) => v !== "__other" && goPage(v)}
            options={[...entries.map((e) => ({ value: e.path, label: `${e.label}${store.isDirty(`page:${e.id}`) ? "  •" : ""}` })), ...(entry ? [] : [{ value: "__other", label: path }])]}
            aria-label="Page"
          />
          <PageBadge status={status} dirty={pageDirty} entry={entry} store={store} />
        </div>
        <span className={`ed-status ${store.save.state === "error" ? "error" : ""} hide-sm`} title={store.save.error?.message || ""}>
          {store.save.state === "saving" ? <span className="a-spin" /> : <I n={store.save.state === "error" ? "alert" : "check"} size={14} />}
          {saveLabel(store.save)}{store.save.state === "saved" && store.save.at ? ` · ${timeAgo(store.save.at)}` : ""}
          {store.save.state === "error" && <Button size="sm" variant="ghost" onClick={() => store.retrySave()}>Retry</Button>}
        </span>
        {others.length > 0 && <span className="ed-presence hide-sm" title="Edits merge field by field, but avoid editing the same text at the same time"><I n="users" size={13} /> {others.join(", ")} also editing</span>}
        <span className="a-spacer" />
        <IconButton icon="undo" label="Undo (Ctrl+Z)" disabled={!store.hist.undo || readonly} onClick={undo} />
        <IconButton icon="redo" label="Redo (Ctrl+Shift+Z)" disabled={!store.hist.redo || readonly} onClick={redo} />
        <span className="a-sep hide-sm" />
        <div className="ed-devices hide-sm" role="group" aria-label="Preview size">
          {DEVICES.map((d) => <button key={d.id} type="button" className={device === d.id ? "on" : ""} title={d.label} aria-label={d.label} aria-pressed={device === d.id} onClick={() => setDevice(d.id)}><I n={d.icon} size={16} /></button>)}
        </div>
        <span className="a-sep hide-sm" />
        <Button size="sm" variant={view === "compare" ? "primary" : "default"} icon="columns" className="hide-sm" onClick={() => { setView(view === "compare" ? "edit" : "compare"); setRevision(null); }}>{view === "compare" ? "Exit compare" : "Compare"}</Button>
        <Button size="sm" icon="history" className="hide-sm" onClick={() => setDialog({ kind: "history" })}>History</Button>
        <Button size="sm" icon="eye" onClick={async () => { await flushFrame(); await store.flush(); setDialog({ kind: "preview" }); }}>Preview</Button>
        {canPublish && (
          <Button size="sm" variant="primary" icon="send" disabled={!anyDirty} onClick={async () => { await flushFrame(); setDialog({ kind: "publish" }); }}>
            Publish
          </Button>
        )}
      </header>

      {view === "revision" && revision && (
        <div className="ed-readonly-bar">
          <I n="history" size={15} />
          Viewing revision {revision.rev} of {revision.label} (published {timeAgo(revision.publishedAt)}) - read only.
          <span className="a-spacer" />
          {can(revision.docId === "site" ? "site.edit" : "pages.edit") && <Button size="sm" onClick={async () => {
            const ok = await confirm({ title: `Restore revision ${revision.rev}?`, message: "Your current draft of this document is replaced by this version. The live site does not change until you publish.", confirmLabel: "Restore to draft" });
            if (!ok) return;
            try { await store.restoreRevision(revision.docId, revision.rev); toast(`Revision ${revision.rev} restored to the draft`); setView("edit"); setRevision(null); } catch (e) { toast(e.message, { tone: "error" }); }
          }}>Restore to draft</Button>}
          <Button size="sm" variant="primary" onClick={() => { setView("edit"); setRevision(null); }}>Back to editing</Button>
        </div>
      )}
      {view === "edit" && !canEditPage && (
        <div className="ed-readonly-bar"><I n="lock" size={15} /> {canEditSite ? "You can edit the header and footer here, but not page content." : "You have view-only access to pages. Ask a Super Admin for edit rights."}</div>
      )}

      <div className={`ed-body ${showLeft ? "show-left" : "no-left"}`}>
        <aside className="ed-panel ed-left">
          <div className="ed-panel-head">
            <Tabs
              className="small"
              value={leftTab}
              onChange={setLeftTab}
              tabs={[
                { id: "layers", label: "Sections", icon: "layers" },
                { id: "seo", label: "SEO", icon: "globe" },
                entry && !entry.builtin && { id: "page", label: "Page", icon: "settings" },
              ]}
            />
          </div>
          <div className="ed-panel-body">
            {leftTab === "layers" && <Layers ctx={ctx} onReorder={reorder} />}
            {leftTab === "seo" && pageDocId && (
              <SeoPanel docId={pageDocId} entry={entry} frame={() => frameRef.current} readonly={view !== "edit" || !can(["seo.edit", "pages.edit"])} compact />
            )}
            {leftTab === "page" && entry && !entry.builtin && <PageSettings ctx={ctx} />}
          </div>
        </aside>

        <main className="ed-canvas">
          {view === "compare" && (
            <div className={`ed-frame-wrap ${device}`}>
              <div className="ed-frame-label"><span className="a-dot green" /> Live now</div>
              <iframe ref={liveRef} className="ed-frame" src={frameSrc} title="Live version" />
            </div>
          )}
          <div className={`ed-frame-wrap ${device}`}>
            {view === "compare" && <div className="ed-frame-label"><span className="a-dot amber" /> Draft</div>}
            <iframe ref={frameRef} className="ed-frame" src={frameSrc} title="Page editor" />
          </div>
          {!ready && <div className="ed-loading"><Spinner label="Opening page…" /></div>}
          <button type="button" className="a-icon-btn" style={{ position: "absolute", left: 6, top: 6, background: "#fff" }} title={showLeft ? "Hide panel" : "Show panel"} onClick={() => setShowLeft((v) => !v)}>
            <I n={showLeft ? "chevronLeft" : "chevronRight"} />
          </button>
        </main>

        <aside className="ed-panel ed-right">
          <div className="ed-panel-body">
            {view === "compare" ? (
              <ChangesList ctx={ctx} docIds={[pageDocId, "site"].filter(Boolean)} />
            ) : (
              <Inspector ctx={ctx} />
            )}
          </div>
        </aside>
      </div>

      {dialog?.kind === "blocks" && <BlockLibrary onPick={addBlock} onClose={() => setDialog(null)} />}
      {dialog?.kind === "publish" && <PublishDialog ctx={ctx} onClose={() => setDialog(null)} />}
      {dialog?.kind === "history" && (
        <HistoryDialog
          docIds={[pageDocId, "site"].filter(Boolean)}
          label={entry?.label || path}
          onClose={() => setDialog(null)}
          onView={(r) => { setDialog(null); setRevision(r); setView("revision"); }}
        />
      )}
      {dialog?.kind === "preview" && <PreviewDialog path={path} label={entry?.label || path} onClose={() => setDialog(null)} />}
      {media && (
        <MediaPicker
          kind={media.kind || "image"}
          onClose={() => { media.resolve(null); setMedia(null); }}
          onSelect={(item) => { media.resolve(item); setMedia(null); }}
        />
      )}
    </div>
  );
}

function PageBadge({ status, dirty, entry, store }) {
  if (!entry) return <Badge tone="red">Not a page</Badge>;
  const sched = status?.scheduled?.length;
  if (sched) return <Badge tone="blue" title={`Scheduled ${new Date(status.scheduled[0].at).toLocaleString()}`}><I n="clock" size={11} /> Scheduled</Badge>;
  if (!entry.builtin && !store.published[`page:${entry.id}`]) return <Badge tone="gray">Never published</Badge>;
  if (dirty) return <Badge tone="amber">Draft changes</Badge>;
  return <Badge tone="green">Live</Badge>;
}


