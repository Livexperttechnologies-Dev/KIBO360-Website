import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ContentProvider } from "../../cms/content.jsx";
import FormRenderer from "../../components/FormRenderer.jsx";
import { useAuth } from "../AdminApp.jsx";
import { useContent } from "../store.jsx";
import { Alert, Badge, Button, Card, Check, Empty, ErrorBox, Field, I, IconButton, Input, PageHead, Select, Spinner, Textarea, Toggle, usePrompt, useConfirm, useToast } from "../ui.jsx";
import DocBar from "../DocBar.jsx";
import { docLabel } from "../editor/panels.jsx";

// ---------------------------------------------------------------------------
// Form Builder: contact, demo, callback, partner, newsletter and custom
// forms. Definitions are content (draft -> publish); submissions are always
// validated on the server against the PUBLISHED definition.
// ---------------------------------------------------------------------------

const FIELD_TYPES = [
  { value: "text", label: "Short text" }, { value: "email", label: "Email" }, { value: "tel", label: "Phone" },
  { value: "textarea", label: "Long text" }, { value: "select", label: "Dropdown" }, { value: "radio", label: "Single choice" },
  { value: "checkbox", label: "Multiple choice" }, { value: "date", label: "Date" }, { value: "timeslots", label: "Time slots" },
  { value: "number", label: "Number" }, { value: "url", label: "Website address" }, { value: "consent", label: "Consent checkbox" },
  { value: "hidden", label: "Hidden value" },
];
const MAP_TO = [
  { value: "", label: "(not saved on the lead)" }, { value: "name", label: "Lead name" }, { value: "email", label: "Lead email" },
  { value: "phone", label: "Lead phone" }, { value: "organization", label: "Organisation" }, { value: "message", label: "Message" },
  { value: "product", label: "Product interest" }, { value: "preferredDate", label: "Preferred date" }, { value: "preferredTime", label: "Preferred time" },
  { value: "jobTitle", label: "Job title" }, { value: "city", label: "City" },
];
const WITH_OPTIONS = ["select", "radio", "checkbox", "timeslots"];
const fieldId = (label, taken) => {
  let base = String(label || "field").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join("").slice(0, 32) || "field";
  if (!/^[a-zA-Z]/.test(base)) base = `f${base}`;
  let id = base; let n = 2;
  while (taken.includes(id)) id = `${base}${n++}`;
  return id;
};

