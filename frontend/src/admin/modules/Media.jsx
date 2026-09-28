import { useCallback, useEffect, useRef, useState } from "react";
import { api, mediaUrl, upload } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { Alert, Badge, Button, CopyButton, Empty, ErrorBox, Field, I, Input, Modal, PageHead, Select, Spinner, Textarea, Toggle, fmtBytes, fmtDate, timeAgo, useConfirm, useToast } from "../ui.jsx";
import { docLabel } from "../editor/panels.jsx";
import { useContent } from "../store.jsx";

// ---------------------------------------------------------------------------
// Media Library: uploads (drag & drop), folders, tags, alt text, WebP
// optimisation, usage tracking, safe replace, trash / restore / purge.
// ---------------------------------------------------------------------------

const TYPES = [{ value: "", label: "All types" }, { value: "image", label: "Images" }, { value: "svg", label: "SVG" }, { value: "video", label: "Videos" }, { value: "document", label: "PDF documents" }];
const SORTS = [{ value: "new", label: "Newest first" }, { value: "name", label: "Name" }, { value: "size", label: "Largest first" }];
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml,image/x-icon,video/mp4,video/webm,application/pdf";

function useMediaList(initial = {}) {
  const [filters, setFilters] = useState({ q: "", type: "", folder: "", tag: "", sort: "new", unused: false, trash: false, ...initial });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v === true ? "1" : v);
    try {
      const d = await api(`/api/admin/media?${qs}`);
      if (n === seq.current) { setData(d); setError(null); }
    } catch (e) { if (n === seq.current) setError(e); } finally { if (n === seq.current) setLoading(false); }
  }, [filters]);
  useEffect(() => { const t = setTimeout(load, filters.q ? 250 : 0); return () => clearTimeout(t); }, [load, filters.q]);
  return { filters, setFilters, data, error, loading, reload: load };
}

function useUploader(onDone, fields = {}) {
  const [queue, setQueue] = useState([]);
  const toast = useToast();
  const start = async (files) => {
    const list = [...files];
    for (const file of list) {
      const id = Math.random().toString(36).slice(2);
      setQueue((q) => [...q, { id, name: file.name, p: 0 }]);
      try {
        const r = await upload("/api/admin/media", file, fields, (p) => setQueue((q) => q.map((x) => (x.id === id ? { ...x, p } : x))));
        if (r.duplicateOf) toast(`${file.name}: the same file already exists in the library - uploaded again anyway`, { duration: 5000 });
        onDone?.(r.item);
      } catch (e) {
        toast(`${file.name}: ${e.message}`, { tone: "error" });
      } finally {
        setQueue((q) => q.filter((x) => x.id !== id));
      }
    }
  };
  return { queue, start };
}

function Thumb({ item }) {
  if (item.kind === "image") return <img src={mediaUrl(item.srcset?.find((s) => s.w <= 480)?.url || item.webp || item.url)} alt={item.alt || ""} loading="lazy" />;
  if (item.kind === "video") return <video src={mediaUrl(item.url)} muted preload="metadata" />;
  return <I n="pages" size={30} />;
}

function Tile({ item, selected, onClick }) {
  return (
    <button type="button" className={`m-tile ${selected ? "sel" : ""}`} onClick={onClick} title={item.originalName}>
      <div className="m-thumb"><Thumb item={item} /></div>
      <div className="m-meta">
        <strong>{item.title || item.originalName}</strong>
        <span>{item.width ? `${item.width}×${item.height} · ` : ""}{fmtBytes(item.size)}</span>
      </div>
      <span className="m-flag">
        {item.usedLive ? <Badge tone="green">live</Badge> : item.usedCount ? <Badge tone="amber">draft</Badge> : null}
        {item.kind === "image" && !item.alt && item.mime !== "image/x-icon" && <Badge tone="red">no alt</Badge>}
      </span>
    </button>
  );
}

