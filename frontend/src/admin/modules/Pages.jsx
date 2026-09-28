import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { siteEntries } from "../../cms/seo.js";
import { BUILTIN_PATHS } from "../../cms/pageMeta.js";
import { useAuth } from "../AdminApp.jsx";
import { useContent } from "../store.jsx";
import { Alert, Badge, Button, Card, Empty, ErrorBox, Field, I, Input, Modal, PageHead, Spinner, Tabs, timeAgo, useConfirm, useToast } from "../ui.jsx";
import { describeChanges } from "../docOps.js";
import { PublishDialog, slugProblem } from "../editor/panels.jsx";

// ---------------------------------------------------------------------------
// Pages & Content: every page of the website with its draft/live status.
// ---------------------------------------------------------------------------

const rid = () => `b_${Math.random().toString(36).slice(2, 12)}`;
const TEMPLATES = [
  { id: "landing", name: "Landing page", text: "Hero, benefits, numbers, FAQ and a lead form", blocks: ["hero", "cards", "stats", "split", "faq", "form"] },
  { id: "product", name: "Product page", text: "Hero, story, features, video, FAQ and call to action", blocks: ["hero", "split", "cards", "video", "faq", "cta"] },
  { id: "article", name: "Article / text page", text: "Heading and long-form rich text", blocks: ["hero", "richText", "cta"] },
  { id: "blank", name: "Blank page", text: "Start empty and add sections yourself", blocks: [] },
];

function layoutFrom(types) {
  const blocks = {};
  const order = [];
  for (const t of types) { const id = rid(); blocks[id] = t === "stats" ? { type: t, bg: "dark" } : { type: t }; order.push(id); }
  return { order, hidden: {}, dups: {}, blocks };
}

export function statusOf(store, e) {
  const docId = `page:${e.id}`;
  const st = store.status[docId];
  const pub = store.published[docId];
  const changes = describeChanges(docId, pub || {}, store.working[docId] || {}).length;
  if (st?.scheduled?.length) return { tone: "blue", label: "Scheduled", changes, st };
  if (!e.builtin && !pub) return { tone: "gray", label: "Draft (not live)", changes, st };
  if (changes) return { tone: "amber", label: "Draft changes", changes, st };
  return { tone: "green", label: "Live", changes, st };
}

