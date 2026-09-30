import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, getToken, setToken, onSessionExpired, onPasswordChangeRequired } from "./api.js";
import { Button, Field, FeedbackProvider, I, Input, Spinner, useToast, useConfirm, Alert } from "./ui.jsx";
import { ContentStoreProvider, hasUnsavedChanges } from "./store.jsx";
import "./admin.css";

// ---------------------------------------------------------------------------
// KIBO360 Super Admin - website management. Every screen is permission
// aware; the server enforces the same permissions on every request.
// ---------------------------------------------------------------------------

const Dashboard = lazy(() => import("./modules/Dashboard.jsx"));
const PagesList = lazy(() => import("./modules/Pages.jsx"));
const Editor = lazy(() => import("./editor/Editor.jsx"));
const Media = lazy(() => import("./modules/Media.jsx"));
const Seo = lazy(() => import("./modules/Seo.jsx"));
const Site = lazy(() => import("./modules/Site.jsx"));
const Forms = lazy(() => import("./modules/Forms.jsx"));
const Submissions = lazy(() => import("./modules/Submissions.jsx"));
const Leads = lazy(() => import("./modules/Leads.jsx"));
const Chat = lazy(() => import("./modules/Chat.jsx"));
const ChatSettings = lazy(() => import("./modules/ChatSettings.jsx"));
const Team = lazy(() => import("./modules/Team.jsx"));
const Roles = lazy(() => import("./modules/Roles.jsx"));
const History = lazy(() => import("./modules/History.jsx"));
const Revisions = lazy(() => import("./modules/Revisions.jsx"));
const Account = lazy(() => import("./modules/Account.jsx"));

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

const CONTENT_PERMS = ["pages.view", "seo.view", "site.edit", "site.code", "forms.edit"];

export const NAV = [
  { items: [{ to: "/admin", label: "Dashboard", icon: "dashboard", perm: "dashboard.view", end: true }] },
  {
    group: "Website Management",
    items: [
      { to: "/admin/pages", label: "Pages & Content", icon: "pages", perm: "pages.view" },
      { to: "/admin/editor?path=/", label: "Visual Editor", icon: "cursor", perm: "pages.view", match: "/admin/editor" },
      { to: "/admin/editor?path=/&panel=layers", label: "Homepage Layout", icon: "layers", perm: "pages.view", sub: true, match: "__never__" },
      { to: "/admin/media", label: "Media Library", icon: "image", perm: "media.view" },
      { to: "/admin/seo", label: "SEO Management", icon: "globe", perm: "seo.view", end: true },
      { to: "/admin/seo/sitemap", label: "Sitemap", icon: "map", perm: "seo.view", sub: true },
      { to: "/admin/seo/robots", label: "Robots.txt", icon: "robot", perm: "seo.view", sub: true },
      { to: "/admin/seo/redirects", label: "Redirects", icon: "redirect", perm: "seo.view", sub: true },
      { to: "/admin/site/header", label: "Header & Footer", icon: "layout", perm: "site.edit" },
      { to: "/admin/site/menus", label: "Menus", icon: "menu", perm: "site.edit" },
      { to: "/admin/site/banners", label: "Banners", icon: "megaphone", perm: "site.edit" },
      { to: "/admin/site/settings", label: "Website Settings", icon: "settings", perm: "site.edit" },
    ],
  },
  {
    group: "Forms & Conversion",
    items: [
      { to: "/admin/forms", label: "Form Builder", icon: "form", perm: "forms.edit" },
      { to: "/admin/submissions", label: "Form Submissions", icon: "inbox", perm: "submissions.view" },
      { to: "/admin/leads", label: "Leads", icon: "users", perm: "leads.view" },
      { to: "/admin/chat", label: "Live Chat", icon: "chat", perm: "chats", badge: "chat" },
      { to: "/admin/chat-settings", label: "Chat Settings", icon: "whatsapp", perm: ["chatbot", "whatsapp", "notifications"] },
    ],
  },
  {
    group: "Administration",
    items: [
      { to: "/admin/team", label: "Team Access", icon: "key", perm: "users.manage" },
      { to: "/admin/roles", label: "Roles & Permissions", icon: "shield", perm: ["roles.manage", "users.manage"] },
      { to: "/admin/history", label: "Change History", icon: "history", perm: "audit.view" },
      { to: "/admin/revisions", label: "Revision History", icon: "layers", perm: ["pages.view", "seo.view", "site.edit", "forms.edit"] },
    ],
  },
];

