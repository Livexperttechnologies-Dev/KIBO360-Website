import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { siteEntries } from "../../cms/seo.js";
import { api } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { useContent } from "../store.jsx";
import { Alert, Badge, Button, Card, Empty, ErrorBox, PageHead, Spinner, fmtDate, timeAgo, useConfirm, useLoad, useToast } from "../ui.jsx";
import { describeChanges, keyLabel, valueText } from "../docOps.js";
import { docLabel } from "../editor/panels.jsx";

// ---------------------------------------------------------------------------
// Revision history: every published version of every document, what changed
// in it, one-click restore to draft, and scheduled publishes.
// ---------------------------------------------------------------------------

export default function Revisions() {
  const store = useContent();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const docs = useMemo(() => {
    const ids = new Set(["site", "seo", "forms", ...siteEntries(store?.working || {}).map((e) => `page:${e.id}`), ...Object.keys(store?.published || {})]);
    return [...ids];
  }, [store?.working, store?.published]);
  const [docId, setDocId] = useState("page:home");
  const [list, { loading, error, reload }] = useLoad(() => api(`/api/admin/content/doc/${encodeURIComponent(docId)}/revisions`).then((r) => r.revisions), [docId]);
  const [sched, schedCtl] = useLoad(() => api("/api/admin/content/schedules").then((r) => r.schedules), []);
  const [view, setView] = useState(null);
  const open = async (r) => {
    try {
      const d = await api(`/api/admin/content/doc/${encodeURIComponent(docId)}/revisions/${r.rev}`);
      const idx = list.findIndex((x) => x.rev === r.rev);
      const prev = list[idx + 1] ? (await api(`/api/admin/content/doc/${encodeURIComponent(docId)}/revisions/${list[idx + 1].rev}`)).revision.data : {};
      setView({ rev: r.rev, data: d.revision.data, changes: describeChanges(docId, prev, d.revision.data), meta: r });
    } catch (e) { toast(e.message, { tone: "error" }); }
  };
  if (!store?.loaded) return <div className="a-page"><Spinner /></div>;
  const canEdit = docId === "site" ? can("site.edit") : docId === "seo" ? can("seo.edit") : docId === "forms" ? can("forms.edit") : can("pages.edit");
  const pending = (sched || []).filter((s) => s.status === "pending");
  return (
    <div className="a-page">
      <PageHead title="Revision History" subtitle="Every published version is kept (last 100 per page). Restoring puts an old version into the draft - you review it, then publish." />
      {pending.length > 0 && (
        <Card title="Scheduled publishing">
          <div className="a-list">
            {pending.map((s) => (
              <div key={s.id} className="a-list-row">
                <Badge tone="blue">{new Date(s.at).toLocaleString()}</Badge>
                <div className="a-grow">{s.docIds.map((id) => docLabel(id, store)).join(", ")}<div className="a-small a-muted">by {s.createdBy?.name}{s.note ? ` · ${s.note}` : ""}</div></div>
                {can(["pages.publish", "seo.publish", "site.publish", "forms.publish"]) && <Button size="sm" variant="danger" onClick={async () => {
                  if (!(await confirm({ title: "Cancel this scheduled publish?", danger: true, confirmLabel: "Cancel schedule" }))) return;
                  try { await api(`/api/admin/content/schedules/${s.id}`, { method: "DELETE" }); schedCtl.reload(); store.refreshStatus(); toast("Schedule cancelled"); } catch (e) { toast(e.message, { tone: "error" }); }
                }}>Cancel</Button>}
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="a-split" style={{ marginTop: 16 }}>
        <div className="a-card" style={{ padding: 8 }}>
          <div className="a-side-list">
            {docs.map((id) => (
              <button key={id} type="button" className={`a-side-item ${id === docId ? "active" : ""}`} onClick={() => { setDocId(id); setView(null); }}>
                <span style={{ flex: 1 }}>{docLabel(id, store)}{store.status[id]?.publishedRev ? <small className="a-muted" style={{ display: "block" }}>rev {store.status[id].publishedRev} · {timeAgo(store.status[id].publishedAt)}</small> : <small className="a-muted" style={{ display: "block" }}>never published</small>}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="a-stack">
          <ErrorBox error={error} onRetry={reload} />
          {loading && !list && <Spinner />}
          {list && (
            <Card title={docLabel(docId, store)} pad={false} actions={docId.startsWith("page:") && <Link className="a-btn a-btn-sm" to={`/admin/editor?path=${encodeURIComponent(siteEntries(store.working).find((e) => `page:${e.id}` === docId)?.path || "/")}`}>Open in editor</Link>}>
              {!list.length ? <Empty icon="history" text="No published versions yet." /> : (
                <div className="a-table-wrap">
                  <table className="a-table">
                    <thead><tr><th>Version</th><th>Published</th><th>By</th><th>Note</th><th /></tr></thead>
                    <tbody>
                      {list.map((r, i) => (
                        <tr key={r.rev} className={view?.rev === r.rev ? "" : "clickable"} onClick={() => open(r)} style={view?.rev === r.rev ? { background: "var(--a-brand-soft)" } : undefined}>
                          <td><Badge tone={i === 0 ? "green" : "gray"}>rev {r.rev}</Badge>{i === 0 && <span className="a-small a-muted"> live</span>}</td>
                          <td className="a-small">{fmtDate(r.publishedAt)}</td>
                          <td className="a-small">{r.publishedBy?.name || "system"}{r.source === "schedule" ? " (scheduled)" : ""}</td>
                          <td className="a-small">{r.note}</td>
                          <td className="actions"><Button size="sm">View</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
          {view && (
            <Card title={`Revision ${view.rev}`} subtitle={`Published ${fmtDate(view.meta.publishedAt)} by ${view.meta.publishedBy?.name || "system"}`} actions={canEdit && (
              <Button size="sm" variant="primary" onClick={async () => {
                if (!(await confirm({ title: `Restore revision ${view.rev} to the draft?`, message: "The current draft of this document is replaced. Nothing changes on the live site until you publish.", confirmLabel: "Restore to draft" }))) return;
                try { await store.restoreRevision(docId, view.rev); toast(`Revision ${view.rev} is now the draft - review and publish it`); } catch (e) { toast(e.message, { tone: "error" }); }
              }}>Restore to draft</Button>
            )}>
              <div className="a-section-title">Changes in this version</div>
              {!view.changes.length ? <p className="a-muted">No content changes compared with the version before.</p> : (
                <div className="a-stack tight">
                  {view.changes.slice(0, 80).map((c) => (
                    <div key={c.key} className="ed-change">
                      <div className="k">{c.kind === "field" ? keyLabel(c.key) : c.kind}</div>
                      {c.kind === "field" ? <><del>{valueText(c.before)}</del><ins>{valueText(c.after)}</ins></> : <span className="a-small a-muted">section settings changed</span>}
                    </div>
                  ))}
                </div>
              )}
              {docId.startsWith("page:") && <Alert tone="info">To see this version on the page itself, open the page in the visual editor → History → View.</Alert>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
