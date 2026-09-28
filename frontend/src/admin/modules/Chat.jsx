import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Button, Card, Empty, IconButton, Input, PageHead, Spinner, Tabs, timeAgo, usePrompt, useConfirm, useToast } from "../ui.jsx";

// ---------------------------------------------------------------------------
// Live chat: visitors on the site right now, conversations, replies and
// proactive chat. (Sound + browser alerts run in the admin shell.)
// ---------------------------------------------------------------------------

export default function Chat() {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const msgs = useRef(null);

  const load = useCallback(() => api("/api/admin/chats").then((d) => setData({ chats: d.chats, presence: d.presence })).catch((e) => toast(e.message, { tone: "error" })), [toast]);
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);

  const loadThread = useCallback((id) => api(`/api/admin/chats/${id}`).then((d) => setThread(d.chat)).catch((e) => {
    if (/not found/i.test(e.message)) { setSel((s) => (s === id ? null : s)); setThread((t) => (t?.id === id ? null : t)); } else toast(e.message, { tone: "error" });
  }), [toast]);
  useEffect(() => {
    if (!sel) { setThread(null); return undefined; }
    loadThread(sel);
    const t = setInterval(() => loadThread(sel), 4000);
    return () => clearInterval(t);
  }, [sel, loadThread]);
  useEffect(() => { msgs.current?.scrollTo({ top: msgs.current.scrollHeight }); }, [thread?.messages?.length, sel]);

  const send = (e) => {
    e?.preventDefault();
    const text = reply.trim();
    if (!text || !sel) return;
    setReply("");
    api(`/api/admin/chats/${sel}/reply`, { method: "POST", body: { text } }).then(() => { loadThread(sel); load(); }).catch((err) => toast(err.message, { tone: "error" }));
  };
  const setStatus = (status) => api(`/api/admin/chats/${sel}`, { method: "PATCH", body: { status } }).then(() => { loadThread(sel); load(); }).catch((e) => toast(e.message, { tone: "error" }));
  const remove = async (id) => {
    if (!(await confirm({ title: "Delete this conversation?", message: "It is removed permanently.", danger: true, confirmLabel: "Delete" }))) return;
    api(`/api/admin/chats/${id}`, { method: "DELETE" }).then(() => { if (sel === id) setSel(null); load(); }).catch((e) => toast(e.message, { tone: "error" }));
  };
  const start = async (v) => {
    if (v.chatId) { setSel(v.chatId); return; }
    const text = await prompt({ title: "Start a chat", label: `Opening message for this visitor (${v.location || "location unknown"}, on ${v.page})`, value: "Hi! I'm from the Kibo360 team - happy to help if you have any questions.", required: true, confirmLabel: "Send" });
    if (!text?.trim()) return;
    api("/api/admin/chats/start", { method: "POST", body: { visitorId: v.visitorId, text: text.trim() } })
      .then((d) => { setSel(d.chatId); load(); toast("Sent - it pops up in the visitor's chat within a few seconds."); })
      .catch((e) => toast(e.message, { tone: "error" }));
  };

  if (!data) return <div className="a-page"><Spinner label="Loading live chat…" /></div>;
  const { chats, presence } = data;
  const needle = q.trim().toLowerCase();
  const visitors = needle ? presence.visitors.filter((v) => `${v.location || ""} ${v.page || ""}`.toLowerCase().includes(needle)) : presence.visitors;
  const shown = filter === "all" ? chats : chats.filter((c) => (filter === "closed" ? c.status === "closed" : c.status !== "closed"));

  return (
    <div className="a-page">
      <PageHead title="Live Chat" subtitle="See who is on the website right now and talk to them. Replies appear instantly in the visitor's chat window." />
      <Card className="presence-card">
        <div className="presence-head">
          <span className={`presence-dot ${presence.count > 0 ? "live" : ""}`} aria-hidden="true" />
          <h2>{presence.count > 0 ? `${presence.count} visitor${presence.count === 1 ? "" : "s"} on the site right now` : "No visitors on the site right now"}</h2>
          {presence.visitors.length > 3 && <Input value={q} onChange={setQ} placeholder="Search by location or page…" style={{ maxWidth: 260, marginLeft: "auto" }} />}
        </div>
        {presence.visitors.length > 0 && (
          <>
            <p className="a-muted a-small" style={{ marginTop: 8 }}>Click a visitor to start chatting{presence.count > presence.visitors.length ? ` · showing the ${presence.visitors.length} longest-active of ${presence.count}` : ""}.</p>
            <div className="presence-list">
              {visitors.map((v) => (
                <button key={v.visitorId} type="button" className={`presence-chip ${v.chatId ? "has-chat" : ""}`} onClick={() => start(v)}>
                  <strong>{v.location || "Locating…"}</strong><span>{v.page}</span><em>{Math.max(1, Math.round(v.sinceMs / 60000))}m on site{v.chatId ? " · in chat" : ""}</em>
                </button>
              ))}
              {!visitors.length && <p className="a-muted">No visitors match “{q}”.</p>}
            </div>
          </>
        )}
      </Card>
      <div className="admin-chat-layout" style={{ marginTop: 16 }}>
        <Card className="chat-list-card" title={`Conversations (${chats.length})`}>
          <Tabs className="small" value={filter} onChange={setFilter} tabs={[{ id: "all", label: "All" }, { id: "open", label: "Open" }, { id: "closed", label: "Closed" }]} />
          {!chats.length && <Empty icon="chat" text="When a visitor writes to the chatbot, the conversation appears here." />}
          <div className="chat-list">
            {shown.map((c) => (
              <button key={c.id} type="button" className={`chat-list-item ${sel === c.id ? "active" : ""} ${c.status === "closed" ? "closed" : ""}`} onClick={() => setSel(c.id)}>
                <span className="cli-top"><strong>{c.location}</strong>{c.online && <span className="cli-online">online</span>}{c.unread > 0 && <span className="cli-unread">{c.unread}</span>}</span>
                <span className="cli-preview">{c.lastMessage ? `${c.lastMessage.from === "agent" ? "You: " : c.lastMessage.from === "bot" ? "Bot: " : ""}${c.lastMessage.text}` : "-"}</span>
                <span className="cli-meta">{c.page} · {timeAgo(c.lastActiveAt)}{c.status === "closed" ? " · closed" : ""}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="chat-thread-card">
          {!thread ? (
            <Empty icon="chat" text="Select a conversation to read it and reply." />
          ) : (
            <>
              <div className="thread-head">
                <div><strong>{thread.location}</strong><span className="a-muted"> · {thread.page} · started {timeAgo(thread.createdAt)}{thread.online ? " · visitor online" : ""}</span></div>
                <div className="thread-actions">
                  {thread.status === "closed" ? <Button size="sm" onClick={() => setStatus("open")}>Reopen</Button> : <Button size="sm" onClick={() => setStatus("closed")}>Close chat</Button>}
                  <IconButton icon="trash" className="danger" label="Delete conversation" onClick={() => remove(thread.id)} />
                </div>
              </div>
              <div className="thread-msgs" ref={msgs}>
                {thread.messages.map((m, i) => (
                  <div key={i} className={`thread-msg ${m.from}`}>
                    <span className="tm-who">{m.from === "visitor" ? "Visitor" : m.from === "bot" ? "Bot (auto-reply)" : m.name || "Support"} · {new Date(m.at).toLocaleTimeString()}</span>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>
              <form className="thread-reply" onSubmit={send}>
                <Input value={reply} onChange={setReply} placeholder="Type a reply to this visitor…" aria-label="Reply" />
                <Button type="submit" variant="primary" icon="send">Send</Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
