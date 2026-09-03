import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { API_BASE } from "../lib/apiBase.js";

// ---------------------------------------------------------------------------
// KIBO360 Admin - leads, WhatsApp / chatbot / email-notification settings and
// user management. Super admin: livexperttechnologies@gmail.com (can create
// users and grant per-section access). Not linked from the public site.
// ---------------------------------------------------------------------------

const TOKEN_KEY = "kibo360-admin-token";
const USER_KEY = "kibo360-admin-user";

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    // Session expired (or the backend restarted - sessions are in-memory).
    // Drop the stale token and show the login screen instead of a broken UI.
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.location.reload();
    throw new Error("Session expired - please sign in again");
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const PERMISSION_LABELS = {
  leads: "Leads & Forms",
  chats: "Live Chat",
  whatsapp: "WhatsApp Setup",
  chatbot: "Chatbot Setup",
  notifications: "Email Notifications",
};

// Clear two-tone alert via WebAudio (no asset needed); no-ops if blocked.
function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = playBeep.ctx || (playBeep.ctx = new Ctx());
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const tone = (freq, startIn, dur) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + startIn;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    tone(880, 0, 0.3);       // A5
    tone(1318.5, 0.18, 0.4); // E6 - rising "ding-ding" that cuts through
  } catch { /* audio unavailable */ }
}

function notifyBrowser(text) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("KIBO360 Admin", { body: text });
    }
  } catch { /* ignore */ }
}

