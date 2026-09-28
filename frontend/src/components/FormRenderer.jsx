import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useCms } from "../cms/content.jsx";
import { useDemoModal } from "./DemoModalContext.jsx";
import { sanitizeHtml } from "../cms/sanitize.js";
import { getAttribution, trackLead } from "../cms/tracking.js";
import { API_BASE } from "../lib/apiBase.js";

// Fallback when no published form definitions are available (e.g. the API was
// unreachable during a static build). Mirrors the server's default "demo" form.
const SLOTS = ["10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"];
export const FALLBACK_FORMS = [{
  id: "demo", name: "Book a Demo", submitLabel: "Send Message", enabled: true,
  success: { mode: "redirect", redirect: "/thank-you", message: "" },
  fields: [
    { id: "name", type: "text", label: "Full Name", placeholder: "Dr. A. Sharma", required: true, width: "half", pattern: "letters" },
    { id: "email", type: "email", label: "Email", placeholder: "you@example.com", required: true, width: "half" },
    { id: "phone", type: "tel", label: "Phone", placeholder: "+91-98xxxxxxx", width: "half", pattern: "phone" },
    { id: "organization", type: "text", label: "Organization", placeholder: "Hospital / Clinic name", width: "half" },
    { id: "preferredDate", type: "date", label: "Preferred demo date", width: "full" },
    { id: "preferredTimes", type: "timeslots", label: "Preferred time slots", help: "pick 2-3 - if one is busy, our team uses your next choice", width: "full", options: SLOTS, min: 2, max: 3 },
    { id: "product", type: "select", label: "I'm interested in", width: "full", options: ["General enquiry", "Hospital Management Software (HMS)", "Clinic Management Software (CMS)", "Partnership"] },
    { id: "message", type: "textarea", label: "Message", placeholder: "Tell us about your requirements - beds, departments, locations…", required: true, width: "full" },
  ],
}];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+]?[0-9][0-9\s\-().]{6,}$/;

