import { useState } from "react";
import { Link } from "react-router-dom";
import { api, download } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { Badge, Button, Card, Empty, ErrorBox, IconButton, Input, PageHead, Select, Spinner, fmtDate, timeAgo, useConfirm, useLoad, useToast } from "../ui.jsx";

// ---------------------------------------------------------------------------
// Form submissions: every entry with its values and marketing attribution.
// ---------------------------------------------------------------------------

export function sourceOf(ctx = {}) {
  const u = ctx.firstTouch?.utm?.source ? ctx.firstTouch.utm : ctx.utm || {};
  if (u.source) return `${u.source}${u.medium ? ` / ${u.medium}` : ""}${u.campaign ? ` · ${u.campaign}` : ""}`;
  if (ctx.gclid) return "Google Ads";
  if (ctx.fbclid) return "Facebook / Instagram ad";
  const ref = ctx.firstTouch?.referrer || ctx.referrer;
  if (ref) { try { return new URL(ref).hostname.replace(/^www\./, ""); } catch { return ref; } }
  return ctx.channel && ctx.channel !== "website" ? ctx.channel : "Direct";
}

export function Attribution({ ctx }) {
  if (!ctx) return null;
  const ft = ctx.firstTouch || {};
  const rows = [
    ["Source", sourceOf(ctx)],
    ["Submitted on", ctx.page],
    ["First landing page", ft.landingPage || ctx.landingPage],
    ["Referrer", ft.referrer || ctx.referrer],
    ["UTM campaign", ctx.utm?.campaign || ft.utm?.campaign],
    ["UTM term / content", [ctx.utm?.term || ft.utm?.term, ctx.utm?.content || ft.utm?.content].filter(Boolean).join(" · ")],
    ["Google click ID", ctx.gclid],
    ["Facebook click ID", ctx.fbclid],
    ["First visit", ft.at ? fmtDate(ft.at) : ""],
  ].filter(([, v]) => v);
  return <dl className="m-kv">{rows.map(([k, v]) => <FragmentRow key={k} k={k} v={v} />)}</dl>;
}
const FragmentRow = ({ k, v }) => (<><dt>{k}</dt><dd>{v}</dd></>);

const valueText = (v) => (Array.isArray(v) ? v.join(", ") : v === true ? "Yes" : v === false ? "No" : String(v ?? ""));

export default function Submissions() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({ formId: "", q: "", from: "", to: "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const [data, { loading, error, reload }] = useLoad(() => api(`/api/admin/submissions?limit=500&${qs}`), [qs]);
  const [open, setOpen] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  return (
    <div className="a-page">
      <PageHead title="Form Submissions" subtitle="Every form sent from the website, with where the visitor came from." actions={can("leads.export") && <Button icon="download" onClick={() => download(`/api/admin/submissions/export.csv?${qs}`, "submissions.csv").catch((e) => toast(e.message, { tone: "error" }))}>Export CSV</Button>} />
      <div className="m-toolbar">
        <Input className="m-search" value={f.q} onChange={(v) => set({ q: v })} placeholder="Search names, emails, messages…" />
        <Select value={f.formId} onChange={(v) => set({ formId: v })} options={[{ value: "", label: "All forms" }, ...(data?.forms || []).map((id) => ({ value: id, label: id }))]} />
        <Input type="date" value={f.from} onChange={(v) => set({ from: v })} aria-label="From date" />
        <Input type="date" value={f.to} onChange={(v) => set({ to: v })} aria-label="To date" />
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data && <Spinner />}
      {data && (
        <Card pad={false} title={`${data.total} submission${data.total === 1 ? "" : "s"}`}>
          {!data.submissions.length ? <Empty icon="inbox" text="No submissions match these filters." /> : (
            <div className="a-table-wrap">
              <table className="a-table">
                <thead><tr><th>Received</th><th>Form</th><th>From</th><th>Source</th><th>Message</th><th /></tr></thead>
                <tbody>
                  {data.submissions.map((s) => {
                    const L = s.lead || {};
                    return (
                      <FragmentRows key={s.id} s={s} L={L} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} canDelete={can("leads.delete")} onDelete={async () => {
                        if (!(await confirm({ title: "Delete this submission?", message: "It is removed permanently (the lead stays).", danger: true, confirmLabel: "Delete" }))) return;
                        try { await api(`/api/admin/submissions/${s.id}`, { method: "DELETE" }); toast("Submission deleted"); reload(); } catch (e) { toast(e.message, { tone: "error" }); }
                      }} />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FragmentRows({ s, L, open, onToggle, canDelete, onDelete }) {
  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td className="a-small">{timeAgo(s.receivedAt)}<div className="a-muted">{fmtDate(s.receivedAt)}</div></td>
        <td><Badge tone="violet">{s.formName || s.formId}</Badge></td>
        <td><strong>{L.name || "-"}</strong><div className="a-small a-muted">{L.email}{L.phone ? ` · ${L.phone}` : ""}</div></td>
        <td className="a-small">{sourceOf(s.context)}</td>
        <td className="a-small" style={{ maxWidth: 320 }}><span className="a-ellipsis" style={{ display: "block" }}>{L.message || ""}</span></td>
        <td className="actions">
          {s.leadId && <Link className="a-btn a-btn-sm a-btn-ghost" to={`/admin/leads?lead=${s.leadId}`} onClick={(e) => e.stopPropagation()}>Lead</Link>}
          <IconButton icon={open ? "chevronDown" : "chevronRight"} label="Details" />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ background: "#fbfaff" }}>
            <div className="a-two">
              <div>
                <div className="a-section-title">Answers</div>
                <dl className="m-kv">{Object.entries(s.values || {}).map(([k, v]) => <FragmentRow key={k} k={k} v={valueText(v)} />)}</dl>
              </div>
              <div>
                <div className="a-section-title">Attribution</div>
                <Attribution ctx={s.context} />
                {canDelete && <Button size="sm" variant="danger" icon="trash" onClick={onDelete} style={{ marginTop: 12 }}>Delete submission</Button>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