const timeAgo = (iso) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  });
  const [tab, setTab] = useState(() => {
    // First tab the (restored) user can actually see
    try {
      const u = JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
      if (!u) return "leads";
      if (u.role === "superadmin" || u.permissions?.leads) return "leads";
      return Object.keys(u.permissions || {}).find((k) => u.permissions[k]) || "security";
    } catch { return "leads"; }
  });
  const [flash, setFlash] = useState("");
  const [summary, setSummary] = useState(null); // { unreadTotal, presenceCount }
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem("kibo360-admin-sound") !== "off"; } catch { return true; }
  });
  const soundRef = useRef(true);
  const prevRef = useRef({ first: true, unread: 0, presence: 0, leads: null });

  useEffect(() => { document.title = "KIBO360 Admin"; }, []);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  // Background watcher: any signed-in user with Live Chat access polls the
  // chat summary. This powers the unread badge + sound/browser alerts AND
  // tells the backend "support is online" (so offline email alerts pause).
  useEffect(() => {
    if (!token || !user) return undefined;
    if (user.role !== "superadmin" && !user.permissions?.chats) return undefined;
    prevRef.current = { first: true, unread: 0, presence: 0, leads: null }; // fresh baseline per sign-in
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* ignore */ }
    let stopped = false;
    const tick = () => {
      api("/api/admin/chats", { token })
        .then((d) => {
          if (stopped) return;
          const presence = d.presence?.count || 0;
          const prev = prevRef.current;
          if (!prev.first) {
            if (d.unreadTotal > prev.unread) {
              if (soundRef.current) playBeep();
              notifyBrowser("New live chat message on kibo360.in");
            } else if (
              presence > prev.presence ||
              (prev.leads != null && d.leadsCount != null && d.leadsCount > prev.leads)
            ) {
              if (soundRef.current) playBeep();
            }
          }
          prevRef.current = { first: false, unread: d.unreadTotal, presence, leads: d.leadsCount };
          const openChats = (d.chats || []).filter((c) => c.status !== "closed").length;
          setSummary((s) =>
            s && s.unreadTotal === d.unreadTotal && s.presenceCount === presence &&
            s.leadsCount === d.leadsCount && s.openChats === openChats
              ? s
              : { unreadTotal: d.unreadTotal, presenceCount: presence, leadsCount: d.leadsCount, openChats }
          );
          document.title = d.unreadTotal > 0 ? `(${d.unreadTotal}) KIBO360 Admin` : "KIBO360 Admin";
        })
        .catch(() => { /* transient */ });
    };
    tick();
    const iv = setInterval(tick, 10000);
    return () => { stopped = true; clearInterval(iv); };
  }, [token, user]);

  const notify = useCallback((msg) => { setFlash(msg); setTimeout(() => setFlash(""), 3500); }, []);

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
    can("chats") && { id: "chats", label: "Live Chat" },
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
        {can("chats") && (
          <button
            type="button"
            className={`admin-sound ${soundOn ? "on" : ""}`}
            aria-pressed={soundOn}
            title={soundOn ? "Sound alerts are on" : "Sound alerts are off"}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              try { localStorage.setItem("kibo360-admin-sound", next ? "on" : "off"); } catch { /* ignore */ }
              if (next) playBeep();
            }}
          >
            <Icon name={soundOn ? "bell" : "bell-off"} size={17} />
          </button>
        )}
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
            {t.id === "chats" && summary?.unreadTotal > 0 && (
              <span className="tab-badge">{summary.unreadTotal}</span>
            )}
            {t.id === "chats" && summary?.presenceCount > 0 && (
              <span className="tab-live" title={`${summary.presenceCount} visitor(s) on the site now`}>
                {summary.presenceCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {summary && can("chats") && (
        <div className="admin-stats" aria-label="Live overview">
          <button type="button" className={`stat-chip ${summary.presenceCount > 0 ? "live" : ""}`} onClick={() => setTab("chats")}>
            <strong>{summary.presenceCount}</strong> visitor{summary.presenceCount === 1 ? "" : "s"} online
          </button>
          <button type="button" className={`stat-chip ${summary.unreadTotal > 0 ? "alert" : ""}`} onClick={() => setTab("chats")}>
            <strong>{summary.unreadTotal}</strong> unread message{summary.unreadTotal === 1 ? "" : "s"}
          </button>
          <button type="button" className="stat-chip" onClick={() => setTab("chats")}>
            <strong>{summary.openChats}</strong> open conversation{summary.openChats === 1 ? "" : "s"}
          </button>
          {summary.leadsCount != null && can("leads") && (
            <button type="button" className="stat-chip" onClick={() => setTab("leads")}>
              <strong>{summary.leadsCount}</strong> lead{summary.leadsCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}

      {flash && <div className="admin-flash">{flash}</div>}

      <main className="admin-main">
        {tab === "leads" && can("leads") && <LeadsTab token={token} notify={notify} />}
        {tab === "chats" && can("chats") && <ChatsTab token={token} notify={notify} />}
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
  const [filter, setFilter] = useState("all");
  const load = useCallback(() => {
    api("/api/admin/leads", { token }).then((d) => setLeads(d.leads)).catch((e) => notify(e.message));
  }, [token, notify]);
  useEffect(load, [load]);

  const exportCsv = (rows) => {
    const table = [
      ["Received", "Name", "Email", "Phone", "Organization", "Interest", "Demo Date", "Demo Time", "Message", "Status"],
      ...rows.map((l) => [
        l.receivedAt, l.name, l.email, l.phone, l.organization, l.product,
        l.preferredDate || "", l.preferredTime || "", l.message, l.status || "new",
      ]),
    ];
    const csv = table.map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `kibo360-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const setStatus = (id, status) =>
    api(`/api/admin/leads/${id}`, { method: "PATCH", body: { status }, token })
      .then(load).catch((e) => notify(e.message));
  const remove = (id) => {
    if (!window.confirm("Delete this lead permanently?")) return;
    api(`/api/admin/leads/${id}`, { method: "DELETE", token }).then(load).catch((e) => notify(e.message));
  };

  if (!leads) return <p>Loading leads…</p>;
  if (leads.length === 0) return <p>No leads yet. Form submissions from the website will appear here.</p>;

  const shown = filter === "all" ? leads : leads.filter((l) => (l.status || "new") === filter);

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <h2>Leads &amp; Form Submissions ({shown.length}{filter !== "all" ? ` of ${leads.length}` : ""})</h2>
        <div className="admin-filter" role="group" aria-label="Filter leads by status">
          {["all", "new", "contacted", "closed"].map((f) => (
            <button key={f} type="button" className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline" onClick={() => exportCsv(shown)}>Export CSV</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Received</th><th>Name</th><th>Contact</th><th>Interest</th><th>Message</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id} className={`lead-${l.status || "new"}`}>
                <td>{new Date(l.receivedAt).toLocaleString()}</td>
                <td><strong>{l.name}</strong>{l.organization ? <div className="muted">{l.organization}</div> : null}</td>
                <td><a href={`mailto:${l.email}`}>{l.email}</a>{l.phone ? <div className="muted">{l.phone}</div> : null}</td>
                <td>
                  {l.product}
                  {(l.preferredDate || l.preferredTime) && (
                    <div className="lead-slot">
                      <Icon name="calendar" size={12} /> {l.preferredDate || "Any date"}{l.preferredTime ? ` · ${l.preferredTime}` : ""}
                    </div>
                  )}
                </td>
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

function ChatsTab({ token, notify }) {
  const [data, setData] = useState(null);   // { chats, presence }
  const [sel, setSel] = useState(null);     // selected chat id
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState("all"); // all | open | closed
  const [visitorQuery, setVisitorQuery] = useState("");
  const msgsRef = useRef(null);

  // Ask once for browser notification permission (used for chat alerts)
  useEffect(() => {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(() => {
    api("/api/admin/chats", { token })
      .then((d) => setData({ chats: d.chats, presence: d.presence }))
      .catch((e) => notify(e.message));
  }, [token, notify]);
  useEffect(() => {
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, [load]);

  const loadThread = useCallback((id) => {
    api(`/api/admin/chats/${id}`, { token })
      .then((d) => setThread(d.chat))
      .catch((e) => {
        if (/not found/i.test(e.message)) {
          // Chat was deleted (possibly by another admin): drop the selection
          setSel((s) => (s === id ? null : s));
          setThread((t) => (t?.id === id ? null : t));
        } else {
          notify(e.message);
        }
      });
  }, [token, notify]);
  useEffect(() => {
    if (!sel) { setThread(null); return undefined; }
    loadThread(sel);
    const iv = setInterval(() => loadThread(sel), 4000);
    return () => clearInterval(iv);
  }, [sel, loadThread]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight });
  }, [thread?.messages?.length, sel]);

  const sendReply = (e) => {
    e?.preventDefault();
    const text = reply.trim();
    if (!text || !sel) return;
    setReply("");
    api(`/api/admin/chats/${sel}/reply`, { method: "POST", body: { text }, token })
      .then(() => { loadThread(sel); load(); })
      .catch((err) => notify(err.message));
  };
  const setStatus = (status) =>
    api(`/api/admin/chats/${sel}`, { method: "PATCH", body: { status }, token })
      .then(() => { loadThread(sel); load(); })
      .catch((e) => notify(e.message));
  const removeChat = (id) => {
    if (!window.confirm("Delete this conversation permanently?")) return;
    api(`/api/admin/chats/${id}`, { method: "DELETE", token })
      .then(() => { if (sel === id) setSel(null); load(); })
      .catch((e) => notify(e.message));
  };

  const startChat = (v) => {
    if (v.chatId) { setSel(v.chatId); return; }
    const text = window.prompt(
      `Send an opening message to this visitor (${v.location || "location unknown"}, on ${v.page}):`,
      "Hi! I'm from the Kibo360 team - happy to help if you have any questions."
    );
    if (!text || !text.trim()) return;
    api("/api/admin/chats/start", { method: "POST", body: { visitorId: v.visitorId, text: text.trim() }, token })
      .then((d) => { setSel(d.chatId); load(); notify("Message sent - it pops up in the visitor's chat within a few seconds."); })
      .catch((e) => notify(e.message));
  };

  if (!data) return <p>Loading live chat…</p>;
  const { chats, presence } = data;
  const q = visitorQuery.trim().toLowerCase();
  const shownVisitors = q
    ? presence.visitors.filter((v) => `${v.location || ""} ${v.page || ""}`.toLowerCase().includes(q))
    : presence.visitors;

  return (
    <div>
      <div className="admin-card presence-card">
        <div className="presence-head">
          <span className={`presence-dot ${presence.count > 0 ? "live" : ""}`} aria-hidden="true" />
          <h2>{presence.count > 0 ? `${presence.count} visitor${presence.count === 1 ? "" : "s"} on the site right now` : "No visitors on the site right now"}</h2>
          {presence.visitors.length > 3 && (
            <input
              className="presence-search"
              value={visitorQuery}
              onChange={(e) => setVisitorQuery(e.target.value)}
              placeholder="Search by location or page…"
              aria-label="Search live visitors"
            />
          )}
        </div>
        {presence.visitors.length > 0 && (
          <>
            <p className="muted" style={{ margin: "10px 0 0" }}>
              Click a visitor to start chatting with them
              {presence.count > presence.visitors.length ? ` · showing the ${presence.visitors.length} longest-active of ${presence.count}` : ""}.
            </p>
            <div className="presence-list">
              {shownVisitors.map((v) => (
                <button key={v.visitorId} type="button" className={`presence-chip ${v.chatId ? "has-chat" : ""}`} onClick={() => startChat(v)}>
                  <strong>{v.location || "Locating…"}</strong>
                  <span>{v.page}</span>
                  <em>{Math.max(1, Math.round(v.sinceMs / 60000))}m on site{v.chatId ? " · in chat" : ""}</em>
                </button>
              ))}
              {shownVisitors.length === 0 && <p className="muted">No visitors match "{visitorQuery}".</p>}
            </div>
          </>
        )}
      </div>

      <div className="admin-chat-layout">
        <div className="admin-card chat-list-card">
          <h2>Conversations ({chats.length})</h2>
          <div className="admin-filter" role="group" aria-label="Filter conversations">
            {["all", "open", "closed"].map((f) => (
              <button key={f} type="button" className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {chats.length === 0 && <p className="muted">When a visitor writes to the chatbot, the conversation appears here.</p>}
          <div className="chat-list">
            {(filter === "all" ? chats : chats.filter((c) => (filter === "closed" ? c.status === "closed" : c.status !== "closed"))).map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chat-list-item ${sel === c.id ? "active" : ""} ${c.status === "closed" ? "closed" : ""}`}
                onClick={() => setSel(c.id)}
              >
                <span className="cli-top">
                  <strong>{c.location}</strong>
                  {c.online && <span className="cli-online">online</span>}
                  {c.unread > 0 && <span className="cli-unread">{c.unread}</span>}
                </span>
                <span className="cli-preview">
                  {c.lastMessage ? `${c.lastMessage.from === "agent" ? "You: " : c.lastMessage.from === "bot" ? "Bot: " : ""}${c.lastMessage.text}` : "-"}
                </span>
                <span className="cli-meta">{c.page} · {timeAgo(c.lastActiveAt)}{c.status === "closed" ? " · closed" : ""}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-card chat-thread-card">
          {!thread ? (
            <p className="muted" style={{ margin: "auto", textAlign: "center" }}>
              Select a conversation to read it and reply.<br />Your reply appears instantly in the visitor's chat window.
            </p>
          ) : (
            <>
              <div className="thread-head">
                <div>
                  <strong>{thread.location}</strong>
                  <span className="muted"> · {thread.page} · started {timeAgo(thread.createdAt)}{thread.online ? " · visitor online" : ""}</span>
                </div>
                <div className="thread-actions">
                  {thread.status === "closed" ? (
                    <button type="button" className="btn btn-outline" onClick={() => setStatus("open")}>Reopen</button>
                  ) : (
                    <button type="button" className="btn btn-outline" onClick={() => setStatus("closed")}>Close Chat</button>
                  )}
                  <button type="button" className="admin-del" aria-label="Delete conversation" onClick={() => removeChat(thread.id)}>
                    <Icon name="close" size={14} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
              <div className="thread-msgs" ref={msgsRef}>
                {thread.messages.map((m, i) => (
                  <div key={i} className={`thread-msg ${m.from}`}>
                    <span className="tm-who">
                      {m.from === "visitor" ? "Visitor" : m.from === "bot" ? "Bot (auto-reply)" : m.name || "Support"}
                      {" · "}{new Date(m.at).toLocaleTimeString()}
                    </span>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>
              <form className="thread-reply" onSubmit={sendReply}>
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a reply to this visitor…"
                  aria-label="Reply to visitor"
                />
                <button type="submit" className="btn btn-primary">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ token, notify, section }) {
  const [settings, setSettings] = useState(null);
  // Free-typing text for the comma-separated list; parsed only on save so
  // typing a comma is never "eaten" by re-normalization.
  const [teamText, setTeamText] = useState("");
  const [quickText, setQuickText] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    api("/api/admin/settings", { token })
      .then((d) => {
        setSettings(d.settings);
        setTeamText((d.settings?.notifications?.teamEmails || []).join(", "));
        setQuickText((d.settings?.chatbot?.quickReplies || []).join(", "));
      })
      .catch((e) => notify(e.message));
  }, [token, notify]);

  if (!settings) return <p>Loading settings…</p>;
  const value = settings[section];
  const update = (patch) => setSettings({ ...settings, [section]: { ...value, ...patch } });
  const save = () => {
    const payload = { ...value };
    if (section === "notifications") {
      payload.teamEmails = teamText.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (section === "chatbot") {
      payload.quickReplies = quickText.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return api("/api/admin/settings", { method: "PUT", body: { [section]: payload }, token })
      .then((d) => {
        setSettings(d.settings);
        setTeamText((d.settings?.notifications?.teamEmails || value.teamEmails || []).join(", "));
        setQuickText((d.settings?.chatbot?.quickReplies || []).join(", "));
        notify("Saved. The website picks this up immediately.");
      })
      .catch((e) => notify(e.message));
  };
  const sendTest = () => {
    setTesting(true);
    save()
      .then(() => api("/api/admin/test-email", { method: "POST", token }))
      .then((d) => { if (d?.ok) notify(`Test email sent to ${d.sentTo.join(", ")} - check the inbox.`); })
      .catch((e) => notify(e.message))
      .finally(() => setTesting(false));
  };

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
    const intents = value.intents || [];
    const setIntent = (i, patch) => update({ intents: intents.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
    const nudges = value.nudges || [];
    const setNudge = (i, patch) => update({ nudges: nudges.map((n, j) => (j === i ? { ...n, ...patch } : n)) });
    const restoreIntents = () => {
      if (!window.confirm("Replace all built-in answers with the original defaults? Your edits to this list will be lost.")) return;
      api("/api/admin/settings", { method: "PUT", body: { chatbot: { intents: null } }, token })
        .then((d) => { setSettings(d.settings); notify("Default answers restored."); })
        .catch((e) => notify(e.message));
    };
    return (
      <div className="admin-card">
        <h2>Chatbot</h2>
        <label className="admin-check">
          <input type="checkbox" checked={!!value.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
          Show the chatbot on the website
        </label>
        <label>Bot name<input value={value.botName} onChange={(e) => update({ botName: e.target.value })} /></label>
        <label>Welcome message<textarea rows="2" value={value.welcome} onChange={(e) => update({ welcome: e.target.value })} /></label>
        <label>
          Quick reply buttons (comma separated)
          <input value={quickText} onChange={(e) => setQuickText(e.target.value)} placeholder="Our Products, Book a Demo, HMS, CMS" />
        </label>

        <h3>Built-in Answers</h3>
        <p className="muted">
          Everything the bot replies automatically. It picks the first answer whose keywords appear in the visitor's
          message. Edit any text below - buttons shown with an answer are listed under it.
        </p>
        {intents.map((it, i) => (
          <div key={it.id || i} className="admin-faq-row">
            <input placeholder="Keywords (comma separated)" value={it.keywords || ""} onChange={(e) => setIntent(i, { keywords: e.target.value })} />
            <div>
              <textarea rows="3" placeholder="Answer" value={it.answer || ""} onChange={(e) => setIntent(i, { answer: e.target.value })} />
              {it.actions?.length > 0 && (
                <div className="intent-actions">
                  {it.actions.map((a) => <span key={a.label}>{a.label}</span>)}
                </div>
              )}
            </div>
            <button type="button" className="admin-del" aria-label="Delete answer" onClick={() => update({ intents: intents.filter((_, j) => j !== i) })}>
              <Icon name="close" size={14} strokeWidth={2.4} />
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-outline" onClick={() => update({ intents: [...intents, { id: `custom-${Date.now()}`, keywords: "", answer: "", actions: [] }] })}>
            + Add Answer
          </button>
          <button type="button" className="btn btn-outline" onClick={restoreIntents}>Restore Default Answers</button>
        </div>

        <h3>When the Bot Doesn't Know</h3>
        <label>
          Fallback reply (support options are offered automatically)
          <textarea rows="3" value={value.fallback || ""} onChange={(e) => update({ fallback: e.target.value })} />
        </label>

        <h3>Auto Popup</h3>
        <p className="muted">
          When a visitor stays on one page this long, the bot opens by itself with a page-specific message
          (once per visit). The first rule whose page path matches wins; otherwise the default message is used.
        </p>
        <label style={{ maxWidth: 260 }}>
          Seconds before the bot pops up
          <input type="number" min="5" max="600" value={value.nudgeSeconds ?? 30} onChange={(e) => update({ nudgeSeconds: e.target.value })} />
        </label>
        <label>Default popup message<textarea rows="2" value={value.nudgeDefault || ""} onChange={(e) => update({ nudgeDefault: e.target.value })} /></label>
        {nudges.map((n, i) => (
          <div key={i} className="admin-faq-row">
            <input placeholder="Page path (e.g. /products/hospitalmanagementsoftware)" value={n.path || ""} onChange={(e) => setNudge(i, { path: e.target.value })} />
            <textarea rows="2" placeholder="Popup message for this page" value={n.text || ""} onChange={(e) => setNudge(i, { text: e.target.value })} />
            <button type="button" className="admin-del" aria-label="Delete popup rule" onClick={() => update({ nudges: nudges.filter((_, j) => j !== i) })}>
              <Icon name="close" size={14} strokeWidth={2.4} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-outline" onClick={() => update({ nudges: [...nudges, { path: "", text: "" }] })}>
          + Add Page Rule
        </button>

        <h3>Custom Q&amp;A</h3>
        <p className="muted">Extra answers on top of the built-in ones - matched first when a visitor's message contains any keyword.</p>
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
        <label>Password / App password
          <input
            type="password"
            value={smtp.pass || ""}
            placeholder={smtp.hasPass ? "•••••••• (saved - leave blank to keep)" : ""}
            onChange={(e) => setSmtp({ pass: e.target.value })}
          />
        </label>
      </div>
      <label>From address (optional)<input value={smtp.from} onChange={(e) => setSmtp({ from: e.target.value })} placeholder="KIBO360 <no-reply@kibo360.in>" /></label>

      <h3>Internal team</h3>
      <label className="admin-check">
        <input type="checkbox" checked={!!value.notifyTeam} onChange={(e) => update({ notifyTeam: e.target.checked })} />
        Email the team when a new lead arrives
      </label>
      <label className="admin-check">
        <input type="checkbox" checked={value.offlineChatEmail !== false} onChange={(e) => update({ offlineChatEmail: e.target.checked })} />
        Email the team when a visitor chats while no support user is online
      </label>
      <label className="admin-check">
        <input type="checkbox" checked={value.offlineVisitorEmail !== false} onChange={(e) => update({ offlineVisitorEmail: e.target.checked })} />
        Email the team when a visitor browses the site while no support user is online
      </label>
      <label>
        Team emails (comma separated)
        <input
          value={teamText}
          onChange={(e) => setTeamText(e.target.value)}
          placeholder="sales@kibo360.in, support@kibo360.in"
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
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={save}>Save Email Settings</button>
        <button type="button" className="btn btn-outline" onClick={sendTest} disabled={testing}>
          {testing ? "Sending…" : "Save & Send Test Email"}
        </button>
      </div>
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
  const resetPassword = (u) => {
    const pw = window.prompt(`New password for ${u.email} (min 8 characters):`);
    if (pw === null) return;
    if (pw.length < 8) { notify("Password must be at least 8 characters."); return; }
    api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { password: pw }, token })
      .then(() => notify(`Password updated for ${u.email}.`))
      .catch((e) => notify(e.message));
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
                    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                      <button type="button" className="btn btn-outline btn-sm-admin" onClick={() => resetPassword(u)}>
                        Reset Password
                      </button>
                      <button type="button" className="admin-del" aria-label="Remove user" onClick={() => remove(u)}>
                        <Icon name="close" size={14} strokeWidth={2.4} />
                      </button>
                    </div>
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
