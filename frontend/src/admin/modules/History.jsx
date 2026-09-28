import { useState } from "react";
import { api } from "../api.js";
import { Badge, Card, Empty, ErrorBox, Input, PageHead, Select, Spinner, fmtDate, timeAgo, useLoad } from "../ui.jsx";
import { actionText } from "./Dashboard.jsx";
import { docLabel } from "../editor/panels.jsx";

// ---------------------------------------------------------------------------
// Change history: the append-only audit log of every admin action.
// ---------------------------------------------------------------------------

const GROUPS = [
  { value: "", label: "All activity" }, { value: "content", label: "Pages & publishing" }, { value: "media", label: "Media" },
  { value: "seo", label: "SEO tools" }, { value: "lead", label: "Leads" }, { value: "submission", label: "Submissions" },
  { value: "settings", label: "Settings" }, { value: "user", label: "Team" }, { value: "role", label: "Roles" }, { value: "auth", label: "Sign-ins" },
];
const tone = (a) => (a.includes("publish") ? "green" : a.includes("delete") || a.includes("purge") || a.includes("failed") || a.includes("trash") ? "red" : a.startsWith("auth") ? "gray" : "violet");
const targetText = (t) => (/^(page:|site$|seo$|forms$)/.test(t) ? docLabel(t) : t);

export default function History() {
  const [f, setF] = useState({ action: "", target: "", since: "", limit: "300" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const [entries, { loading, error, reload }] = useLoad(() => api(`/api/admin/audit?${qs}`).then((r) => r.entries), [qs]);
  const [open, setOpen] = useState(null);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  return (
    <div className="a-page">
      <PageHead title="Change History" subtitle="Who changed what and when. The log is append-only and can't be edited from the admin." />
      <div className="m-toolbar">
        <Select value={f.action} onChange={(v) => set({ action: v })} options={GROUPS} />
        <Input className="m-search" value={f.target} onChange={(v) => set({ target: v })} placeholder="Filter by page, file, email…" />
        <Input type="date" value={f.since} onChange={(v) => set({ since: v })} aria-label="Since" />
        <Select value={f.limit} onChange={(v) => set({ limit: v })} options={["100", "300", "1000", "2000"].map((x) => ({ value: x, label: `Last ${x}` }))} />
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !entries && <Spinner />}
      {entries && (
        <Card pad={false}>
          {!entries.length ? <Empty icon="history" text="Nothing matches." /> : (
            <div className="a-table-wrap">
              <table className="a-table">
                <thead><tr><th>When</th><th>Who</th><th>What</th><th>Target</th><th>From</th></tr></thead>
                <tbody>
                  {entries.map((e, i) => (
                    <FragmentRows key={i} e={e} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function FragmentRows({ e, open, onToggle }) {
  return (
    <>
      <tr className={e.details ? "clickable" : ""} onClick={e.details ? onToggle : undefined}>
        <td className="a-small" title={fmtDate(e.at)}>{timeAgo(e.at)}<div className="a-muted">{fmtDate(e.at)}</div></td>
        <td><strong>{e.userName || "System"}</strong><div className="a-small a-muted">{e.userEmail}</div></td>
        <td><Badge tone={tone(e.action)}>{actionText(e.action)}</Badge></td>
        <td className="a-small" style={{ maxWidth: 320 }}><span className="a-ellipsis" style={{ display: "block" }}>{targetText(e.target)}</span></td>
        <td className="a-small a-muted">{e.ip || ""}</td>
      </tr>
      {open && e.details && <tr><td colSpan={5}><pre className="a-json">{JSON.stringify(e.details, null, 2)}</pre></td></tr>}
    </>
  );
}
