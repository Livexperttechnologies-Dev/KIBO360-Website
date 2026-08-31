import { useCallback, useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";

// ---------------------------------------------------------------------------
// KIBO360 Admin - leads, WhatsApp / chatbot / email-notification settings and
// user management. Super admin: livexperttechnologies@gmail.com (can create
// users and grant per-section access). Not linked from the public site.
// ---------------------------------------------------------------------------

const TOKEN_KEY = "kibo360-admin-token";
const USER_KEY = "kibo360-admin-user";

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const PERMISSION_LABELS = {
  leads: "Leads & Forms",
  whatsapp: "WhatsApp Setup",
  chatbot: "Chatbot Setup",
  notifications: "Email Notifications",
};

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  });
  const [tab, setTab] = useState("leads");
  const [flash, setFlash] = useState("");

  useEffect(() => { document.title = "KIBO360 Admin"; }, []);
  const notify = (msg) => { setFlash(msg); setTimeout(() => setFlash(""), 3500); };

  const signOut = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(""); setUser(null);
  };

  if (!token || !user) {
    return <Login onSignedIn={(t, u) => {
      sessionStorage.setItem(TOKEN_KEY, t);
      sessionStorage.setItem(USER_KEY, JSON.stringify(u));
      setToken(t); setUser(u);
      setTab(u.role === "superadmin" || u.permissions?.leads ? "leads" : Object.keys(u.permissions || {}).find((k) => u.permissions[k]) || "security");
    }} />;
  }

  const can = (perm) => user.role === "superadmin" || !!user.permissions?.[perm];
  const tabs = [
    can("leads") && { id: "leads", label: "Leads" },
    can("whatsapp") && { id: "whatsapp", label: "WhatsApp" },
    can("chatbot") && { id: "chatbot", label: "Chatbot" },
    can("notifications") && { id: "notifications", label: "Email" },
    user.role === "superadmin" && { id: "users", label: "Users" },
    { id: "security", label: "My Account" },
  ].filter(Boolean);

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <img src="/kibo360-logo.png" alt="KIBO360" height="38" />
        <span className="admin-title">Admin Console</span>
        <div className="admin-me">
          <strong>{user.name}</strong>
          <span>{user.role === "superadmin" ? "Super Admin" : "Admin"}</span>
        </div>
        <button type="button" className="btn btn-outline" onClick={signOut}>Sign Out</button>
      </header>

      <nav className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {flash && <div className="admin-flash">{flash}</div>}

      <main className="admin-main">
        {tab === "leads" && can("leads") && <LeadsTab token={token} notify={notify} />}
        {tab === "whatsapp" && can("whatsapp") && <SettingsTab token={token} notify={notify} section="whatsapp" />}
        {tab === "chatbot" && can("chatbot") && <SettingsTab token={token} notify={notify} section="chatbot" />}
        {tab === "notifications" && can("notifications") && <SettingsTab token={token} notify={notify} section="notifications" />}
        {tab === "users" && user.role === "superadmin" && <UsersTab token={token} notify={notify} />}
        {tab === "security" && <SecurityTab token={token} notify={notify} />}
      </main>
    </div>
  );
}

