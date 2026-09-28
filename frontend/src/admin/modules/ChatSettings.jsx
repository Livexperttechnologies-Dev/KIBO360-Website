import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AdminApp.jsx";
import { Alert, Button, Card, ErrorBox, Field, IconButton, Input, PageHead, Spinner, Tabs, Textarea, Toggle, useConfirm, useToast } from "../ui.jsx";

// ---------------------------------------------------------------------------
// Chat Settings: WhatsApp button, chatbot answers & auto-popup, email
// notifications (SMTP). These apply immediately (operational settings,
// not page content), exactly like before.
// ---------------------------------------------------------------------------

export default function ChatSettings() {
  const { can } = useAuth();
  const toast = useToast();
  const tabs = [can("chatbot") && { id: "chatbot", label: "Chatbot" }, can("whatsapp") && { id: "whatsapp", label: "WhatsApp" }, can("notifications") && { id: "notifications", label: "Email notifications" }].filter(Boolean);
  const [tab, setTab] = useState(tabs[0]?.id);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState({ team: "", quick: "" });
  const [busy, setBusy] = useState(false);
  const load = () => api("/api/admin/settings").then((d) => {
    setSettings(d.settings);
    setText({ team: (d.settings?.notifications?.teamEmails || []).join(", "), quick: (d.settings?.chatbot?.quickReplies || []).join(", ") });
  }).catch(setError);
  useEffect(() => { load(); }, []);

  if (error) return <div className="a-page"><ErrorBox error={error} onRetry={load} /></div>;
  if (!settings) return <div className="a-page"><Spinner /></div>;
  const value = settings[tab] || {};
  const update = (patch) => setSettings((s) => ({ ...s, [tab]: { ...s[tab], ...patch } }));
  const save = async () => {
    setBusy(true);
    const payload = { ...value };
    if (tab === "notifications") payload.teamEmails = text.team.split(",").map((s) => s.trim()).filter(Boolean);
    if (tab === "chatbot") payload.quickReplies = text.quick.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      const d = await api("/api/admin/settings", { method: "PUT", body: { [tab]: payload } });
      setSettings(d.settings);
      toast("Saved - the website uses this immediately.");
      return true;
    } catch (e) { toast(e.message, { tone: "error" }); return false; } finally { setBusy(false); }
  };

  return (
    <div className="a-page">
      <PageHead title="Chat Settings" subtitle="WhatsApp, chatbot and email alerts. These settings take effect as soon as you save." actions={<Button variant="primary" busy={busy} onClick={save}>Save {tabs.find((t) => t.id === tab)?.label}</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === "whatsapp" && <WhatsApp value={value} update={update} />}
      {tab === "chatbot" && <Chatbot value={value} update={update} quick={text.quick} setQuick={(v) => setText((t) => ({ ...t, quick: v }))} reload={load} />}
      {tab === "notifications" && <Notifications value={value} update={update} team={text.team} setTeam={(v) => setText((t) => ({ ...t, team: v }))} save={save} />}
    </div>
  );
}

function WhatsApp({ value, update }) {
  return (
    <Card title="WhatsApp support button">
      <div className="a-stack">
        <Toggle checked={!!value.enabled} onChange={(v) => update({ enabled: v })} label="Show the WhatsApp button on the website" />
        <Field label="WhatsApp number" hint="Digits only, with country code, e.g. 918008005672"><Input value={value.number} onChange={(v) => update({ number: v.replace(/\D/g, "") })} /></Field>
        <Field label="Pre-filled visitor message"><Textarea rows={2} value={value.greeting} onChange={(v) => update({ greeting: v })} /></Field>
      </div>
    </Card>
  );
}