export default function PagesList() {
  const store = useContent();
  const { can } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(null);
  const entries = useMemo(() => siteEntries(store?.working || {}), [store?.working]);

  if (!store?.loaded) return <div className="a-page"><Spinner /></div>;
  if (store.error) return <div className="a-page"><ErrorBox error={store.error} onRetry={store.load} /></div>;

  const rows = entries
    .map((e) => ({ e, s: statusOf(store, e) }))
    .filter(({ e, s }) => (tab === "all" || (tab === "builtin" && e.builtin) || (tab === "custom" && !e.builtin) || (tab === "drafts" && s.changes > 0)))
    .filter(({ e }) => !q || `${e.label} ${e.path}`.toLowerCase().includes(q.toLowerCase()));
  const drafts = entries.filter((e) => statusOf(store, e).changes > 0).length;

  return (
    <div className="a-page">
      <PageHead
        title="Pages & Content"
        subtitle="Click Edit to open a page exactly as visitors see it and change text, images and buttons in place. Changes are saved as drafts until you publish."
        actions={can("pages.create") && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New page</Button>}
      />
      <div className="a-row" style={{ marginBottom: 12 }}>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "all", label: "All pages", badge: entries.length }, { id: "builtin", label: "Main pages" }, { id: "custom", label: "Landing pages", badge: entries.filter((e) => !e.builtin).length || null }, { id: "drafts", label: "With drafts", badge: drafts || null }]} />
        <span className="a-spacer" />
        <Input value={q} onChange={setQ} placeholder="Search pages…" style={{ maxWidth: 240 }} aria-label="Search pages" />
      </div>
      <Card pad={false}>
        {!rows.length ? <Empty icon="pages" text="No pages match." /> : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Page</th><th>Status</th><th>Last edited</th><th>Live since</th><th /></tr></thead>
              <tbody>
                {rows.map(({ e, s }) => {
                  const docId = `page:${e.id}`;
                  return (
                    <tr key={docId}>
                      <td>
                        <Link to={`/admin/editor?path=${encodeURIComponent(e.path)}`} className="a-strong" style={{ color: "var(--a-ink)" }}>{e.label}</Link>
                        <div className="a-small a-muted">{e.path}{e.noindex ? " · noindex" : ""}{!e.builtin ? " · landing page" : ""}</div>
                      </td>
                      <td><Badge tone={s.tone}>{s.label}</Badge>{s.changes > 0 && <div className="a-small a-muted">{s.changes} unpublished change{s.changes === 1 ? "" : "s"}</div>}</td>
                      <td className="a-small">{s.st?.draftUpdatedAt ? <>{timeAgo(s.st.draftUpdatedAt)}<div className="a-muted">{s.st.draftUpdatedBy?.name}</div></> : <span className="a-muted">-</span>}</td>
                      <td className="a-small">{s.st?.publishedAt ? <>{timeAgo(s.st.publishedAt)}<div className="a-muted">rev {s.st.publishedRev}</div></> : <span className="a-muted">{e.builtin ? "original" : "-"}</span>}</td>
                      <td className="actions">
                        <div className="a-row nowrap" style={{ justifyContent: "flex-end" }}>
                          <Button size="sm" variant="primary" icon="edit" onClick={() => navigate(`/admin/editor?path=${encodeURIComponent(e.path)}`)}>{can("pages.edit") ? "Edit" : "View"}</Button>
                          {s.changes > 0 && can(["pages.publish", "seo.publish"]) && <Button size="sm" icon="send" onClick={() => setPublishing(docId)}>Publish</Button>}
                          {(store.published[docId] || e.builtin) && <a className="a-btn a-btn-sm a-btn-ghost" href={e.path} target="_blank" rel="noopener noreferrer" title="Open the live page"><I n="external" size={14} /></a>}
                          {!e.builtin && can("pages.create") && (!store.published[docId] || can("pages.publish")) && (
                            <Button size="sm" variant="ghost" icon="trash" aria-label="Delete page" onClick={async () => {
                              const ok = await confirm({ title: `Delete “${e.label}”?`, message: store.published[docId] ? "The page is removed from the live website immediately. Consider adding a redirect for its address in SEO → Redirects." : "The draft page is deleted.", confirmLabel: "Delete page", danger: true });
                              if (!ok) return;
                              try { await store.deletePage(docId); toast("Page deleted"); } catch (err) { toast(err.message, { tone: "error" }); }
                            }} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {creating && <NewPage onClose={() => setCreating(false)} onCreated={(slug) => navigate(`/admin/editor?path=${encodeURIComponent(slug)}`)} />}
      {publishing && <PublishDialog ctx={{ store, can, pageDocId: publishing, path: entries.find((e) => `page:${e.id}` === publishing)?.path }} docIds={[publishing]} onClose={() => setPublishing(null)} />}
    </div>
  );
}

function NewPage({ onClose, onCreated }) {
  const store = useContent();
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [tpl, setTpl] = useState("landing");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const auto = `/${label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)}`;
  const value = touched ? slug : auto === "/" ? "" : auto;
  const problem = value ? slugProblem(value, store, null) : null;
  const create = async () => {
    setBusy(true); setError(null);
    try {
      const t = TEMPLATES.find((x) => x.id === tpl);
      const r = await store.createPage({ label: label.trim(), slug: value, reservedPaths: BUILTIN_PATHS, layout: layoutFrom(t.blocks), fields: {} });
      toast("Page created as a draft - edit it, then publish when ready");
      onCreated(store.getWorking(r.docId)?.meta?.slug || value);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="New page" onClose={onClose} width={620} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} disabled={!label.trim() || !value || !!problem} onClick={create}>Create &amp; edit</Button></>}>
      <Field label="Page name"><Input value={label} onChange={setLabel} placeholder="e.g. Hospital Software for Nursing Homes" autoFocus /></Field>
      <Field label="Address (URL)" error={problem} hint={value ? `kibo360.in${value}` : "Generated from the name - you can change it"}>
        <Input value={value} onChange={(v) => { setTouched(true); setSlug(v.toLowerCase().replace(/\s+/g, "-")); }} placeholder="/landing/nursing-home-software" />
      </Field>
      <div className="a-label">Start from</div>
      <div className="ed-blocks">
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="ed-block-opt" style={tpl === t.id ? { borderColor: "var(--a-brand)", background: "var(--a-brand-soft)" } : undefined} onClick={() => setTpl(t.id)}>
            <strong>{t.name}</strong><span>{t.text}</span>
          </button>
        ))}
      </div>
      <Alert tone="info">New pages use the website's own design blocks. Nothing is visible to visitors until you publish.</Alert>
      {error && <Alert tone="error">{error.message}</Alert>}
    </Modal>
  );
}