function Toolbar({ filters, setFilters, data, extra }) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  return (
    <div className="m-toolbar">
      <Input className="m-search" value={filters.q} onChange={(v) => set({ q: v })} placeholder="Search name, alt text, tags…" aria-label="Search media" />
      <Select value={filters.type} onChange={(v) => set({ type: v })} options={TYPES} aria-label="Type" />
      <Select value={filters.folder} onChange={(v) => set({ folder: v })} options={[{ value: "", label: "All folders" }, ...(data?.folders || []).map((f) => ({ value: f, label: f }))]} aria-label="Folder" />
      {data?.tags?.length > 0 && <Select value={filters.tag} onChange={(v) => set({ tag: v })} options={[{ value: "", label: "All tags" }, ...data.tags.map((t) => ({ value: t, label: `#${t}` }))]} aria-label="Tag" />}
      <Select value={filters.sort} onChange={(v) => set({ sort: v })} options={SORTS} aria-label="Sort" />
      {extra}
    </div>
  );
}

// ------------------------------------------------------------------- page
export default function Media() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useMediaList();
  const [sel, setSel] = useState(null);
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);
  const up = useUploader((item) => { list.reload(); setSel(item); });

  const selected = sel && (list.data?.items.find((m) => m.id === sel.id) || sel);
  const trash = list.filters.trash;

  return (
    <div
      className="a-page"
      onDragOver={(e) => { if (can("media.upload") && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (can("media.upload") && e.dataTransfer.files?.length) up.start(e.dataTransfer.files); }}
    >
      <PageHead
        title="Media Library"
        subtitle={list.data ? `${list.data.totals.count} files · ${fmtBytes(list.data.totals.bytes)}${list.data.optimizer ? " · images are optimised to WebP automatically" : ""}` : "Images, videos and documents used on the website"}
        actions={
          <>
            <Button icon="trash" variant={trash ? "primary" : "default"} onClick={() => { setSel(null); list.setFilters((f) => ({ ...f, trash: !f.trash })); }}>
              {trash ? "Back to library" : `Trash${list.data?.totals.trash ? ` (${list.data.totals.trash})` : ""}`}
            </Button>
            {can("media.upload") && <Button variant="primary" icon="upload" onClick={() => fileRef.current?.click()}>Upload</Button>}
            <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { up.start(e.target.files); e.target.value = ""; }} />
          </>
        }
      />
      {list.data && !list.data.optimizer && <Alert tone="warn">The image optimiser (sharp) is not available on this server, so images are stored as uploaded without WebP versions.</Alert>}
      {can("media.upload") && !trash && (
        <div className={`m-drop ${over ? "over" : ""}`} style={{ marginBottom: 14 }}>
          <I n="upload" size={22} /> <strong>Drag &amp; drop files here</strong> or <button type="button" className="a-btn a-btn-sm a-btn-ghost" onClick={() => fileRef.current?.click()}>browse</button>
          <div className="a-small">JPG, PNG, WebP, AVIF, GIF, SVG, ICO (images up to 15 MB) · MP4/WebM video · PDF. Photos are stripped of GPS/EXIF data.</div>
        </div>
      )}
      {up.queue.length > 0 && (
        <div className="m-uploads">
          {up.queue.map((u) => <div key={u.id} className="m-upload-row"><span className="a-spin" /> <span className="a-ellipsis" style={{ maxWidth: 260 }}>{u.name}</span><div className="m-progress"><span style={{ width: `${Math.round(u.p * 100)}%` }} /></div>{Math.round(u.p * 100)}%</div>)}
        </div>
      )}
      <Toolbar filters={list.filters} setFilters={list.setFilters} data={list.data} extra={!trash && <Toggle checked={list.filters.unused} onChange={(v) => list.setFilters((f) => ({ ...f, unused: v }))} label="Unused only" />} />
      <ErrorBox error={list.error} onRetry={list.reload} />
      <div className="m-layout">
        <div>
          {list.loading && !list.data && <Spinner />}
          {list.data && !list.data.items.length && <Empty icon="image" title={trash ? "Trash is empty" : "No files found"} text={trash ? "Deleted files stay here until purged, so nothing live breaks." : "Upload images and documents to use them anywhere on the website."} />}
          <div className="m-grid">
            {list.data?.items.map((m) => <Tile key={m.id} item={m} selected={selected?.id === m.id} onClick={() => setSel(m)} />)}
          </div>
        </div>
        <div className="m-detail">
          {selected ? (
            <MediaDetail
              key={selected.id}
              item={selected}
              trash={trash}
              onChanged={(item) => { list.reload(); if (item) setSel(item); }}
              onGone={() => { setSel(null); list.reload(); }}
              can={can}
              toast={toast}
              confirm={confirm}
            />
          ) : (
            <div className="a-card"><Empty icon="image" text="Select a file to see its details, edit alt text, copy its URL or see where it is used." /></div>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaDetail({ item, trash, onChanged, onGone, can, toast, confirm }) {
  const store = useContent();
  const [form, setForm] = useState({ alt: item.alt || "", title: item.title || "", caption: item.caption || "", description: item.description || "", folder: item.folder || "", tags: (item.tags || []).join(", ") });
  const [busy, setBusy] = useState(null);
  const replaceRef = useRef(null);
  const dirty = form.alt !== (item.alt || "") || form.title !== (item.title || "") || form.caption !== (item.caption || "") || form.description !== (item.description || "") || form.folder !== (item.folder || "") || form.tags !== (item.tags || []).join(", ");
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const abs = (u) => (u?.startsWith("/uploads/") ? new URL(mediaUrl(u), window.location.href).toString() : u);

  const save = async () => {
    setBusy("save");
    try {
      const r = await api(`/api/admin/media/${item.id}`, { method: "PATCH", body: { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) } });
      toast("Details saved");
      onChanged(r.item);
    } catch (e) { toast(e.message, { tone: "error" }); } finally { setBusy(null); }
  };
  const replace = async (file) => {
    if (!file) return;
    const ok = await confirm({ title: "Replace this file?", message: "The new file keeps this item's details. Draft pages that use it switch to the new file; live pages keep showing the old one until you publish them.", confirmLabel: "Replace" });
    if (!ok) return;
    setBusy("replace");
    try {
      await store?.flush(); // our own pending edits land before the server rewrites drafts
      const fd = await upload(`/api/admin/media/${item.id}/replace`, file);
      // pick up the drafts the server just pointed at the new file
      if (store) for (const id of fd.draftsUpdated || []) await store.reloadDoc(id).catch(() => null);
      toast(fd.draftsUpdated?.length ? `Replaced - ${fd.draftsUpdated.length} draft page(s) now use the new file. Publish them to go live.` : "File replaced", { duration: 6000 });
      onChanged(fd.item);
    } catch (e) { toast(e.message, { tone: "error" }); } finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy("delete");
    try {
      await api(`/api/admin/media/${item.id}`, { method: "DELETE" });
      toast("Moved to trash");
      onGone();
    } catch (e) {
      if (e.status === 409) {
        const live = e.data?.usedLive;
        const ok = await confirm({
          title: "This file is in use",
          message: <>It is used on {e.data.usage.length} page(s){live ? ", including LIVE pages" : ""}: {e.data.usage.map((u) => `${docLabel(u.docId)} (${u.where})`).join(", ")}. Moving it to the trash keeps the file online so nothing breaks, but you should replace it on those pages. Continue?</>,
          confirmLabel: "Move to trash anyway",
          danger: true,
        });
        if (ok) {
          try { await api(`/api/admin/media/${item.id}?force=1`, { method: "DELETE" }); toast("Moved to trash"); onGone(); } catch (e2) { toast(e2.message, { tone: "error" }); }
        }
      } else toast(e.message, { tone: "error" });
    } finally { setBusy(null); }
  };
  const restore = async () => {
    try { await api(`/api/admin/media/${item.id}/restore`, { method: "POST" }); toast("Restored"); onGone(); } catch (e) { toast(e.message, { tone: "error" }); }
  };
  const purge = async () => {
    const ok = await confirm({ title: "Delete permanently?", message: "The file is removed from the server for good. This cannot be undone.", confirmLabel: "Delete permanently", danger: true });
    if (!ok) return;
    try { await api(`/api/admin/media/${item.id}/purge`, { method: "DELETE" }); toast("Deleted permanently"); onGone(); }
    catch (e) {
      if (e.status === 409 && !e.data?.usage?.some((u) => u.where === "live")) {
        const ok2 = await confirm({ title: "Drafts still use this file", message: "Some drafts still reference it and would show a broken image. Delete anyway?", confirmLabel: "Delete anyway", danger: true });
        if (ok2) { try { await api(`/api/admin/media/${item.id}/purge?force=1`, { method: "DELETE" }); toast("Deleted permanently"); onGone(); } catch (e3) { toast(e3.message, { tone: "error" }); } }
      } else toast(e.message, { tone: "error" });
    }
  };

  const ro = !can("media.edit") || trash;
  return (
    <div className="a-card">
      <div className="m-preview">
        {item.kind === "image" ? <img src={mediaUrl(item.webp || item.url)} alt="" /> : item.kind === "video" ? <video src={mediaUrl(item.url)} controls preload="metadata" /> : <a href={mediaUrl(item.url)} target="_blank" rel="noopener noreferrer"><I n="pages" size={40} /></a>}
      </div>
      <dl className="m-kv">
        <dt>File</dt><dd>{item.originalName}</dd>
        <dt>Type</dt><dd>{item.mime}{item.optimized ? " · optimised" : ""}</dd>
        {item.width && <><dt>Size</dt><dd>{item.width} × {item.height}px · {fmtBytes(item.size)}</dd></>}
        {!item.width && <><dt>Size</dt><dd>{fmtBytes(item.size)}</dd></>}
        {item.srcset?.length > 0 && <><dt>WebP</dt><dd>{item.srcset.map((s) => `${s.w}w`).join(", ")}</dd></>}
        <dt>Uploaded</dt><dd>{fmtDate(item.createdAt)} by {item.uploadedBy?.name || "-"}</dd>
        {item.versions?.length > 0 && <><dt>Replaced</dt><dd>{item.versions.length}× · last {timeAgo(item.versions[item.versions.length - 1].replacedAt)}</dd></>}
      </dl>
      <div className="a-row" style={{ margin: "10px 0" }}>
        <CopyButton text={abs(item.url)} label="Copy URL" />
        {item.webp && item.webp !== item.url && <CopyButton text={abs(item.webp)} label="Copy WebP URL" />}
        <a className="a-btn a-btn-sm" href={mediaUrl(item.url)} target="_blank" rel="noopener noreferrer"><I n="external" size={14} /> Open</a>
      </div>

      <div className="a-stack tight">
        {item.kind === "image" && (
          <Field label="Alt text" hint="Describes the image for screen readers and Google. Used as the default when the image is placed." error={!form.alt && item.mime !== "image/x-icon" ? "Missing alt text" : null}>
            <Input value={form.alt} disabled={ro} onChange={set("alt")} />
          </Field>
        )}
        <Field label="Title"><Input value={form.title} disabled={ro} onChange={set("title")} /></Field>
        <Field label="Caption"><Input value={form.caption} disabled={ro} onChange={set("caption")} /></Field>
        <Field label="Description"><Textarea rows={2} value={form.description} disabled={ro} onChange={set("description")} /></Field>
        <div className="a-grid-2">
          <Field label="Folder"><Input value={form.folder} disabled={ro} onChange={set("folder")} placeholder="e.g. products/hms" /></Field>
          <Field label="Tags"><Input value={form.tags} disabled={ro} onChange={set("tags")} placeholder="hero, hospital" /></Field>
        </div>
        {!ro && <Button variant="primary" size="sm" disabled={!dirty} busy={busy === "save"} onClick={save}>Save details</Button>}
      </div>

      <div className="a-section-title">Where it is used</div>
      {!item.usage?.length ? <p className="a-muted a-small">Not used on any page.</p> : (
        <div className="a-stack tight">
          {item.usage.map((u, i) => (
            <div key={i} className="a-row a-small"><Badge tone={u.where === "live" ? "green" : "amber"}>{u.where}</Badge> <strong>{docLabel(u.docId)}</strong> <span className="a-muted a-ellipsis" style={{ maxWidth: 150 }}>{u.keys.slice(0, 2).join(", ")}</span></div>
          ))}
        </div>
      )}

      <hr className="a-divider" style={{ margin: "14px 0" }} />
      {trash ? (
        <div className="a-row">
          {can("media.delete") && <Button icon="undo" onClick={restore}>Restore</Button>}
          {can("media.delete") && <Button variant="danger" icon="trash" onClick={purge}>Delete permanently</Button>}
        </div>
      ) : (
        <div className="a-row">
          {can("media.upload") && <Button size="sm" icon="refresh" busy={busy === "replace"} onClick={() => replaceRef.current?.click()}>Replace file</Button>}
          <input ref={replaceRef} type="file" accept={ACCEPT} hidden onChange={(e) => { replace(e.target.files?.[0]); e.target.value = ""; }} />
          {can("media.delete") && <Button size="sm" variant="danger" icon="trash" busy={busy === "delete"} onClick={remove}>Delete</Button>}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- picker
export function MediaPicker({ kind = "image", onSelect, onClose }) {
  const { can } = useAuth();
  const list = useMediaList({ type: kind === "video" ? "video" : kind === "any" ? "" : "image" });
  const [sel, setSel] = useState(null);
  const [alt, setAlt] = useState("");
  const fileRef = useRef(null);
  const up = useUploader((item) => { list.reload(); setSel(item); setAlt(item.alt || ""); });
  const [over, setOver] = useState(false);
  const choose = async () => {
    if (!sel) return;
    let item = sel;
    if (sel.kind === "image" && alt !== (sel.alt || "") && can("media.edit")) {
      try { item = (await api(`/api/admin/media/${sel.id}`, { method: "PATCH", body: { alt } })).item; } catch { item = { ...sel, alt }; }
    } else if (alt !== (sel.alt || "")) item = { ...sel, alt };
    onSelect(item);
  };
  return (
    <Modal
      title={kind === "video" ? "Choose a video" : "Choose an image"}
      onClose={onClose}
      width={980}
      className="wide"
      footer={
        <>
          {sel?.kind === "image" && <Input value={alt} onChange={setAlt} placeholder="Alt text for this image (recommended)" style={{ maxWidth: 380 }} />}
          <span className="a-spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!sel} onClick={choose}>Use this {kind === "video" ? "video" : "image"}</Button>
        </>
      }
    >
      <div
        onDragOver={(e) => { if (can("media.upload")) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (can("media.upload") && e.dataTransfer.files?.length) up.start(e.dataTransfer.files); }}
      >
        <Toolbar filters={list.filters} setFilters={list.setFilters} data={list.data} extra={can("media.upload") && (
          <>
            <Button variant="primary" icon="upload" onClick={() => fileRef.current?.click()}>Upload new</Button>
            <input ref={fileRef} type="file" multiple accept={kind === "video" ? "video/mp4,video/webm" : "image/*"} hidden onChange={(e) => { up.start(e.target.files); e.target.value = ""; }} />
          </>
        )} />
        {over && <div className="m-drop over" style={{ marginBottom: 10 }}>Drop to upload</div>}
        {up.queue.length > 0 && <div className="m-uploads">{up.queue.map((u) => <div key={u.id} className="m-upload-row"><span className="a-spin" /> {u.name}<div className="m-progress"><span style={{ width: `${Math.round(u.p * 100)}%` }} /></div></div>)}</div>}
        <ErrorBox error={list.error} onRetry={list.reload} />
        {list.loading && !list.data && <Spinner />}
        {list.data && !list.data.items.length && <Empty icon="image" title="Nothing here yet" text="Upload a file or drop it onto this window." />}
        <div className="m-grid">
          {list.data?.items.map((m) => <Tile key={m.id} item={m} selected={sel?.id === m.id} onClick={() => { setSel(m); setAlt(m.alt || ""); }} />)}
        </div>
      </div>
    </Modal>
  );
}