function Login({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api("/api/admin/login", { method: "POST", body: { email, password } });
      onSignedIn(d.token, d.user);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <img src="/kibo360-logo.png" alt="KIBO360" height="44" />
        <h1>Admin Console</h1>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}

function LeadsTab({ token, notify }) {
  const [leads, setLeads] = useState(null);
  const load = useCallback(() => {
    api("/api/admin/leads", { token }).then((d) => setLeads(d.leads)).catch((e) => notify(e.message));
  }, [token, notify]);
  useEffect(load, [load]);

  const setStatus = (id, status) =>
    api(`/api/admin/leads/${id}`, { method: "PATCH", body: { status }, token })
      .then(load).catch((e) => notify(e.message));
  const remove = (id) => {
    if (!window.confirm("Delete this lead permanently?")) return;
    api(`/api/admin/leads/${id}`, { method: "DELETE", token }).then(load).catch((e) => notify(e.message));
  };

  if (!leads) return <p>Loading leads…</p>;
  if (leads.length === 0) return <p>No leads yet. Form submissions from the website will appear here.</p>;

  return (
    <div className="admin-card">
      <h2>Leads &amp; Form Submissions ({leads.length})</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Received</th><th>Name</th><th>Contact</th><th>Interest</th><th>Message</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className={`lead-${l.status || "new"}`}>
                <td>{new Date(l.receivedAt).toLocaleString()}</td>
                <td><strong>{l.name}</strong>{l.organization ? <div className="muted">{l.organization}</div> : null}</td>
                <td><a href={`mailto:${l.email}`}>{l.email}</a>{l.phone ? <div className="muted">{l.phone}</div> : null}</td>
                <td>{l.product}</td>
                <td className="lead-msg">{l.message}</td>
                <td>
                  <select value={l.status || "new"} onChange={(e) => setStatus(l.id, e.target.value)}>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>
                </td>
                <td>
                  <button type="button" className="admin-del" aria-label="Delete lead" onClick={() => remove(l.id)}>
                    <Icon name="close" size={14} strokeWidth={2.4} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab({ token, notify, section }) {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    api("/api/admin/settings", { token }).then((d) => setSettings(d.settings)).catch((e) => notify(e.message));
  }, [token, notify]);

  if (!settings) return <p>Loading settings…</p>;
  const value = settings[section];
  const update = (patch) => setSettings({ ...settings, [section]: { ...value, ...patch } });
  const save = () =>
    api("/api/admin/settings", { method: "PUT", body: { [section]: value }, token })
      .then(() => notify("Saved. The website picks this up immediately."))
      .catch((e) => notify(e.message));

  if (section === "whatsapp") {
    return (
      <div className="admin-card">
        <h2>WhatsApp Support</h2>
        <label className="admin-check">
          <input type="checkbox" checked={!!value.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
          Show the WhatsApp button on the website
        </label>
        <label>
          WhatsApp number (digits only, with country code)
          <input value={value.number} onChange={(e) => update({ number: e.target.value.replace(/\D/g, "") })} placeholder="918008005672" />
        </label>
        <label>
          Pre-filled visitor message
          <textarea rows="2" value={value.greeting} onChange={(e) => update({ greeting: e.target.value })} />
        </label>
        <button type="button" className="btn btn-primary" onClick={save}>Save WhatsApp Settings</button>
      </div>
    );
  }

  if (section === "chatbot") {
    const faqs = value.customFaqs || [];
    const setFaq = (i, patch) => update({ customFaqs: faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
    return (
      <div className="admin-card">
        <h2>Chatbot</h2>
        <label className="admin-check">
          <input type="checkbox" checked={!!value.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
          Show the chatbot on the website
        </label>
        <label>Bot name<input value={value.botName} onChange={(e) => update({ botName: e.target.value })} /></label>
        <label>Welcome message<textarea rows="2" value={value.welcome} onChange={(e) => update({ welcome: e.target.value })} /></label>
        <h3>Custom Q&amp;A</h3>
        <p className="muted">The bot already answers questions about products, demos, pricing, contact and certifications. Add your own answers here - matched when a visitor's message contains any keyword.</p>
        {faqs.map((f, i) => (
          <div key={i} className="admin-faq-row">
            <input placeholder="Keywords (comma separated)" value={f.keywords || ""} onChange={(e) => setFaq(i, { keywords: e.target.value })} />
            <textarea rows="2" placeholder="Answer" value={f.a || ""} onChange={(e) => setFaq(i, { a: e.target.value })} />
            <button type="button" className="admin-del" onClick={() => update({ customFaqs: faqs.filter((_, j) => j !== i) })}>
              <Icon name="close" size={14} strokeWidth={2.4} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-outline" onClick={() => update({ customFaqs: [...faqs, { keywords: "", a: "" }] })}>
          + Add Q&amp;A
        </button>
        <div><button type="button" className="btn btn-primary" onClick={save} style={{ marginTop: 16 }}>Save Chatbot Settings</button></div>
      </div>
    );
  }

  // notifications
  const smtp = value.smtp || {};
  const setSmtp = (patch) => update({ smtp: { ...smtp, ...patch } });
  return (
    <div className="admin-card">
      <h2>Email Notifications</h2>
      <h3>SMTP (sending account)</h3>
      <div className="admin-grid-2">
        <label>Host<input value={smtp.host} onChange={(e) => setSmtp({ host: e.target.value })} placeholder="smtp.gmail.com" /></label>
        <label>Port<input value={smtp.port} onChange={(e) => setSmtp({ port: e.target.value })} placeholder="587" /></label>
        <label>Username<input value={smtp.user} onChange={(e) => setSmtp({ user: e.target.value })} placeholder="notifications@yourdomain.com" /></label>
        <label>Password / App password<input type="password" value={smtp.pass} onChange={(e) => setSmtp({ pass: e.target.value })} /></label>
      </div>
      <label>From address (optional)<input value={smtp.from} onChange={(e) => setSmtp({ from: e.target.value })} placeholder="KIBO360 <no-reply@kibo360.in>" /></label>

      <h3>Internal team</h3>
      <label className="admin-check">
        <input type="checkbox" checked={!!value.notifyTeam} onChange={(e) => update({ notifyTeam: e.target.checked })} />
        Email the team when a new lead arrives
      </label>
      <label>
        Team emails (comma separated)
        <input
          value={(value.teamEmails || []).join(", ")}
          onChange={(e) => update({ teamEmails: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </label>

      <h3>Visitor auto-reply</h3>
      <label className="admin-check">
        <input type="checkbox" checked={!!value.visitorAutoReply} onChange={(e) => update({ visitorAutoReply: e.target.checked })} />
        Send visitors a confirmation email after they submit a form
      </label>
      <label>Subject<input value={value.visitorSubject} onChange={(e) => update({ visitorSubject: e.target.value })} /></label>
      <label>Message (use {"{name}"} for the visitor's name)
        <textarea rows="4" value={value.visitorMessage} onChange={(e) => update({ visitorMessage: e.target.value })} />
      </label>
      <button type="button" className="btn btn-primary" onClick={save}>Save Email Settings</button>
    </div>
  );
}

function UsersTab({ token, notify }) {
  const [users, setUsers] = useState(null);
  const [draft, setDraft] = useState({ email: "", name: "", password: "", permissions: {} });
  const load = useCallback(() => {
    api("/api/admin/users", { token }).then((d) => setUsers(d.users)).catch((e) => notify(e.message));
  }, [token, notify]);
  useEffect(load, [load]);

  const create = () =>
    api("/api/admin/users", { method: "POST", body: draft, token })
      .then(() => { setDraft({ email: "", name: "", password: "", permissions: {} }); load(); notify("User created."); })
      .catch((e) => notify(e.message));
  const togglePerm = (u, key) =>
    api(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      body: { permissions: { ...u.permissions, [key]: !u.permissions[key] } },
      token,
    }).then(load).catch((e) => notify(e.message));
  const remove = (u) => {
    if (!window.confirm(`Remove access for ${u.email}?`)) return;
    api(`/api/admin/users/${u.id}`, { method: "DELETE", token }).then(load).catch((e) => notify(e.message));
  };

  if (!users) return <p>Loading users…</p>;
  return (
    <div className="admin-card">
      <h2>Users &amp; Access</h2>
      <p className="muted">The super admin ({users.find((u) => u.role === "superadmin")?.email}) always has full access and cannot be removed.</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>User</th>{Object.values(PERMISSION_LABELS).map((l) => <th key={l}>{l}</th>)}<th /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong><div className="muted">{u.email}{u.role === "superadmin" ? " · Super Admin" : ""}</div></td>
                {Object.keys(PERMISSION_LABELS).map((key) => (
                  <td key={key} style={{ textAlign: "center" }}>
                    {u.role === "superadmin" ? (
                      <Icon name="check" size={15} strokeWidth={2.4} />
                    ) : (
                      <input type="checkbox" checked={!!u.permissions?.[key]} onChange={() => togglePerm(u, key)} />
                    )}
                  </td>
                ))}
                <td>
                  {u.role !== "superadmin" && (
                    <button type="button" className="admin-del" aria-label="Remove user" onClick={() => remove(u)}>
                      <Icon name="close" size={14} strokeWidth={2.4} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Add a user</h3>
      <div className="admin-grid-2">
        <label>Email<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
        <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Password (min 8 chars)<input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /></label>
      </div>
      <div className="admin-perms">
        {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
          <label key={key} className="admin-check">
            <input
              type="checkbox"
              checked={!!draft.permissions[key]}
              onChange={(e) => setDraft({ ...draft, permissions: { ...draft.permissions, [key]: e.target.checked } })}
            />
            {label}
          </label>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={create}>Create User</button>
    </div>
  );
}

function SecurityTab({ token, notify }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = () =>
    api("/api/admin/password", { method: "POST", body: { current, next }, token })
      .then(() => { setCurrent(""); setNext(""); notify("Password changed."); })
      .catch((e) => notify(e.message));
  return (
    <div className="admin-card" style={{ maxWidth: 460 }}>
      <h2>My Account</h2>
      <label>Current password<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
      <label>New password (min 8 chars)<input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
      <button type="button" className="btn btn-primary" onClick={change}>Change Password</button>
    </div>
  );
}