export default function AdminApp() {
  useEffect(() => {
    document.title = "KIBO360 Super Admin";
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
    robots.content = "noindex, nofollow";
    document.documentElement.classList.add("kibo-admin");
    return () => document.documentElement.classList.remove("kibo-admin");
  }, []);
  return (
    <FeedbackProvider>
      <AuthGate />
    </FeedbackProvider>
  );
}

function AuthGate() {
  const [me, setMe] = useState(null);
  const [expired, setExpired] = useState(false);
  const [checking, setChecking] = useState(!!getToken());
  const toast = useToast();
  const confirm = useConfirm();
  const meRef = useRef(null);
  meRef.current = me;
  // Once the app is open, a required password change is shown ON TOP of it
  // (unsaved drafts stay in memory) instead of replacing it.
  const started = useRef(false);
  if (me && !me.mustChangePassword) started.current = true;

  const refreshMe = useCallback(async () => {
    const d = await api("/api/admin/me");
    setMe(d.user);
    return d.user;
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    refreshMe()
      .catch((e) => { if (e.status === 401 || e.status === 403) setToken(""); else toast("Can't reach the server right now - sign in again when it's back.", { tone: "error" }); })
      .finally(() => setChecking(false));
  }, [refreshMe]);

  // An expired session must not throw away unsaved drafts: keep everything
  // mounted and ask for the password again on top. Only while signed in -
  // a stale token found at start-up (e.g. from the old admin, which used the
  // same storage key) just shows the normal sign-in page.
  useEffect(() => onSessionExpired(() => {
    if (!meRef.current) return;
    if (started.current) setExpired(true); // app open: ask again on top, drafts kept
    else { setMe(null); toast("Your session ended - please sign in again.", { tone: "error" }); } // nothing to keep yet
  }), [toast]);
  useEffect(() => onPasswordChangeRequired(() => { if (meRef.current && !meRef.current.mustChangePassword) setMe((m) => (m ? { ...m, mustChangePassword: true } : m)); }), []);

  const auth = useMemo(() => {
    if (!me) return null;
    const perms = new Set(me.permissions || []);
    const can = (p) => (Array.isArray(p) ? p.some((x) => perms.has(x)) : perms.has(p));
    return {
      me, perms, can, refreshMe,
      signOut: async () => {
        try { await api("/api/admin/logout", { method: "POST" }); } catch { /* already gone */ }
        setToken("");
        setExpired(false);
        started.current = false;
        setMe(null);
      },
    };
  }, [me, refreshMe]);

  /** Signing out from a password box must not silently drop unsaved edits. */
  const leave = async () => {
    if (hasUnsavedChanges()) {
      const ok = await confirm({ title: "Sign out and lose unsaved changes?", message: "Some edits have not been saved yet. If you sign out now they are thrown away. Sign in again instead to keep them.", confirmLabel: "Sign out anyway", danger: true });
      if (!ok) return;
    }
    if (expired) { setToken(""); setExpired(false); started.current = false; setMe(null); return; }
    auth.signOut();
  };

  if (checking) return <div className="a-boot"><Spinner label="Opening Super Admin…" /></div>;
  if (!auth) return <Login onSignedIn={(t, u) => { setToken(t); setExpired(false); setMe(u); }} />;
  if (me.mustChangePassword && !started.current) return <AuthCtx.Provider value={auth}><ForcePassword /></AuthCtx.Provider>;

  const contentEnabled = auth.can(CONTENT_PERMS);
  return (
    <AuthCtx.Provider value={auth}>
      {contentEnabled ? <ContentStoreProvider><Shell /></ContentStoreProvider> : <Shell />}
      {expired && (
        <ReLogin
          email={me.email}
          onDone={(t, u) => {
            setToken(t);
            setExpired(false);
            setMe(u); // fresh permissions + "must choose a new password"
            if (!u.mustChangePassword) { toast("Signed in again - saving your changes"); window.dispatchEvent(new Event("kibo-relogin")); }
          }}
          onCancel={leave}
        />
      )}
      {!expired && me.mustChangePassword && (
        <div className="a-modal-back a-auth-layer">
          <div className="a-modal" style={{ maxWidth: 440 }}>
            <ChangePasswordForm
              compact
              onDone={(u) => { setMe(u); toast("New password saved - saving your changes"); window.dispatchEvent(new Event("kibo-relogin")); }}
              onSignOut={leave}
            />
          </div>
        </div>
      )}
    </AuthCtx.Provider>
  );
}