function filterInput(field, value) {
  if (field.pattern === "letters") return value.replace(/[^A-Za-z .'-]/g, "");
  if (field.pattern === "digits") return value.replace(/\D/g, "");
  if (field.pattern === "phone" || field.type === "tel") return value.replace(/[^0-9+\-\s().]/g, "");
  return value;
}

function validate(form, values) {
  const errs = {};
  for (const f of form.fields) {
    const v = values[f.id];
    const empty = v == null || v === "" || (Array.isArray(v) && !v.length) || v === false;
    const label = f.label || f.id;
    if (empty) { if (f.required) errs[f.id] = f.type === "consent" ? "Please accept to continue." : `${label} is required.`; continue; }
    if (f.type === "email" && !EMAIL_RE.test(String(v).trim())) errs[f.id] = "A valid email is required.";
    if ((f.type === "tel" || f.pattern === "phone") && !PHONE_RE.test(String(v).trim())) errs[f.id] = "Please enter a valid phone number (digits only).";
    if (f.pattern === "letters" && !/^[A-Za-z][A-Za-z .'-]*$/.test(String(v).trim())) errs[f.id] = `${label} can contain letters only.`;
    if (f.type === "timeslots" && v.length && v.length < (f.min || 0)) errs[f.id] = `Please select ${f.min}-${f.max || 3} time slots, so we have a backup if one is busy.`;
  }
  return errs;
}

export default function FormRenderer({ formId = "demo", className = "contact-form" }) {
  const { docs, mode } = useCms();
  const forms = docs.forms?.forms?.length ? docs.forms.forms : FALLBACK_FORMS;
  const form = forms.find((f) => f.id === formId && f.enabled !== false) || (formId === "demo" ? FALLBACK_FORMS[0] : null);
  // Selects without a placeholder start on their first option (e.g. the demo
  // form's "I'm interested in" preselects "General enquiry", as before).
  const [values, setValues] = useState(() => {
    const init = {};
    for (const f of form?.fields || []) if (f.type === "select" && !f.placeholder && f.options?.length) init[f.id] = f.options[0];
    return init;
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [done, setDone] = useState(null);
  const [hp, setHp] = useState("");
  const startedAt = useRef(0);
  const navigate = useNavigate();
  const { closeDemo } = useDemoModal();
  useEffect(() => { startedAt.current = Date.now(); }, []);

  if (!form) return mode === "edit" ? <p className="muted">Form "{formId}" is not published yet.</p> : null;
  const editAttrs = mode === "edit" ? { "data-kibo-region": "form", "data-kibo-form": form.id } : {};

  if (done) {
    return (
      <div className="form-success" role="status" {...editAttrs}>
        <span className="form-success-icon"><Icon name="check" size={30} strokeWidth={2.4} /></span>
        <p dangerouslySetInnerHTML={{ __html: sanitizeHtml(done, { mode: "inline" }) }} />
      </div>
    );
  }

  const set = (f, v) => setValues((s) => ({ ...s, [f.id]: v }));
  const toggleSlot = (f, t) => setValues((s) => {
    const cur = s[f.id] || [];
    const next = cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= (f.max || 3) ? cur : [...cur, t];
    return { ...s, [f.id]: next };
  });

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "edit") return;
    const errs = validate(form, values);
    if (Object.keys(errs).length) { setErrors(errs); setStatus("error"); return; }
    setStatus("sending");
    setErrors({});
    try {
      const res = await fetch(`${API_BASE}/api/forms/${encodeURIComponent(form.id)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // time spent on the form, measured locally - never compared with the
        // server's clock (a visitor's fast clock must not block real leads)
        body: JSON.stringify({ values, context: getAttribution(), hp, elapsedMs: Date.now() - startedAt.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        trackLead(form.id);
        setValues({});
        setStatus("idle");
        const success = data.success || form.success || {};
        if (success.mode === "message") { setDone(success.message || "Thank you!"); return; }
        closeDemo();
        navigate(success.redirect || "/thank-you");
      } else {
        setErrors(data.errors || { _global: data.error || "Something went wrong. Please try again." });
        setStatus("error");
      }
    } catch {
      setErrors({ _global: "Could not reach the server. Please try again, or call us directly." });
      setStatus("error");
    }
  };

  // Group consecutive half-width fields into two-column rows.
  const rows = [];
  for (const f of form.fields) {
    if (f.type === "hidden") continue;
    const last = rows[rows.length - 1];
    if (f.width === "half" && last && last.half && last.fields.length < 2) last.fields.push(f);
    else rows.push({ half: f.width === "half", fields: [f] });
  }

  const renderField = (f) => {
    const err = errors[f.id];
    const common = { name: f.id, "aria-invalid": !!err, required: f.required || undefined };
    const label = <>{f.label}{f.required ? " *" : ""}</>;
    const errEl = err && <span className="field-error" role="alert">{err}</span>;
    const v = values[f.id];
    switch (f.type) {
      case "textarea":
        return <label key={f.id}>{label}<textarea rows="5" value={v || ""} placeholder={f.placeholder} maxLength={f.maxLength || 5000} onChange={(e) => set(f, e.target.value)} {...common} />{errEl}</label>;
      case "select":
        return (
          <label key={f.id}>{label}
            <select value={v || ""} onChange={(e) => set(f, e.target.value)} {...common}>
              {(f.placeholder || !f.options?.length) && <option value="">{f.placeholder || "Please choose…"}</option>}
              {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>{errEl}
          </label>
        );
      case "radio":
        return (
          <fieldset key={f.id} className="form-choices"><legend>{label}</legend>
            {(f.options || []).map((o) => <label key={o} className="choice"><input type="radio" name={f.id} checked={v === o} onChange={() => set(f, o)} /> {o}</label>)}{errEl}
          </fieldset>
        );
      case "checkbox":
        return (
          <fieldset key={f.id} className="form-choices"><legend>{label}</legend>
            {(f.options || []).map((o) => (
              <label key={o} className="choice"><input type="checkbox" checked={(v || []).includes(o)} onChange={(e) => set(f, e.target.checked ? [...(v || []), o] : (v || []).filter((x) => x !== o))} /> {o}</label>
            ))}{errEl}
          </fieldset>
        );
      case "consent":
        return (
          <label key={f.id} className="choice consent">
            <input type="checkbox" checked={!!v} onChange={(e) => set(f, e.target.checked)} {...common} />
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(f.html || f.label, { mode: "inline" }) }} />{errEl}
          </label>
        );
      case "timeslots":
        return (
          <div key={f.id} className="slot-field">
            <span className="slot-label">{f.label}{f.help && <> <em>({f.help})</em></>}</span>
            <div className="slot-pills" role="group" aria-label={`${f.label} (select ${f.min ?? 2} to ${f.max || 3})`}>
              {(f.options || []).map((t) => {
                const active = (v || []).includes(t);
                return <button key={t} type="button" className={active ? "active" : ""} aria-pressed={active} disabled={!active && (v || []).length >= (f.max || 3)} onClick={() => toggleSlot(f, t)}>{t}</button>;
              })}
            </div>{errEl}
          </div>
        );
      case "date":
        return (
          <label key={f.id}>{label}
            <input type="date" value={v || ""} onChange={(e) => set(f, e.target.value)} ref={(el) => { if (el) el.min = new Date().toISOString().slice(0, 10); }} {...common} />{errEl}
          </label>
        );
      default: {
        const type = { email: "email", tel: "tel", number: "number", url: "url" }[f.type] || "text";
        return (
          <label key={f.id}>{label}
            <input type={type} inputMode={f.type === "tel" ? "tel" : undefined} value={v || ""} placeholder={f.placeholder} maxLength={f.maxLength || 300} onChange={(e) => set(f, filterInput(f, e.target.value))} {...common} />{errEl}
          </label>
        );
      }
    }
  };

  return (
    <form className={className} onSubmit={submit} noValidate {...editAttrs}>
      {/* honeypot: invisible to people, irresistible to bots */}
      <input type="text" name="kibo-hp-field" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0 }} />
      {rows.map((r, i) => (r.half ? <div className="form-row" key={i}>{r.fields.map(renderField)}</div> : renderField(r.fields[0])))}
      {errors._global && <p className="field-error" role="alert">{errors._global}</p>}
      <button className="btn btn-primary btn-lg" type="submit" disabled={status === "sending" || mode === "edit"}>
        {status === "sending" ? "Sending…" : form.submitLabel || "Submit"}
      </button>
    </form>
  );
}