export default function Forms() {
  const store = useContent();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [params, setParams] = useSearchParams();
  const ro = !can("forms.edit");
  const forms = store?.working?.forms?.forms || [];
  const selId = params.get("form") || forms[0]?.id;
  const form = forms.find((f) => f.id === selId);
  const usage = useMemo(() => {
    const out = {};
    for (const [docId, d] of Object.entries(store?.working || {})) {
      for (const b of Object.values(d?.layout?.blocks || {})) if (b.type === "form") (out[b.formId || "demo"] ||= []).push(docId);
    }
    return out;
  }, [store?.working]);

  if (!store?.loaded) return <div className="a-page"><Spinner /></div>;
  if (store.error) return <div className="a-page"><ErrorBox error={store.error} onRetry={store.load} /></div>;

  const save = (next, label = "Edit form") => { if (!ro) store.update("forms", (d) => ({ ...(d || {}), forms: next }), { label, coalesce: `forms|${selId}` }); };
  const upd = (patch) => save(forms.map((f) => (f.id === form.id ? { ...f, ...patch } : f)));
  const create = async () => {
    const name = await prompt({ title: "New form", label: "Form name", placeholder: "e.g. Webinar registration", required: true, confirmLabel: "Create" });
    if (!name) return;
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "form";
    while (forms.some((f) => f.id === id)) id = `${id}-2`;
    const f = {
      id, name, type: "custom", enabled: true, submitLabel: "Submit",
      fields: [
        { id: "name", type: "text", label: "Full Name", required: true, width: "half", mapTo: "name", pattern: "letters", placeholder: "", help: "" },
        { id: "email", type: "email", label: "Email", required: true, width: "half", mapTo: "email", placeholder: "", help: "" },
        { id: "message", type: "textarea", label: "Message", required: false, width: "full", mapTo: "message", placeholder: "", help: "" },
      ],
      success: { mode: "message", redirect: "/thank-you", message: "Thank you! We'll be in touch shortly." },
      notify: { team: true, autoReply: true, extraEmails: [] },
      spam: { honeypot: true, minSeconds: 3 },
      leadStage: "new",
    };
    save([...forms, f], "Create form");
    setParams({ form: id });
    toast("Form created as a draft. Add it to a page with the “Form” section, then publish both.");
  };

  return (
    <div className="a-page">
      <PageHead title="Form Builder" subtitle="Design the forms on the website. Every submission becomes a lead with its source, UTM campaign and landing page." actions={!ro && <Button variant="primary" icon="plus" onClick={create}>New form</Button>} />
      <DocBar docIds={["forms"]} previewPath="/contact" />
      <div className="a-split">
        <div className="a-card" style={{ padding: 8 }}>
          <div className="a-side-list">
            {forms.map((f) => (
              <button key={f.id} type="button" className={`a-side-item ${f.id === selId ? "active" : ""}`} onClick={() => setParams({ form: f.id })}>
                <I n="form" size={15} />
                <span style={{ flex: 1, minWidth: 0 }}><span className="a-ellipsis" style={{ display: "block" }}>{f.name}</span><small className="a-muted">{f.id} · {f.fields.length} fields</small></span>
                {!f.enabled && <Badge tone="gray">off</Badge>}
              </button>
            ))}
          </div>
        </div>
        {!form ? <Card><Empty icon="form" text="Select or create a form." /></Card> : (
          <div className="a-stack">
            <Card title={form.name} subtitle={<>ID <code>{form.id}</code> · {form.id === "demo" ? "used by every “Book a Demo” button and the Contact page" : usage[form.id]?.length ? `on ${usage[form.id].map((d) => docLabel(d, store)).join(", ")}` : "not placed on any page yet"}</>}
              actions={!ro && !["demo", "contact"].includes(form.id) && (
                <Button size="sm" variant="danger" icon="trash" onClick={async () => {
                  if (!(await confirm({ title: `Delete “${form.name}”?`, message: usage[form.id]?.length ? "This form is placed on a page - those sections will show nothing after publishing." : "The form definition is removed (existing submissions are kept).", danger: true, confirmLabel: "Delete form" }))) return;
                  save(forms.filter((f) => f.id !== form.id), "Delete form");
                  setParams({});
                }}>Delete</Button>
              )}
            >
              <div className="a-stack">
                <div className="a-grid-3">
                  <Field label="Form name"><Input value={form.name} disabled={ro} onChange={(v) => upd({ name: v })} /></Field>
                  <Field label="Type"><Select value={form.type} disabled={ro} onChange={(v) => upd({ type: v })} options={["contact", "demo", "callback", "partner", "newsletter", "custom"]} /></Field>
                  <Field label="Submit button text"><Input value={form.submitLabel} disabled={ro} onChange={(v) => upd({ submitLabel: v })} /></Field>
                </div>
                <Toggle checked={form.enabled} disabled={ro} onChange={(v) => upd({ enabled: v })} label="Form is active" hint="Switched off, the form disappears from the site and submissions are refused." />
              </div>
            </Card>
            <FieldsEditor form={form} ro={ro} onChange={(fields) => upd({ fields })} />
            <div className="a-two">
              <Card title="After submitting">
                <div className="a-stack tight">
                  <Field label="Then"><Select value={form.success.mode} disabled={ro} onChange={(v) => upd({ success: { ...form.success, mode: v } })} options={[{ value: "redirect", label: "Go to a thank-you page" }, { value: "message", label: "Show a message in place" }]} /></Field>
                  {form.success.mode === "redirect"
                    ? <Field label="Thank-you page"><Input value={form.success.redirect} disabled={ro} onChange={(v) => upd({ success: { ...form.success, redirect: v } })} placeholder="/thank-you" /></Field>
                    : <Field label="Message" hint="Bold and links allowed"><Textarea rows={2} value={form.success.message} disabled={ro} onChange={(v) => upd({ success: { ...form.success, message: v } })} /></Field>}
                  <Field label="New leads start as"><Select value={form.leadStage} disabled={ro} onChange={(v) => upd({ leadStage: v })} options={[{ value: "new", label: "New" }, { value: "contacted", label: "Contacted" }, { value: "qualified", label: "Qualified" }]} /></Field>
                </div>
              </Card>
              <Card title="Notifications & spam">
                <div className="a-stack tight">
                  <Toggle checked={form.notify.team} disabled={ro} onChange={(v) => upd({ notify: { ...form.notify, team: v } })} label="Email the team" hint="Uses the team list in Chat Settings → Email" />
                  <Toggle checked={form.notify.autoReply} disabled={ro} onChange={(v) => upd({ notify: { ...form.notify, autoReply: v } })} label="Send the visitor a confirmation email" />
                  <Field label="Also notify (comma separated)"><Input value={(form.notify.extraEmails || []).join(", ")} disabled={ro} onChange={(v) => upd({ notify: { ...form.notify, extraEmails: v.split(",").map((x) => x.trim()).filter(Boolean) } })} placeholder="sales@kibo360.in" /></Field>
                  <Toggle checked={form.spam.honeypot} disabled={ro} onChange={(v) => upd({ spam: { ...form.spam, honeypot: v } })} label="Invisible spam trap (honeypot)" />
                  <Field label="Reject submissions faster than (seconds)" hint="Bots submit instantly; people take a few seconds."><Input type="number" min="0" max="60" value={form.spam.minSeconds} disabled={ro} onChange={(v) => upd({ spam: { ...form.spam, minSeconds: Number(v) || 0 } })} /></Field>
                </div>
              </Card>
            </div>
            <Card title="Preview" subtitle="How the form looks on the website (submitting is disabled here).">
              <div style={{ maxWidth: 720 }}>
                <ContentProvider initial={{ mode: "edit", docs: { forms: { forms } }, version: "preview" }}>
                  <FormRenderer key={JSON.stringify(form)} formId={form.id} />
                </ContentProvider>
              </div>
            </Card>
            {form.id !== "demo" && !usage[form.id]?.length && (
              <Alert tone="info">To show this form, open a page in the <Link to="/admin/pages">visual editor</Link>, add a <strong>Form</strong> section and choose “{form.name}”.</Alert>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldsEditor({ form, ro, onChange }) {
  const [open, setOpen] = useState(null);
  const fields = form.fields;
  const upd = (i, patch) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i, d) => { const n = [...fields]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const add = () => {
    const id = fieldId("New field", fields.map((f) => f.id));
    onChange([...fields, { id, _k: id, type: "text", label: "New field", placeholder: "", help: "", required: false, width: "full", mapTo: "" }]);
    setOpen(id);
  };
  return (
    <Card title="Fields" actions={!ro && <Button size="sm" icon="plus" onClick={add}>Add field</Button>}>
      <div className="a-rows">
        {fields.map((f, i) => (
          <div key={f._k || f.id} className="a-rowcard">
            <div className="a-rowcard-head">
              <span className="a-grow"><strong style={{ color: "var(--a-ink)" }}>{f.label || f.id}</strong>{f.required && <span style={{ color: "var(--a-red)" }}> *</span>} <span className="a-small a-muted">{FIELD_TYPES.find((t) => t.value === f.type)?.label} · {f.width === "half" ? "half width" : "full width"}{f.mapTo ? ` · → ${f.mapTo}` : ""}</span></span>
              <IconButton icon="up" label="Move up" disabled={ro || i === 0} onClick={() => move(i, -1)} />
              <IconButton icon="down" label="Move down" disabled={ro || i === fields.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon={open === (f._k || f.id) ? "chevronDown" : "edit"} label="Edit field" onClick={() => setOpen(open === (f._k || f.id) ? null : f._k || f.id)} />
              <IconButton icon="trash" className="danger" label="Delete field" disabled={ro || fields.length <= 1} onClick={() => onChange(fields.filter((_, j) => j !== i))} />
            </div>
            {open === (f._k || f.id) && (
              <div className="a-rowcard-body">
                <div className="a-grid-3">
                  <Field label="Label"><Input value={f.label} disabled={ro} onChange={(v) => upd(i, { label: v })} /></Field>
                  <Field label="Type"><Select value={f.type} disabled={ro} onChange={(v) => upd(i, { type: v, options: WITH_OPTIONS.includes(v) ? f.options || ["Option 1", "Option 2"] : undefined })} options={FIELD_TYPES} /></Field>
                  <Field label="Saved on lead as"><Select value={f.mapTo || ""} disabled={ro} onChange={(v) => upd(i, { mapTo: v })} options={MAP_TO} /></Field>
                </div>
                {!["hidden", "consent", "timeslots", "checkbox", "radio"].includes(f.type) && (
                  <div className="a-grid-2">
                    <Field label="Placeholder"><Input value={f.placeholder} disabled={ro} onChange={(v) => upd(i, { placeholder: v })} /></Field>
                    <Field label="Help text"><Input value={f.help} disabled={ro} onChange={(v) => upd(i, { help: v })} /></Field>
                  </div>
                )}
                {WITH_OPTIONS.includes(f.type) && (
                  <Field label="Options (one per line)"><Textarea rows={4} value={(f.options || []).join("\n")} disabled={ro} onChange={(v) => upd(i, { options: v.split("\n") })} /></Field>
                )}
                {f.type === "timeslots" && (
                  <div className="a-grid-2">
                    <Field label="Minimum picks"><Input type="number" min="0" max="10" value={f.min ?? 2} disabled={ro} onChange={(v) => upd(i, { min: Number(v) })} /></Field>
                    <Field label="Maximum picks"><Input type="number" min="1" max="10" value={f.max ?? 3} disabled={ro} onChange={(v) => upd(i, { max: Number(v) })} /></Field>
                  </div>
                )}
                {f.type === "consent" && <Field label="Consent text" hint="Bold and links allowed, e.g. a link to /privacy-policy"><Textarea rows={2} value={f.html} disabled={ro} onChange={(v) => upd(i, { html: v })} /></Field>}
                {f.type === "hidden" && <Field label="Value" hint="Sent with every submission, e.g. a campaign name"><Input value={f.value} disabled={ro} onChange={(v) => upd(i, { value: v })} /></Field>}
                {["text", "tel", "textarea", "number"].includes(f.type) && (
                  <div className="a-grid-2">
                    <Field label="Allowed characters"><Select value={f.pattern || ""} disabled={ro} onChange={(v) => upd(i, { pattern: v })} options={[{ value: "", label: "Anything" }, { value: "letters", label: "Letters only (names)" }, { value: "digits", label: "Digits only" }, { value: "phone", label: "Phone number" }]} /></Field>
                    <Field label="Max length"><Input type="number" min="1" max="5000" value={f.maxLength || ""} disabled={ro} onChange={(v) => upd(i, { maxLength: v ? Number(v) : undefined })} /></Field>
                  </div>
                )}
                <div className="a-row">
                  <Check checked={f.required} disabled={ro} onChange={(v) => upd(i, { required: v })} label="Required" />
                  <Check checked={f.width === "half"} disabled={ro} onChange={(v) => upd(i, { width: v ? "half" : "full" })} label="Half width (two per row)" />
                  <span className="a-spacer" />
                  <Field label="Field ID"><Input value={f.id} disabled={ro} onChange={(v) => upd(i, { id: v.replace(/[^A-Za-z0-9_]/g, "").slice(0, 40), _k: f._k || f.id })} style={{ width: 160 }} /></Field>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
