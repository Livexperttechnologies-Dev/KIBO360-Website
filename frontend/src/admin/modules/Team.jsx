import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { Alert, Badge, Button, Card, Check, CopyButton, ErrorBox, Field, IconButton, Input, Modal, PageHead, Select, Spinner, Toggle, timeAgo, useConfirm, useLoad, usePrompt, useToast } from "../ui.jsx";

// ---------------------------------------------------------------------------
// Team access: invite colleagues, assign roles, deactivate, reset passwords.
// ---------------------------------------------------------------------------

export function tempPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const d = "23456789";
  const r = crypto.getRandomValues(new Uint32Array(12));
  let s = "";
  for (let i = 0; i < 10; i++) s += a[r[i] % a.length];
  return `${s}${d[r[10] % d.length]}${d[r[11] % d.length]}`;
}

export default function Team() {
  const { can, me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [users, { loading, error, reload }] = useLoad(() => api("/api/admin/users").then((r) => r.users), []);
  const [roles] = useLoad(() => api("/api/admin/roles"), []);
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState(null);
  const patch = async (u, body, msg) => {
    try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", body }); if (msg) toast(msg); reload(); } catch (e) { toast(e.message, { tone: "error" }); }
  };
  const roleOptions = (roles?.roles || []).filter((r) => r.id !== "superadmin").map((r) => ({ value: r.id, label: r.name }));
  return (
    <div className="a-page">
      <PageHead title="Team Access" subtitle="Who can sign in to Super Admin and what they can do. Editing and publishing are separate permissions." actions={<Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Add team member</Button>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !users && <Spinner />}
      {shown && <Alert tone="ok"><strong>Temporary password for {shown.email}:</strong> <code>{shown.pw}</code> <CopyButton text={shown.pw} /> <div className="a-small">Share it privately. They must choose their own password at first sign-in. It won't be shown again.</div></Alert>}
      {users && (
        <Card pad={false}>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong>{u.id === me.id && <Badge tone="violet">you</Badge>}<div className="a-small a-muted">{u.email}</div></td>
                    <td>
                      {u.isSuperAdmin ? <Badge tone="violet">Super Admin</Badge> : (
                        <Select value={u.roleId} onChange={(v) => patch(u, { roleId: v }, "Role updated")} options={roleOptions} style={{ width: 190 }} />
                      )}
                      {u.extraPermissions?.length > 0 && <div className="a-small a-muted">+{u.extraPermissions.length} extra permission(s)</div>}
                    </td>
                    <td>{u.isSuperAdmin || u.id === me.id ? <Badge tone="green">active</Badge> : <Toggle checked={u.active} onChange={(v) => patch(u, { active: v }, v ? "Access restored" : "Access removed - they are signed out")} label={u.active ? "Active" : "Deactivated"} />}{u.mustChangePassword && <div className="a-small a-muted">must set password</div>}</td>
                    <td className="a-small">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "never"}</td>
                    <td className="actions">
                      {!u.isSuperAdmin && (
                        <div className="a-row nowrap" style={{ justifyContent: "flex-end" }}>
                          <Button size="sm" onClick={async () => {
                            const pw = await prompt({ title: `Reset password for ${u.email}`, label: "Temporary password", value: tempPassword(), hint: "At least 10 characters with letters and numbers. They'll be asked to change it.", required: true, confirmLabel: "Reset password" });
                            if (!pw) return;
                            try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { password: pw } }); setShown({ email: u.email, pw }); toast("Password reset - their other sessions were signed out"); } catch (e) { toast(e.message, { tone: "error" }); }
                          }}>Reset password</Button>
                          {u.id !== me.id && <IconButton icon="trash" className="danger" label="Remove member" onClick={async () => {
                            if (!(await confirm({ title: `Remove ${u.name}?`, message: "Their account is deleted and they are signed out everywhere. Their past changes stay in the history.", danger: true, confirmLabel: "Remove" }))) return;
                            try { await api(`/api/admin/users/${u.id}`, { method: "DELETE" }); toast("Member removed"); reload(); } catch (e) { toast(e.message, { tone: "error" }); }
                          }} />}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {adding && roles && <AddMember roles={roles} canExtra={can("roles.manage")} onClose={() => setAdding(false)} onDone={(u, pw) => { setAdding(false); setShown({ email: u.email, pw }); reload(); }} />}
    </div>
  );
}

function AddMember({ roles, canExtra, onClose, onDone }) {
  const [f, setF] = useState({ email: "", name: "", password: tempPassword(), roleId: "content_manager", extraPermissions: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const role = roles.roles.find((r) => r.id === f.roleId);
  const groups = [...new Set(roles.permissions.map((p) => p.group))];
  const submit = async () => {
    setBusy(true); setError(null);
    try { const r = await api("/api/admin/users", { method: "POST", body: f }); onDone(r.user, f.password); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add team member" onClose={onClose} width={640} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} onClick={submit}>Add member</Button></>}>
      <div className="a-grid-2">
        <Field label="Email"><Input type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} autoComplete="off" /></Field>
        <Field label="Name"><Input value={f.name} onChange={(v) => setF({ ...f, name: v })} /></Field>
      </div>
      <Field label="Temporary password" hint="They must change it when they first sign in."><div className="a-input-group"><Input value={f.password} onChange={(v) => setF({ ...f, password: v })} className="mono" /><Button onClick={() => setF({ ...f, password: tempPassword() })}>New</Button></div></Field>
      <Field label="Role" hint={role?.description}>
        <Select value={f.roleId} onChange={(v) => setF({ ...f, roleId: v })} options={roles.roles.filter((r) => r.id !== "superadmin").map((r) => ({ value: r.id, label: r.name }))} />
      </Field>
      {canExtra && (
        <details>
          <summary className="a-label" style={{ cursor: "pointer" }}>Extra permissions on top of the role (optional)</summary>
          <div className="a-perm-grid" style={{ marginTop: 10 }}>
            {groups.map((g) => (
              <div key={g} className="a-perm-group"><h4>{g}</h4>
                {roles.permissions.filter((p) => p.group === g).map((p) => {
                  const inRole = role?.permissions.includes(p.key);
                  return <Check key={p.key} checked={inRole || f.extraPermissions.includes(p.key)} disabled={inRole || ["users.manage", "roles.manage"].includes(p.key)} onChange={(v) => setF({ ...f, extraPermissions: v ? [...f.extraPermissions, p.key] : f.extraPermissions.filter((x) => x !== p.key) })} label={p.label} />;
                })}
              </div>
            ))}
          </div>
        </details>
      )}
      {error && <Alert tone="error">{error.message}</Alert>}
    </Modal>
  );
}
