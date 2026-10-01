import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BLOCKS } from "../../cms/blocks.jsx";
import { BUILTIN_PATHS } from "../../cms/pageMeta.js";
import { api } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { Alert, Badge, Button, Check, CopyButton, Empty, Field, I, IconButton, Input, Modal, Select, Spinner, Tabs, fmtDate, useConfirm, useLoad, useToast } from "../ui.jsx";
import { describeChanges, discardedMessage, docType, keyLabel, same, valueText } from "../docOps.js";

// ---------------------------------------------------------------------------
// Editor side panels and dialogs.
// ---------------------------------------------------------------------------

export function docLabel(docId, store) {
  if (docId === "site") return "Header, footer & site settings";
  if (docId === "seo") return "SEO settings (redirects, robots, schema…)";
  if (docId === "forms") return "Forms";
  const d = store?.working?.[docId] || store?.published?.[docId];
  const builtin = { "page:home": "Home", "page:products": "Products", "page:hms": "Hospital Management Software", "page:cms": "Clinic Management Software", "page:about": "About Us", "page:contact": "Contact Us", "page:privacy": "Privacy Policy", "page:terms": "Terms of Use", "page:thankyou": "Thank You" }[docId];
  return builtin || d?.meta?.label || d?.meta?.slug || docId;
}

