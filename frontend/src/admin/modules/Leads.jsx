import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, download } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { Badge, Button, Card, Empty, ErrorBox, Field, I, IconButton, Input, PageHead, Select, Spinner, Textarea, fmtDate, timeAgo, useConfirm, useLoad, useToast } from "../ui.jsx";
import { Attribution, sourceOf } from "./Submissions.jsx";

// ---------------------------------------------------------------------------
// Leads: one record per person (deduplicated by email / phone), with every
// submission, attribution, status pipeline, owner, tags and notes.
// ---------------------------------------------------------------------------

const STATUS = { new: ["New", "violet"], contacted: ["Contacted", "blue"], qualified: ["Qualified", "amber"], won: ["Won", "green"], lost: ["Lost", "red"], closed: ["Closed", "gray"] };
const statusOptions = Object.entries(STATUS).map(([value, [label]]) => ({ value, label }));

export default function Leads() {
  const { can } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState({ status: "", source: "", q: "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const [data, { loading, error, reload, setData }] = useLoad(() => api(`/api/admin/leads?${qs}`), [qs]);
  const openId = params.get("lead");
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const patchLead = async (id, body) => {
    try {
      const r = await api(`/api/admin/leads/${id}`, { method: "PATCH", body });
      setData((d) => (d ? { ...d, leads: d.leads.map((l) => (l.id === id ? r.lead : l)) } : d));
      return r.lead;
    } catch (e) { toast(e.message, { tone: "error" }); return null; }
  };
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="a-page">
      <PageHead title="Leads" subtitle="People who contacted you through website forms or the chat. Duplicates are merged by email or phone." actions={can("leads.export") && <Button icon="download" onClick={() => download(`/api/admin/leads/export.csv?${qs}`, "leads.csv").catch((e) => toast(e.message, { tone: "error" }))}>Export CSV</Button>} />
      <div className="a-tabs">
        <button type="button" className={!f.status ? "active" : ""} onClick={() => set({ status: "" })}>All <span className="a-tab-badge">{total}</span></button>
        {Object.entries(STATUS).map(([k, [label]]) => <button key={k} type="button" className={f.status === k ? "active" : ""} onClick={() => set({ status: k })}>{label} {data?.counts?.[k] ? <span className="a-tab-badge">{data.counts[k]}</span> : null}</button>)}
      </div>
      <div className="m-toolbar">
        <Input className="m-search" value={f.q} onChange={(v) => set({ q: v })} placeholder="Search name, email, phone, organisation, tag…" />
        <Select value={f.source} onChange={(v) => set({ source: v })} options={[{ value: "", label: "All sources" }, ...(data?.sources || []).map((s) => ({ value: s, label: s }))]} />
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data && <Spinner />}
      {data && (
        <Card pad={false}>
          {!data.leads.length ? <Empty icon="users" title="No leads here" text="Form submissions and chat bookings create leads automatically." /> : (
            <div className="a-table-wrap">
              <table className="a-table">
                <thead><tr><th>Lead</th><th>Status</th><th>Source</th><th>Forms</th><th>Owner</th><th>Last activity</th></tr></thead>
                <tbody>
                  {data.leads.map((l) => (
                    <tr key={l.id} className="clickable" onClick={() => setParams({ lead: l.id })}>
                      <td><strong>{l.name || l.email || l.phone}</strong><div className="a-small a-muted">{[l.email, l.phone, l.organization].filter(Boolean).join(" · ")}</div>{l.tags?.length > 0 && <div className="a-row" style={{ gap: 4, marginTop: 3 }}>{l.tags.map((t) => <Badge key={t} tone="gray">#{t}</Badge>)}</div>}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {can("leads.edit")
                          ? <Select value={l.status} onChange={(v) => patchLead(l.id, { status: v })} options={statusOptions} style={{ width: 130, height: 32, padding: "4px 28px 4px 10px" }} />
                          : <Badge tone={STATUS[l.status]?.[1]}>{STATUS[l.status]?.[0] || l.status}</Badge>}
                      </td>
                      <td className="a-small">{l.source || "direct"}{l.landingPage ? <div className="a-muted">{l.landingPage}</div> : null}</td>
                      <td className="a-small">{(l.forms || []).join(", ")}<div className="a-muted">{(l.submissions || []).length} submission(s)</div></td>
                      <td className="a-small">{l.owner?.name || <span className="a-muted">-</span>}</td>
                      <td className="a-small">{timeAgo(l.lastActivityAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {openId && <LeadDrawer id={openId} onClose={() => setParams({})} onPatched={patchLead} onDeleted={() => { setParams({}); reload(); }} />}
    </div>
  );
}

function LeadDrawer({ id, onClose, onPatched, onDeleted }) {
  const { can, me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [d, { loading, error, reload, setData }] = useLoad(() => api(`/api/admin/leads/${id}`), [id]);
  const [users] = useLoad(() => (can("users.manage") ? api("/api/admin/users").then((r) => r.users.filter((u) => u.active)) : Promise.resolve(null)), []);
  const [note, setNote] = useState("");
  const [contact, setContact] = useState(null);
  const [tags, setTags] = useState("");
  useEffect(() => {
    if (d?.lead) { setContact({ name: d.lead.name || "", phone: d.lead.phone || "", organization: d.lead.organization || "" }); setTags((d.lead.tags || []).join(", ")); }
  }, [d?.lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const onKey = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  const edit = can("leads.edit");
  const patch = async (body) => { const lead = await onPatched(id, body); if (lead) setData((x) => ({ ...x, lead })); return lead; };
  const l = d?.lead;
  return (
    <>
      <div className="a-drawer-back" onClick={onClose} />
      <aside className="a-drawer" role="dialog" aria-label="Lead details">
        <header className="a-drawer-head">
          <span className="a-avatar">{(l?.name || l?.email || "?").slice(0, 1).toUpperCase()}</span>
          <h2>{l ? l.name || l.email : "Lead"}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="a-drawer-body">
          {loading && !d && <Spinner />}
          <ErrorBox error={error} onRetry={reload} />
          {l && (
            <>
              <div className="a-row">
                {edit ? <Select value={l.status} onChange={(v) => patch({ status: v })} options={statusOptions} style={{ width: 150 }} /> : <Badge tone={STATUS[l.status]?.[1]}>{STATUS[l.status]?.[0]}</Badge>}
                {l.email && <a className="a-btn a-btn-sm" href={`mailto:${l.email}`}><I n="mail" size={14} /> Email</a>}
                {l.phone && <a className="a-btn a-btn-sm" href={`tel:${l.phone.replace(/[^+\d]/g, "")}`}><I n="phone" size={14} /> Call</a>}
                {l.phone && <a className="a-btn a-btn-sm" href={`https://wa.me/${l.phone.replace(/\D/g, "").replace(/^0/, "91")}`} target="_blank" rel="noopener noreferrer"><I n="whatsapp" size={14} /> WhatsApp</a>}
              </div>
              <dl className="m-kv">
                <dt>Email</dt><dd>{l.email || "-"}</dd>
                <dt>Source</dt><dd>{l.source || "direct"}</dd>
                <dt>Landing page</dt><dd>{l.landingPage || "-"}</dd>
                <dt>First contact</dt><dd>{fmtDate(l.createdAt)}</dd>
                <dt>Last activity</dt><dd>{fmtDate(l.lastActivityAt)}</dd>
              </dl>
              {edit && contact && (
                <div className="a-stack tight">
                  <div className="a-grid-2">
                    <Field label="Name"><Input value={contact.name} onChange={(v) => setContact((c) => ({ ...c, name: v }))} onBlur={() => contact.name !== (l.name || "") && patch({ name: contact.name })} /></Field>
                    <Field label="Phone"><Input value={contact.phone} onChange={(v) => setContact((c) => ({ ...c, phone: v }))} onBlur={() => contact.phone !== (l.phone || "") && patch({ phone: contact.phone })} /></Field>
                  </div>
                  <Field label="Organisation"><Input value={contact.organization} onChange={(v) => setContact((c) => ({ ...c, organization: v }))} onBlur={() => contact.organization !== (l.organization || "") && patch({ organization: contact.organization })} /></Field>
                  <Field label="Tags (comma separated)"><Input value={tags} onChange={setTags} onBlur={() => patch({ tags: tags.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="hot, 200-beds, delhi" /></Field>
                  <Field label="Owner">
                    <div className="a-row">
                      <span>{l.owner?.name || <span className="a-muted">Unassigned</span>}</span>
                      {l.owner?.id !== me.id && <Button size="sm" onClick={() => patch({ owner: { id: me.id, name: me.name } })}>Assign to me</Button>}
                      {users && <Select value={l.owner?.id || ""} onChange={(v) => { const u = users.find((x) => x.id === v); patch({ owner: u ? { id: u.id, name: u.name } : null }); }} options={[{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: u.id, label: u.name }))]} style={{ width: 180 }} />}
                      {l.owner && !users && <Button size="sm" variant="ghost" onClick={() => patch({ owner: null })}>Unassign</Button>}
                    </div>
                  </Field>
                </div>
              )}
              <div>
                <div className="a-section-title">Notes</div>
                {edit && (
                  <div className="a-stack tight" style={{ marginBottom: 10 }}>
                    <Textarea rows={2} value={note} onChange={setNote} placeholder="Call summary, next steps…" />
                    <Button size="sm" variant="primary" disabled={!note.trim()} onClick={async () => { if (await patch({ note: note.trim() })) { setNote(""); toast("Note added"); } }}>Add note</Button>
                  </div>
                )}
                {!(l.notes || []).length && <p className="a-muted a-small">No notes yet.</p>}
                <div className="a-stack tight">{(l.notes || []).slice().reverse().map((n) => <div key={n.id} className="a-note"><small>{n.by} · {fmtDate(n.at)}</small>{n.text}</div>)}</div>
              </div>
              <div>
                <div className="a-section-title">Submissions ({d.submissions.length})</div>
                <div className="a-stack">
                  {d.submissions.map((s) => (
                    <div key={s.id} className="a-rowcard">
                      <div className="a-row between"><Badge tone="violet">{s.formName || s.formId}</Badge><span className="a-small a-muted">{fmtDate(s.receivedAt)}</span></div>
                      {s.values && <dl className="m-kv" style={{ marginTop: 8 }}>{Object.entries(s.values).map(([k, v]) => <Row key={k} k={k} v={Array.isArray(v) ? v.join(", ") : String(v)} />)}</dl>}
                      <div className="a-small a-muted" style={{ marginTop: 6 }}>Source: {sourceOf(s.context)}</div>
                      <details style={{ marginTop: 4 }}><summary className="a-small" style={{ cursor: "pointer" }}>Attribution details</summary><Attribution ctx={s.context} /></details>
                    </div>
                  ))}
                </div>
              </div>
              {can("leads.delete") && (
                <Button variant="danger" icon="trash" onClick={async () => {
                  if (!(await confirm({ title: "Delete this lead?", message: "The lead AND all their form submissions are erased permanently (for data-protection requests). This cannot be undone.", confirmLabel: "Delete permanently", danger: true }))) return;
                  try { await api(`/api/admin/leads/${id}`, { method: "DELETE" }); toast("Lead deleted"); onDeleted(); } catch (e) { toast(e.message, { tone: "error" }); }
                }}>Delete lead &amp; data</Button>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
const Row = ({ k, v }) => (<><dt>{k}</dt><dd>{v}</dd></>);