function ReLogin({ email, onDone, onCancel }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api("/api/admin/login", { method: "POST", body: { email, password } });
      onDone(d.token, d.user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="a-modal-back a-auth-layer">
      <form className="a-modal" style={{ maxWidth: 420 }} onSubmit={submit}>
        <header className="a-modal-head"><h2>Session expired</h2></header>
        <div className="a-modal-body">
          <p className="a-muted">For security you were signed out. Enter your password to continue - your unsaved changes are kept and saved as soon as you are back. If your password was just reset, use the new temporary password.</p>
          <Field label="Email"><Input value={email} disabled /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={setPassword} autoComplete="current-password" autoFocus required /></Field>
          {error && <Alert tone="error">{error}</Alert>}
        </div>
        <footer className="a-modal-foot">
          <Button onClick={onCancel}>Sign out</Button>
          <Button variant="primary" type="submit" busy={busy}>Continue</Button>
        </footer>
      </form>
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
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="a-login">
      <form className="a-login-card" onSubmit={submit}>
        <img src="/kibo360-logo.png" alt="KIBO360" height="46" />
        <h1>Super Admin</h1>
        <p className="a-muted">Manage the KIBO360 website - content, media, SEO, forms and leads.</p>
        <Field label="Email" htmlFor="login-email"><Input id="login-email" type="email" value={email} onChange={setEmail} autoComplete="username" required autoFocus /></Field>
        <Field label="Password" htmlFor="login-pw"><Input id="login-pw" type="password" value={password} onChange={setPassword} autoComplete="current-password" required /></Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button variant="primary" type="submit" busy={busy} className="a-block">Sign in</Button>
      </form>
    </div>
  );
}

function ForcePassword() {
  const { refreshMe, signOut } = useAuth();
  return (
    <div className="a-login">
      <div className="a-login-card">
        <img src="/kibo360-logo.png" alt="KIBO360" height="46" />
        <ChangePasswordForm onDone={() => refreshMe()} onSignOut={signOut} />
      </div>
    </div>
  );
}

/** "Choose your own password" - after a temporary / reset / default password. */
function ChangePasswordForm({ onDone, onSignOut, compact = false }) {
  const { me } = useAuth();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (next !== again) { setError("The new passwords don't match"); return; }
    setBusy(true); setError("");
    try {
      const d = await api("/api/admin/password", { method: "POST", body: { current: cur, next } });
      await onDone(d.user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className={compact ? "" : "a-stack"} onSubmit={submit}>
      {compact ? <header className="a-modal-head"><h2>Choose a new password</h2></header> : <h1>Choose a new password</h1>}
      <div className={compact ? "a-modal-body" : "a-stack"}>
        <p className="a-muted">Hi {me.name} - for security, set your own password before continuing. At least 10 characters, with letters and numbers.</p>
        <Field label="Current password (the temporary one you just used)"><Input type="password" value={cur} onChange={setCur} autoComplete="current-password" required /></Field>
        <Field label="New password"><Input type="password" value={next} onChange={setNext} autoComplete="new-password" required /></Field>
        <Field label="Repeat new password"><Input type="password" value={again} onChange={setAgain} autoComplete="new-password" required /></Field>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
      <div className={compact ? "a-modal-foot" : "a-stack"}>
        {compact ? <Button onClick={onSignOut}>Sign out</Button> : null}
        <Button variant="primary" type="submit" busy={busy} className={compact ? "" : "a-block"}>Save password</Button>
        {!compact && <Button variant="ghost" onClick={onSignOut} className="a-block">Sign out</Button>}
      </div>
    </form>
  );
}

// ------------------------------------------------------------- chat alerts
function playBeep() {
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = playBeep.ctx || (playBeep.ctx = new C());
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const tone = (f, at, dur) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + at;
      g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    };
    tone(880, 0, 0.3); tone(1318.5, 0.18, 0.4);
  } catch { /* audio unavailable */ }
}
export { playBeep };