function Chatbot({ value, update, quick, setQuick, reload }) {
  const toast = useToast();
  const confirm = useConfirm();
  const intents = value.intents || [];
  const nudges = value.nudges || [];
  const faqs = value.customFaqs || [];
  const setIntent = (i, p) => update({ intents: intents.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setNudge = (i, p) => update({ nudges: nudges.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const setFaq = (i, p) => update({ customFaqs: faqs.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <div className="a-stack">
      <Card title="Chatbot">
        <div className="a-stack">
          <Toggle checked={!!value.enabled} onChange={(v) => update({ enabled: v })} label="Show the chatbot on the website" />
          <div className="a-grid-2">
            <Field label="Bot name"><Input value={value.botName} onChange={(v) => update({ botName: v })} /></Field>
            <Field label="Quick reply buttons (comma separated)"><Input value={quick} onChange={setQuick} placeholder="Our Products, Book a Demo, HMS, CMS" /></Field>
          </div>
          <Field label="Welcome message"><Textarea rows={2} value={value.welcome} onChange={(v) => update({ welcome: v })} /></Field>
          <Field label="When the bot doesn't know" hint="Support options are offered automatically after this."><Textarea rows={2} value={value.fallback} onChange={(v) => update({ fallback: v })} /></Field>
        </div>
      </Card>
      <Card title="Built-in answers" subtitle="The bot uses the first answer whose keywords appear in the visitor's message." actions={
        <>
          <Button size="sm" onClick={() => update({ intents: [...intents, { id: `custom-${Date.now()}`, keywords: "", answer: "", actions: [] }] })}>Add answer</Button>
          <Button size="sm" variant="ghost" onClick={async () => {
            if (!(await confirm({ title: "Restore default answers?", message: "Your edits to this list are replaced by the original answers.", confirmLabel: "Restore" }))) return;
            try { await api("/api/admin/settings", { method: "PUT", body: { chatbot: { intents: null } } }); await reload(); toast("Default answers restored"); } catch (e) { toast(e.message, { tone: "error" }); }
          }}>Restore defaults</Button>
        </>
      }>
        <div className="a-rows">
          {intents.map((it, i) => (
            <div key={it.id || i} className="a-rowcard">
              <div className="a-row nowrap"><Input value={it.keywords} onChange={(v) => setIntent(i, { keywords: v })} placeholder="Keywords (comma separated)" /><IconButton icon="trash" className="danger" label="Delete answer" onClick={() => update({ intents: intents.filter((_, j) => j !== i) })} /></div>
              <Textarea rows={2} value={it.answer} onChange={(v) => setIntent(i, { answer: v })} placeholder="Answer" style={{ marginTop: 8 }} />
              {it.actions?.length > 0 && <p className="a-hint">Buttons: {it.actions.map((a) => a.label).join(", ")}</p>}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Auto popup" subtitle="If a visitor stays on a page this long, the bot opens by itself once per visit with a page-specific message." actions={<Button size="sm" onClick={() => update({ nudges: [...nudges, { path: "", text: "" }] })}>Add page rule</Button>}>
        <div className="a-stack">
          <div className="a-grid-2">
            <Field label="Seconds before the popup"><Input type="number" min="5" max="600" value={value.nudgeSeconds ?? 30} onChange={(v) => update({ nudgeSeconds: v })} /></Field>
            <Field label="Default popup message"><Input value={value.nudgeDefault} onChange={(v) => update({ nudgeDefault: v })} /></Field>
          </div>
          {nudges.map((n, i) => (
            <div key={i} className="a-kv-row">
              <Input value={n.path} onChange={(v) => setNudge(i, { path: v })} placeholder="/products/hospitalmanagementsoftware" />
              <Input value={n.text} onChange={(v) => setNudge(i, { text: v })} placeholder="Message for this page" />
              <IconButton icon="trash" className="danger" label="Delete rule" onClick={() => update({ nudges: nudges.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </div>
      </Card>
      <Card title="Custom Q&A" subtitle="Checked before the built-in answers." actions={<Button size="sm" onClick={() => update({ customFaqs: [...faqs, { keywords: "", a: "" }] })}>Add Q&amp;A</Button>}>
        <div className="a-stack">
          {!faqs.length && <p className="a-muted">None yet.</p>}
          {faqs.map((f, i) => (
            <div key={i} className="a-kv-row">
              <Input value={f.keywords} onChange={(v) => setFaq(i, { keywords: v })} placeholder="Keywords" />
              <Input value={f.a} onChange={(v) => setFaq(i, { a: v })} placeholder="Answer" />
              <IconButton icon="trash" className="danger" label="Delete" onClick={() => update({ customFaqs: faqs.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Notifications({ value, update, team, setTeam, save }) {
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const smtp = value.smtp || {};
  const setSmtp = (p) => update({ smtp: { ...smtp, ...p } });
  return (
    <div className="a-stack">
      <Card title="Sending account (SMTP)">
        <div className="a-stack tight">
          <div className="a-grid-2">
            <Field label="Host"><Input value={smtp.host} onChange={(v) => setSmtp({ host: v })} placeholder="smtp.gmail.com" /></Field>
            <Field label="Port"><Input value={smtp.port} onChange={(v) => setSmtp({ port: v })} placeholder="587" /></Field>
            <Field label="Username"><Input value={smtp.user} onChange={(v) => setSmtp({ user: v })} autoComplete="off" /></Field>
            <Field label="Password / app password" hint={smtp.hasPass ? "Saved - leave blank to keep it" : null}><Input type="password" value={smtp.pass || ""} onChange={(v) => setSmtp({ pass: v })} autoComplete="new-password" /></Field>
          </div>
          <Field label="From address (optional)"><Input value={smtp.from} onChange={(v) => setSmtp({ from: v })} placeholder="KIBO360 <no-reply@kibo360.in>" /></Field>
        </div>
      </Card>
      <Card title="Team alerts">
        <div className="a-stack tight">
          <Toggle checked={!!value.notifyTeam} onChange={(v) => update({ notifyTeam: v })} label="Email the team when a new lead arrives" />
          <Toggle checked={value.offlineChatEmail !== false} onChange={(v) => update({ offlineChatEmail: v })} label="Email when a visitor chats while nobody from support is online" />
          <Toggle checked={value.offlineVisitorEmail !== false} onChange={(v) => update({ offlineVisitorEmail: v })} label="Email when a visitor browses while nobody from support is online" />
          <Field label="Team emails (comma separated)"><Input value={team} onChange={setTeam} placeholder="sales@kibo360.in, support@kibo360.in" /></Field>
        </div>
      </Card>
      <Card title="Visitor confirmation email">
        <div className="a-stack tight">
          <Toggle checked={!!value.visitorAutoReply} onChange={(v) => update({ visitorAutoReply: v })} label="Send visitors a confirmation after they submit a form" />
          <Field label="Subject"><Input value={value.visitorSubject} onChange={(v) => update({ visitorSubject: v })} /></Field>
          <Field label="Message" hint="{name} is replaced with the visitor's name"><Textarea rows={4} value={value.visitorMessage} onChange={(v) => update({ visitorMessage: v })} /></Field>
        </div>
      </Card>
      <Alert tone="info">Each form can also switch team alerts and confirmations on or off in the Form Builder.</Alert>
      <div><Button busy={testing} onClick={async () => { setTesting(true); try { if (await save()) { const d = await api("/api/admin/test-email", { method: "POST" }); toast(`Test email sent to ${d.sentTo.join(", ")}`); } } catch (e) { toast(e.message, { tone: "error" }); } finally { setTesting(false); } }}>Save &amp; send a test email</Button></div>
    </div>
  );
}
