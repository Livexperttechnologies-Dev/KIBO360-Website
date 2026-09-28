import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { Alert, Badge, Button, Card, Check, ErrorBox, Field, Input, PageHead, Spinner, Textarea, useConfirm, useLoad, usePrompt, useToast } from "../ui.jsx";

// ---------------------------------------------------------------------------
// Roles & permissions. Built-in roles can be adjusted (except Super Admin);
// custom roles can be created for anything in between.
// ---------------------------------------------------------------------------

export default function Roles() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [data, { loading, error, reload }] = useLoad(() => api("/api/admin/roles"), []);
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const edit = can("roles.manage");
  if (loading && !data) return <div className="a-page"><Spinner /></div>;
  if (error) return <div className="a-page"><ErrorBox error={error} onRetry={reload} /></div>;
  const role = data.roles.find((r) => r.id === (sel || data.roles[1]?.id)) || data.roles[0];
  const d = draft && draft.id === role.id ? draft : role;
  const groups = [...new Set(data.permissions.map((p) => p.group))];
  const dirty = draft && draft.id === role.id && (draft.name !== role.name || draft.description !== role.description || [...draft.permissions].sort().join() !== [...role.permissions].sort().join());
  const toggle = (key, v) => setDraft({ ...d, permissions: v ? [...d.permissions, key] : d.permissions.filter((x) => x !== key) });
  const save = async () => {
    setBusy(true);
    try { await api(`/api/admin/roles/${role.id}`, { method: "PATCH", body: { name: d.name, description: d.description, permissions: d.permissions } }); toast("Role saved - applies immediately to everyone with this role"); setDraft(null); reload(); } catch (e) { toast(e.message, { tone: "error" }); } finally { setBusy(false); }
  };
  return (
    <div className="a-page">
      <PageHead title="Roles & Permissions" subtitle="Each team member has one role. Permissions are checked on the server for every action." actions={edit && <Button variant="primary" icon="plus" onClick={async () => {
        const name = await prompt({ title: "New role", label: "Role name", placeholder: "e.g. Product Marketing", required: true, confirmLabel: "Create" });
        if (!name) return;
        try { const r = await api("/api/admin/roles", { method: "POST", body: { name, description: "", permissions: ["dashboard.view", "pages.view"] } }); await reload(); setSel(r.role.id); toast("Role created"); } catch (e) { toast(e.message, { tone: "error" }); }
      }}>New role</Button>} />
      <div className="a-split">
        <div className="a-card" style={{ padding: 8 }}>
          <div className="a-side-list">
            {data.roles.map((r) => (
              <button key={r.id} type="button" className={`a-side-item ${r.id === role.id ? "active" : ""}`} onClick={() => { setSel(r.id); setDraft(null); }}>
                <span style={{ flex: 1 }}>{r.name}<small className="a-muted" style={{ display: "block" }}>{r.permissions.length} permissions · {r.userCount} member(s)</small></span>
                {r.locked ? <Badge tone="violet">locked</Badge> : r.builtin ? <Badge tone="gray">built-in</Badge> : null}
              </button>
            ))}
          </div>
        </div>
        <Card title={d.name} subtitle={d.description} actions={edit && !role.locked && (
          <>
            {!role.builtin && <Button size="sm" variant="danger" onClick={async () => {
              if (!(await confirm({ title: `Delete the ${role.name} role?`, danger: true, confirmLabel: "Delete" }))) return;
              try { await api(`/api/admin/roles/${role.id}`, { method: "DELETE" }); setSel(null); reload(); toast("Role deleted"); } catch (e) { toast(e.message, { tone: "error" }); }
            }}>Delete</Button>}
            <Button size="sm" variant="primary" busy={busy} disabled={!dirty} onClick={save}>Save changes</Button>
          </>
        )}>
          {role.locked && <Alert tone="info">The Super Admin role always has every permission and belongs only to the owner account.</Alert>}
          {edit && !role.locked && (
            <div className="a-grid-2" style={{ marginBottom: 14 }}>
              <Field label="Name"><Input value={d.name} onChange={(v) => setDraft({ ...d, name: v })} /></Field>
              <Field label="Description"><Textarea rows={1} value={d.description} onChange={(v) => setDraft({ ...d, description: v })} /></Field>
            </div>
          )}
          <div className="a-perm-grid">
            {groups.map((g) => (
              <div key={g} className="a-perm-group">
                <h4>{g}</h4>
                {data.permissions.filter((p) => p.group === g).map((p) => (
                  <Check key={p.key} checked={d.permissions.includes(p.key)} disabled={!edit || role.locked} onChange={(v) => toggle(p.key, v)} label={<>{p.label}{/publish/.test(p.key) && <Badge tone="amber">publish</Badge>}</>} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