const ChatCtx = createContext({ summary: null, sound: true, setSound: () => {} });
export const useChatSummary = () => useContext(ChatCtx);

function useChatWatcher(enabled) {
  const [summary, setSummary] = useState(null);
  const [sound, setSoundState] = useState(() => { try { return localStorage.getItem("kibo360-admin-sound") !== "off"; } catch { return true; } });
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const prev = useRef({ first: true });
  useEffect(() => {
    if (!enabled) return undefined;
    prev.current = { first: true };
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch { /* ignore */ }
    let stop = false;
    const tick = () => api("/api/admin/chats").then((d) => {
      if (stop) return;
      const presence = d.presence?.count || 0;
      const p = prev.current;
      if (!p.first) {
        if (d.unreadTotal > p.unread) {
          if (soundRef.current) playBeep();
          try { if (Notification.permission === "granted") new Notification("KIBO360 Admin", { body: "New live chat message on kibo360.in" }); } catch { /* ignore */ }
        } else if (presence > p.presence || (p.leads != null && d.leadsCount > p.leads)) {
          if (soundRef.current) playBeep();
        }
      }
      prev.current = { first: false, unread: d.unreadTotal, presence, leads: d.leadsCount };
      const openChats = (d.chats || []).filter((c) => c.status !== "closed").length;
      setSummary({ unread: d.unreadTotal, presence, leads: d.leadsCount, openChats });
    }).catch(() => {});
    tick();
    const iv = setInterval(tick, 10000);
    return () => { stop = true; clearInterval(iv); };
  }, [enabled]);
  const setSound = (v) => { setSoundState(v); try { localStorage.setItem("kibo360-admin-sound", v ? "on" : "off"); } catch { /* ignore */ } if (v) playBeep(); };
  return { summary, sound, setSound };
}