// ---------------------------------------------------------------- layers
export function Layers({ ctx, onReorder }) {
  const secs = ctx.structure?.sections || [];
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const selId = ctx.sel?.kind === "section" ? ctx.sel.section?.id : ctx.sel?.section?.id;
  const ro = ctx.readonly;
  const order = secs.map((s) => s.id);
  const op = (action, s) => ctx.doSection({ action, docId: ctx.pageDocId, id: s.id, base: s.base, order });

  const drop = (target, after) => {
    if (!drag || drag === target) return;
    const next = order.filter((x) => x !== drag);
    const at = next.indexOf(target) + (after ? 1 : 0);
    next.splice(at, 0, drag);
    onReorder(next);
  };

  if (!ctx.pageDocId) return <Empty icon="layers" text="No page open." />;
  return (
    <div className="a-stack tight">
      <div className="ed-layer" onClick={() => ctx.select({ kind: "region", region: "header", label: "Header & menu", docId: "site" })}>
        <span className="ed-layer-grip"><I n="layout" size={13} /></span>
        <span className="ed-layer-name">Header &amp; menu <small>all pages</small></span>
      </div>
      {!ctx.structure && <Spinner label="Reading page…" />}
      {secs.map((s) => {
        const isCopy = s.id !== s.base && !s.block;
        return (
          <div
            key={s.id}
            className={`ed-layer ${selId === s.id ? "sel" : ""} ${s.hidden ? "hidden" : ""} ${drag === s.id ? "dragging" : ""} ${over?.id === s.id ? (over.after ? "drop-after" : "drop-before") : ""}`}
            draggable={!ro}
            onDragStart={(e) => { setDrag(s.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", s.id); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}
            onDragOver={(e) => { if (!drag) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setOver({ id: s.id, after: e.clientY > r.top + r.height / 2 }); }}
            onDrop={(e) => { e.preventDefault(); drop(s.id, over?.after); setDrag(null); setOver(null); }}
            onClick={() => ctx.scrollTo({ section: s.id, select: true })}
            title="Drag to reorder · click to jump to it"
          >
            <span className="ed-layer-grip" aria-hidden="true"><I n="grip" size={13} /></span>
            <span className="ed-layer-name">
              {s.label}
              {isCopy && <small>copy</small>}
              {s.block && <small>block</small>}
            </span>
            {!ro && (
              <>
                <IconButton icon={s.hidden ? "eyeOff" : "eye"} className={s.hidden ? "on" : ""} label={s.hidden ? "Show section" : "Hide section"} size={14} onClick={(e) => { e.stopPropagation(); op(s.hidden ? "show" : "hide", s); }} />
                {!s.nodup && <IconButton icon="copy" label="Duplicate" size={14} onClick={(e) => { e.stopPropagation(); op("duplicate", s); }} />}
                {(s.block || isCopy) && <IconButton icon="trash" className="danger" label="Delete" size={14} onClick={(e) => { e.stopPropagation(); op("remove", s); }} />}
              </>
            )}
          </div>
        );
      })}
      <div className="ed-layer" onClick={() => ctx.select({ kind: "region", region: "footer", label: "Footer", docId: "site" })}>
        <span className="ed-layer-grip"><I n="layout" size={13} /></span>
        <span className="ed-layer-name">Footer <small>all pages</small></span>
      </div>
      {!ro && <Button size="sm" icon="plus" onClick={() => ctx.openBlocks(order[order.length - 1] || null)}>Add section</Button>}
      {!ro && secs.length > 0 && <p className="a-hint">Drag sections to reorder them. Hidden sections stay in the draft and can be shown again any time.</p>}
    </div>
  );
}

// --------------------------------------------------------- block library
export function BlockLibrary({ onPick, onClose }) {
  return (
    <Modal title="Add a section" onClose={onClose} width={680}>
      <p className="a-muted">Sections use the same design as the rest of the website. After adding, click its text and images to edit them.</p>
      <div className="ed-blocks">
        {Object.entries(BLOCKS).map(([type, b]) => (
          <button key={type} type="button" className="ed-block-opt" onClick={() => onPick(type)}>
            <strong>{b.label}</strong>
            <span>{b.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------- publish
/**
 * Header/footer script changes in the site draft that this person can't
 * publish. They are left out of their publish (the live scripts stay) and
 * remain a draft for someone with the scripts permission.
 */
function scriptsLeftOut(docId, store, can) {
  if (docId !== "site" || can("site.code")) return false;
  const changed = store.status.site?.changed; // the server's (normalised) view
  return Array.isArray(changed) ? changed.includes("code") : !same(store.published.site?.code?.snippets || [], store.working.site?.code?.snippets || []);
}
function publishAllowed(docId, store, can) {
  const t = docType(docId);
  if (t === "page") {
    if (can("pages.publish")) return true;
    const ch = describeChanges(docId, store.published[docId] || {}, store.working[docId] || {});
    return ch.length > 0 && ch.every((c) => c.kind === "seo") && can("seo.publish");
  }
  if (!can({ site: "site.publish", seo: "seo.publish", forms: "forms.publish" }[t])) return false;
  // nothing left to publish once the script changes are left out?
  if (scriptsLeftOut(docId, store, can)) {
    const changed = store.status.site?.changed;
    return (Array.isArray(changed) ? changed : describeChanges(docId, store.published[docId] || {}, store.working[docId] || {}).map((c) => c.kind)).some((k) => k !== "code");
  }
  return true;
}

export function PublishDialog({ ctx, onClose, docIds: only = null }) {
  const { store, can } = ctx;
  const toast = useToast();
  const candidates = useMemo(() => {
    const ids = new Set(only || []);
    if (!only) {
      if (ctx.pageDocId) ids.add(ctx.pageDocId);
      for (const id of Object.keys({ ...store.working, ...store.published })) if (store.isDirty(id)) ids.add(id);
    }
    return [...ids].filter((id) => store.isDirty(id)).map((id) => ({
      id,
      label: docLabel(id, store),
      changes: describeChanges(id, store.published[id] || {}, store.working[id] || {}).length,
      allowed: publishAllowed(id, store, can),
      scriptsLeftOut: scriptsLeftOut(id, store, can),
      current: id === ctx.pageDocId,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [picked, setPicked] = useState(() => new Set(candidates.filter((c) => c.allowed && (c.current || c.id === "site" || only)).map((c) => c.id)));
  const [note, setNote] = useState("");
  const [mode, setMode] = useState("now");
  const [at, setAt] = useState(() => { const d = new Date(Date.now() + 3600_000); d.setMinutes(0, 0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const toggle = (id, v) => setPicked((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n; });
  const go = async () => {
    setBusy(true); setError(null);
    try {
      const ids = [...picked];
      if (mode === "now") {
        await store.publish(ids, note);
        toast(`Published - ${ids.length === 1 ? candidates.find((c) => c.id === ids[0])?.label : `${ids.length} items`} ${ids.length === 1 ? "is" : "are"} live now.`, { action: ctx.path ? { label: "View live", onClick: () => window.open(ctx.path, "_blank", "noopener") } : undefined });
      } else {
        const when = new Date(at);
        await store.schedulePublish(ids, when.toISOString(), note);
        toast(`Scheduled for ${when.toLocaleString()}`);
      }
      onClose();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <Modal
      title="Publish changes"
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={mode === "now" ? "send" : "clock"} busy={busy} disabled={!picked.size} onClick={go}>
            {mode === "now" ? `Publish ${picked.size || ""} now` : "Schedule"}
          </Button>
        </>
      }
    >
      {!candidates.length ? (
        <Alert tone="ok">Everything is already live - there are no draft changes.</Alert>
      ) : (
        <>
          <p className="a-muted">Choose what goes live. Everything you pick is switched over in one step - if anything fails, the live site stays exactly as it is.</p>
          <div className="a-stack tight">
            {candidates.map((c) => (
              <div key={c.id} className="a-rowcard">
                <div className="a-rowcard-head">
                  <Check checked={picked.has(c.id)} disabled={!c.allowed} onChange={(v) => toggle(c.id, v)} label={<><strong>{c.label}</strong>{c.current && <Badge tone="violet">this page</Badge>}</>} />
                  <span className="a-grow" />
                  <span className="a-small a-muted">{c.changes} change{c.changes === 1 ? "" : "s"}</span>
                </div>
                {!c.allowed && <p className="a-hint">{c.scriptsLeftOut && can("site.publish") ? "Only header & footer script changes are waiting - someone with the scripts permission has to publish them." : "You don't have permission to publish this - ask a publisher."}</p>}
                {c.allowed && c.scriptsLeftOut && <p className="a-hint">Header &amp; footer script changes are not included - the live scripts stay as they are and the changes stay a draft for someone with the scripts permission.</p>}
              </div>
            ))}
          </div>
          <Field label="Note (optional)" hint="Shown in revision history, e.g. “New pricing copy for Q4”.">
            <Input value={note} onChange={setNote} maxLength={200} />
          </Field>
          <Tabs className="small" value={mode} onChange={setMode} tabs={[{ id: "now", label: "Publish now", icon: "send" }, { id: "schedule", label: "Schedule", icon: "clock" }]} />
          {mode === "schedule" && (
            <Field label="Go live at" hint="Uses your computer's time zone. The version you see now is frozen - later edits stay in the draft.">
              <Input type="datetime-local" value={at} onChange={setAt} min={new Date(Date.now() + 120000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} />
            </Field>
          )}
          {error && <Alert tone="error">{error.message}{error.data?.details?.length ? <ul>{error.data.details.slice(0, 5).map((d, i) => <li key={i}>{d.message}</li>)}</ul> : null}</Alert>}
        </>
      )}
    </Modal>
  );
}

// --------------------------------------------------------------- history
export function HistoryDialog({ docIds, label, onClose, onView }) {
  const [tab, setTab] = useState(docIds[0]);
  const [list, { loading, error }] = useLoad(() => api(`/api/admin/content/doc/${encodeURIComponent(tab)}/revisions`).then((r) => r.revisions), [tab]);
  const [opening, setOpening] = useState(null);
  const toast = useToast();
  const open = async (r) => {
    setOpening(r.rev);
    try {
      const d = await api(`/api/admin/content/doc/${encodeURIComponent(tab)}/revisions/${r.rev}`);
      onView({ docId: tab, rev: r.rev, data: d.revision.data, publishedAt: r.publishedAt, label: tab === "site" ? "the header & footer" : label });
    } catch (e) { toast(e.message, { tone: "error" }); } finally { setOpening(null); }
  };
  return (
    <Modal title="Revision history" onClose={onClose} width={620}>
      <p className="a-muted">Every publish is kept. Open an older version to see it on the page, then restore it to the draft if you want it back.</p>
      {docIds.length > 1 && <Tabs className="small" value={tab} onChange={setTab} tabs={docIds.map((id) => ({ id, label: id === "site" ? "Header & footer" : label }))} />}
      {loading && <Spinner />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {list && !list.length && <Empty icon="history" title="No published versions yet" text="Revisions appear here after the first publish from Super Admin." />}
      {list && list.length > 0 && (
        <div className="a-list">
          {list.map((r, i) => (
            <div key={r.rev} className="a-list-row">
              <Badge tone={i === 0 ? "green" : "gray"}>rev {r.rev}</Badge>
              <div className="a-grow">
                <div><strong>{fmtDate(r.publishedAt)}</strong> <span className="a-muted">by {r.publishedBy?.name || "system"}</span>{r.source === "schedule" && <Badge tone="blue">scheduled</Badge>}{i === 0 && <Badge tone="green">live</Badge>}</div>
                {r.note && <div className="a-small a-muted">{r.note}</div>}
              </div>
              <Button size="sm" icon="eye" busy={opening === r.rev} onClick={() => open(r)}>View</Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// --------------------------------------------------------------- preview
const PREVIEW_PERMS = ["pages.edit", "pages.publish", "seo.edit", "seo.publish", "site.edit", "site.publish", "site.code", "forms.edit", "forms.publish"];

export function PreviewDialog({ path, label, onClose }) {
  const toast = useToast();
  const { can, me } = useAuth();
  const canCreate = can(PREVIEW_PERMS);
  const canRevoke = (p) => p.createdBy?.id === me.id || can(["pages.publish", "seo.publish", "site.publish"]);
  const [hours, setHours] = useState("24");
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [list, { reload }] = useLoad(() => api("/api/admin/content/previews").then((r) => r.previews), []);
  const create = async (openIt) => {
    setBusy(true);
    try {
      const r = await api("/api/admin/content/previews", { method: "POST", body: { label, hours: Number(hours) } });
      const url = `${window.location.origin}${path}?kibo_preview=${r.token}`;
      setLink({ url, exp: r.preview.exp });
      reload();
      if (openIt) window.open(url, "_blank", "noopener");
    } catch (e) { toast(e.message, { tone: "error" }); } finally { setBusy(false); }
  };
  const revoke = async (id) => {
    try { await api(`/api/admin/content/previews/${id}`, { method: "DELETE" }); reload(); toast("Preview link revoked"); } catch (e) { toast(e.message, { tone: "error" }); }
  };
  return (
    <Modal title="Preview drafts" onClose={onClose} width={600}>
      <p className="a-muted">A preview link shows the website with <strong>all current drafts</strong> - exactly how it will look after publishing. It is secret, expires automatically, and is never indexed by search engines. Share it with colleagues for review.</p>
      {canCreate ? (
        <div className="a-row">
          <Field label="Link valid for">
            <Select value={hours} onChange={setHours} options={[{ value: "1", label: "1 hour" }, { value: "24", label: "24 hours" }, { value: "72", label: "3 days" }, { value: "168", label: "7 days" }, { value: "720", label: "30 days" }]} />
          </Field>
          <span className="a-spacer" />
          <Button icon="link" busy={busy} onClick={() => create(false)}>Create share link</Button>
          <Button variant="primary" icon="external" busy={busy} onClick={() => create(true)}>Open preview</Button>
        </div>
      ) : (
        <Alert tone="info">Preview links can be created by editors and publishers. Ask one of them to share a link with you.</Alert>
      )}
      {link && (
        <Alert tone="ok">
          <div className="a-stack tight">
            <strong>Preview link ready</strong>
            <code style={{ wordBreak: "break-all" }}>{link.url}</code>
            <div className="a-row"><CopyButton text={link.url} label="Copy link" /><span className="a-small">Expires {fmtDate(link.exp)}</span></div>
          </div>
        </Alert>
      )}
      {list?.length > 0 && (
        <>
          <div className="a-section-title">Active preview links</div>
          <div className="a-list">
            {list.map((p) => (
              <div key={p.id} className="a-list-row">
                <div className="a-grow"><strong>{p.label}</strong> <span className="a-muted a-small">by {p.createdBy?.name} · expires {fmtDate(p.exp)}</span></div>
                {canRevoke(p) && <Button size="sm" variant="danger" onClick={() => revoke(p.id)}>Revoke</Button>}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

// --------------------------------------------------------- draft vs live
export function ChangesList({ ctx, docIds }) {
  const { store } = ctx;
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <div className="a-stack">
      <div className="ed-insp-title"><I n="columns" /><h3>Draft vs live</h3></div>
      <p className="a-muted a-small">Left: what visitors see now. Right: your draft. Below: every change that will go live when you publish.</p>
      {docIds.map((id) => {
        const changes = describeChanges(id, store.published[id] || {}, store.working[id] || {});
        return (
          <div key={id} className="a-stack tight">
            <div className="a-row between"><strong>{docLabel(id, store)}</strong><Badge tone={changes.length ? "amber" : "green"}>{changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"}` : "no changes"}</Badge></div>
            {changes.slice(0, 60).map((c) => (
              <div key={c.key} className="ed-change">
                <div className="k">{c.kind === "field" ? keyLabel(c.key) : { layout: "Section order / visibility", lists: "Item order / visibility", seo: "SEO settings", meta: "Page name / URL", header: "Header", menus: "Menus", footer: "Footer", banners: "Banners", settings: "Website settings", code: "Header & footer scripts" }[c.kind] || c.kind}</div>
                {c.kind === "field" && (
                  <>
                    <del>{valueText(c.before)}</del>
                    <ins>{valueText(c.after)}</ins>
                  </>
                )}
              </div>
            ))}
            {changes.length > 0 && (id === "site" ? changes.some((c) => ctx.can(c.kind === "code" ? "site.code" : "site.edit")) : ctx.can("pages.edit")) && (id !== ctx.pageDocId || store.published[id] || !id.startsWith("page:c-")) && (
              <Button size="sm" variant="danger" icon="trash" onClick={async () => {
                const ok = await confirm({ title: "Discard draft changes?", message: `All unpublished changes to “${docLabel(id, store)}” are thrown away and it goes back to the live version. This cannot be undone.`, confirmLabel: "Discard changes", danger: true });
                if (!ok) return;
                try {
                  const kept = (await store.discard(id))?.kept || [];
                  toast(discardedMessage(kept), kept.length ? { duration: 7000 } : undefined);
                } catch (e) { toast(e.message, { tone: "error" }); }
              }}>Discard these changes</Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------ custom page meta
const SLUG_RE = /^\/[a-z0-9]+(?:[-/][a-z0-9]+)*$/;
const RESERVED = ["/admin", "/api", "/uploads", "/assets", "/preview", "/thank-you", "/sitemap.xml", "/robots.txt", "/llms.txt"];
export function slugProblem(slug, store, selfId) {
  if (!SLUG_RE.test(slug)) return "Use lowercase letters, numbers and dashes, starting with / (e.g. /landing/hospital-software)";
  if (RESERVED.some((r) => slug === r || slug.startsWith(`${r}/`)) || BUILTIN_PATHS.includes(slug)) return "That address is already used by the website";
  const clash = Object.entries(store.working).find(([id, d]) => id !== selfId && id.startsWith("page:c-") && d?.meta?.slug === slug);
  if (clash) return "Another page already uses this address";
  return null;
}

export function PageSettings({ ctx }) {
  const { store, pageDocId, can } = ctx;
  const doc = store.working[pageDocId] || {};
  const published = store.published[pageDocId];
  const [label, setLabel] = useState(doc.meta?.label || "");
  const [slug, setSlug] = useState(doc.meta?.slug || "");
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  useEffect(() => { setLabel(doc.meta?.label || ""); setSlug(doc.meta?.slug || ""); }, [pageDocId]); // eslint-disable-line react-hooks/exhaustive-deps
  const problem = slug !== doc.meta?.slug ? slugProblem(slug, store, pageDocId) : null;
  const ro = !can("pages.edit");

  const saveLabel = () => { if (label.trim() && label !== doc.meta?.label) store.update(pageDocId, (d) => ({ ...d, meta: { ...(d.meta || {}), label: label.trim() } }), { label: "Rename page" }); };
  const saveSlug = async () => {
    if (problem || slug === doc.meta?.slug) return;
    const old = published?.meta?.slug;
    store.update(pageDocId, (d) => ({ ...d, meta: { ...(d.meta || {}), slug } }), { label: "Change page URL" });
    ctx.goPage(slug);
    if (old && old !== slug && can("seo.edit")) {
      const ok = await confirm({ title: "Redirect the old address?", message: `Visitors and Google know this page as ${old}. Add a permanent (301) redirect from ${old} to ${slug}? It goes live when you publish SEO settings.`, confirmLabel: "Add redirect" });
      if (ok) {
        store.update("seo", (d) => ({ ...d, redirects: [...(d?.redirects || []).filter((r) => r.from !== old), { id: `rd_${Math.random().toString(36).slice(2, 10)}`, from: old, to: slug, type: 301, enabled: true, note: `Page moved (${doc.meta?.label || slug})` }] }), { label: "Add redirect" });
        toast("Redirect added to the SEO draft");
      }
    }
  };
  return (
    <div className="a-stack">
      <Field label="Page name" hint="Used in the admin, breadcrumbs and as the default SEO title.">
        <Input value={label} disabled={ro} onChange={setLabel} onBlur={saveLabel} onKeyDown={(e) => e.key === "Enter" && saveLabel()} />
      </Field>
      <Field label="Page address (URL)" error={problem}>
        <div className="a-input-group">
          <Input value={slug} disabled={ro} onChange={(v) => setSlug(v.toLowerCase().replace(/\s+/g, "-"))} onKeyDown={(e) => e.key === "Enter" && saveSlug()} />
          <Button disabled={ro || !!problem || slug === doc.meta?.slug} onClick={saveSlug}>Change</Button>
        </div>
      </Field>
      <div className="m-kv">
        <dt>Status</dt><dd>{published ? `Live at ${published.meta?.slug}` : "Draft only - not on the website yet"}</dd>
      </div>
      {published && can("pages.publish") && (
        <Button icon="eyeOff" onClick={async () => {
          const ok = await confirm({ title: "Unpublish this page?", message: "The page is removed from the live website (visitors get a 404) and from the sitemap. Its content is kept as a draft so you can publish it again later.", confirmLabel: "Unpublish", danger: true });
          if (!ok) return;
          try { await store.unpublishPage(pageDocId); toast("Page unpublished"); } catch (e) { toast(e.message, { tone: "error" }); }
        }}>Unpublish page</Button>
      )}
      {can("pages.create") && (!published || can("pages.publish")) && (
        <Button variant="danger" icon="trash" onClick={async () => {
          const ok = await confirm({ title: "Delete this page?", message: published ? "The page is removed from the live website immediately and its drafts are deleted. Consider adding a redirect for its address." : "The draft page is deleted permanently.", confirmLabel: "Delete page", danger: true });
          if (!ok) return;
          try { await store.deletePage(pageDocId); toast("Page deleted"); navigate("/admin/pages"); } catch (e) { toast(e.message, { tone: "error" }); }
        }}>Delete page</Button>
      )}
    </div>
  );
}

