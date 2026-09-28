import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { Alert, Badge, Button, Card, Field, Input, PageHead, fmtDate } from "../ui.jsx";

// ---------------------------------------------------------------------------
// My account: profile, permissions, password.
// ---------------------------------------------------------------------------

export default function Account() {
  const { me, signOut } = useAuth();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const change = async (e) => {
    e.preventDefault();
    if (next !== again) { setMsg({ tone: "error", text: "The new passwords don't match" }); return; }
    setBusy(true); setMsg(null);
    try {
      await api("/api/admin/password", { method: "POST", body: { current: cur, next } });
      setCur(""); setNext(""); setAgain("");
      setMsg({ tone: "ok", text: "Password changed. Other devices were signed out." });
    } catch (err) { setMsg({ tone: "error", text: err.message }); } finally { setBusy(false); }
  };
  return (
    <div className="a-page">
      <PageHead title="My Account" actions={<Button icon="logout" onClick={signOut}>Sign out</Button>} />
      <div className="a-two">
        <Card title={me.name} subtitle={me.email}>
          <dl className="m-kv">
            <dt>Role</dt><dd>{me.roleName}</dd>
            <dt>Member since</dt><dd>{fmtDate(me.createdAt)}</dd>
            <dt>Last sign-in</dt><dd>{fmtDate(me.lastLoginAt)}</dd>
          </dl>
          <div className="a-section-title">What you can do</div>
          <div className="a-row" style={{ gap: 4 }}>{me.permissions.map((p) => <Badge key={p} tone={/publish/.test(p) ? "amber" : "gray"}>{p}</Badge>)}</div>
        </Card>
        <Card title="Change password" subtitle="At least 10 characters, with letters and numbers.">
          <form className="a-stack" onSubmit={change}>
            <Field label="Current password"><Input type="password" value={cur} onChange={setCur} autoComplete="current-password" required /></Field>
            <Field label="New password"><Input type="password" value={next} onChange={setNext} autoComplete="new-password" required /></Field>
            <Field label="Repeat new password"><Input type="password" value={again} onChange={setAgain} autoComplete="new-password" required /></Field>
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <div><Button type="submit" variant="primary" busy={busy}>Change password</Button></div>
          </form>
        </Card>
      </div>
    </div>
  );
}