// ------------------------------------------------------------------ shell
function Shell() {
  const auth = useAuth();
  const { can, me, signOut } = auth;
  const location = useLocation();
  const navigate = useNavigate();
  const chat = useChatWatcher(can("chats"));
  const [navOpen, setNavOpen] = useState(false);
  const fullBleed = location.pathname.startsWith("/admin/editor");

  useEffect(() => { setNavOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.title = chat.summary?.unread ? `(${chat.summary.unread}) KIBO360 Super Admin` : "KIBO360 Super Admin";
  }, [chat.summary?.unread]);

  const first = NAV.flatMap((g) => g.items).find((i) => can(i.perm));
  const home = can("dashboard.view") ? null : first?.to || "/admin/account";

  const routes = (
    <Suspense fallback={<div className="a-main-pad"><Spinner /></div>}>
      <Routes>
        <Route index element={home ? <Navigate to={home} replace /> : <Dashboard />} />
        <Route path="pages" element={<Guard perm="pages.view"><PagesList /></Guard>} />
        <Route path="editor" element={<Guard perm="pages.view"><Editor /></Guard>} />
        <Route path="media" element={<Guard perm="media.view"><Media /></Guard>} />
        <Route path="seo/*" element={<Guard perm="seo.view"><Seo /></Guard>} />
        <Route path="site/*" element={<Guard perm="site.edit"><Site /></Guard>} />
        <Route path="forms" element={<Guard perm="forms.edit"><Forms /></Guard>} />
        <Route path="submissions" element={<Guard perm="submissions.view"><Submissions /></Guard>} />
        <Route path="leads" element={<Guard perm="leads.view"><Leads /></Guard>} />
        <Route path="chat" element={<Guard perm="chats"><Chat /></Guard>} />
        <Route path="chat-settings" element={<Guard perm={["chatbot", "whatsapp", "notifications"]}><ChatSettings /></Guard>} />
        <Route path="team" element={<Guard perm="users.manage"><Team /></Guard>} />
        <Route path="roles" element={<Guard perm={["roles.manage", "users.manage"]}><Roles /></Guard>} />
        <Route path="history" element={<Guard perm="audit.view"><History /></Guard>} />
        <Route path="revisions" element={<Guard perm={CONTENT_PERMS}><Revisions /></Guard>} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  );

  return (
    <ChatCtx.Provider value={chat}>
      {fullBleed ? (
        <div className="a-app full">{routes}</div>
      ) : (
        <div className={`a-app ${navOpen ? "nav-open" : ""}`}>
          <aside className="a-side">
            <div className="a-side-brand">
              <img src="/kibo360-logo.png" alt="KIBO360" height="30" />
              <span>Super Admin</span>
            </div>
            <nav className="a-nav" aria-label="Super Admin">
              {NAV.map((g, gi) => {
                const items = g.items.filter((i) => can(i.perm));
                if (!items.length) return null;
                return (
                  <div key={gi} className="a-nav-group">
                    {g.group && <div className="a-nav-title">{g.group}</div>}
                    {items.map((i) => (
                      <NavLink
                        key={i.to}
                        to={i.to}
                        end={i.end}
                        className={({ isActive }) => {
                          const active = i.match ? location.pathname.startsWith(i.match) : isActive;
                          return `a-nav-link ${i.sub ? "sub" : ""} ${active ? "active" : ""}`;
                        }}
                      >
                        <I n={i.icon} size={i.sub ? 14 : 17} />
                        <span>{i.label}</span>
                        {i.badge === "chat" && chat.summary?.unread > 0 && <span className="a-nav-badge">{chat.summary.unread}</span>}
                        {i.badge === "chat" && chat.summary?.presence > 0 && <span className="a-nav-live" title={`${chat.summary.presence} visitor(s) on the site`}>{chat.summary.presence}</span>}
                      </NavLink>
                    ))}
                  </div>
                );
              })}
            </nav>
            <div className="a-side-foot">
              <button type="button" className="a-me" onClick={() => navigate("/admin/account")}>
                <span className="a-avatar">{(me.name || me.email).slice(0, 1).toUpperCase()}</span>
                <span><strong>{me.name}</strong><small>{me.roleName}</small></span>
              </button>
              {can("chats") && (
                <button type="button" className={`a-icon-btn ${chat.sound ? "on" : ""}`} title={chat.sound ? "Sound alerts on" : "Sound alerts off"} aria-pressed={chat.sound} onClick={() => chat.setSound(!chat.sound)}>
                  <I n={chat.sound ? "bell" : "bellOff"} size={16} />
                </button>
              )}
              <button type="button" className="a-icon-btn" title="Sign out" aria-label="Sign out" onClick={signOut}><I n="logout" size={16} /></button>
            </div>
          </aside>
          <div className="a-main">
            <header className="a-mobilebar">
              <button type="button" className="a-icon-btn" aria-label="Open menu" onClick={() => setNavOpen(true)}><I n="menu" size={20} /></button>
              <img src="/kibo360-logo.png" alt="KIBO360" height="26" />
              <a href="/" target="_blank" rel="noopener noreferrer" className="a-icon-btn" aria-label="Open website"><I n="external" /></a>
            </header>
            <div className="a-scrim" onClick={() => setNavOpen(false)} />
            {routes}
          </div>
        </div>
      )}
    </ChatCtx.Provider>
  );
}

function Guard({ perm, children }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return (
      <div className="a-main-pad">
        <Alert tone="warn">You don&apos;t have access to this area. Ask a Super Admin to update your role.</Alert>
      </div>
    );
  }
  return children;
}
