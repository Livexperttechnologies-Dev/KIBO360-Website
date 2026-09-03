import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useDemoModal } from "./DemoModalContext.jsx";
import { products } from "../data/siteData.js";
import { API_BASE } from "../lib/apiBase.js";

const initial = {
  name: "", email: "", phone: "", organization: "", product: "General", message: "",
  preferredDate: "", preferredTimes: [],
};

export const TIME_SLOTS = [
  "10:00 AM", "11:00 AM", "12:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM",
];

export default function ContactForm() {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();
  const { closeDemo } = useDemoModal();

  const update = (e) => {
    let { name, value } = e.target;
    // Live input constraints (issue #9) - filters match validate() exactly,
    // and also catch pasted/autofilled text.
    if (name === "name") value = value.replace(/[^A-Za-z .'-]/g, "");
    if (name === "phone") value = value.replace(/[^0-9+\-\s()]/g, "");
    setForm((f) => ({ ...f, [name]: value }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    else if (!/^[A-Za-z][A-Za-z .'-]*$/.test(form.name.trim())) errs.name = "Name can contain letters only.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errs.email = "A valid email is required.";
    if (form.phone && !/^[+]?[0-9][0-9\s\-()]{6,}$/.test(form.phone.trim())) {
      errs.phone = "Please enter a valid phone number (digits only).";
    }
    if (!form.message.trim()) errs.message = "Message is required.";
    if (form.preferredTimes.length === 1) {
      errs.preferredTimes = "Please select 2-3 time slots, so we have a backup if one is busy.";
    }
    return errs;
  };

  const toggleSlot = (t) =>
    setForm((f) => ({
      ...f,
      preferredTimes: f.preferredTimes.includes(t)
        ? f.preferredTimes.filter((x) => x !== t)
        : f.preferredTimes.length >= 3
          ? f.preferredTimes // cap at 3 backup slots
          : [...f.preferredTimes, t],
    }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setStatus("error");
      return;
    }
    setStatus("sending");
    setErrors({});
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, preferredTime: form.preferredTimes.join(", ") }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setForm(initial);
        setStatus("idle");
        closeDemo(); // if we're inside the modal, close it even when already on /thank-you
        navigate("/thank-you"); // dedicated thank-you page (issue #12)
      } else {
        setErrors(data.errors || {});
        setStatus("error");
      }
    } catch {
      setErrors({ _global: "Could not reach the server. Please try again, or call us directly." });
      setStatus("error");
    }
  };

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      <div className="form-row">
        <label>
          Full Name *
          <input name="name" value={form.name} onChange={update} placeholder="Dr. A. Sharma" required aria-invalid={!!errors.name} />
          {errors.name && <span className="field-error" role="alert">{errors.name}</span>}
        </label>
        <label>
          Email *
          <input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" required aria-invalid={!!errors.email} />
          {errors.email && <span className="field-error" role="alert">{errors.email}</span>}
        </label>
      </div>

      <div className="form-row">
        <label>
          Phone
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={update}
            placeholder="+91-98xxxxxxx"
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <span className="field-error" role="alert">{errors.phone}</span>}
        </label>
        <label>
          Organization
          <input name="organization" value={form.organization} onChange={update} placeholder="Hospital / Clinic name" />
        </label>
      </div>

      <label>
        Preferred demo date
        <input
          name="preferredDate"
          type="date"
          value={form.preferredDate}
          onChange={update}
          // min is set client-side so prerendered HTML never bakes a stale
          // build date into the picker
          ref={(el) => { if (el) el.min = new Date().toISOString().slice(0, 10); }}
        />
      </label>

      <div className="slot-field">
        <span className="slot-label">
          Preferred time slots <em>(pick 2-3 - if one is busy, our team uses your next choice)</em>
        </span>
        <div className="slot-pills" role="group" aria-label="Preferred time slots (select two to three)">
          {TIME_SLOTS.map((t) => {
            const active = form.preferredTimes.includes(t);
            return (
              <button
                key={t}
                type="button"
                className={active ? "active" : ""}
                aria-pressed={active}
                disabled={!active && form.preferredTimes.length >= 3}
                onClick={() => toggleSlot(t)}
              >
                {t}
              </button>
            );
          })}
        </div>
        {errors.preferredTimes && <span className="field-error" role="alert">{errors.preferredTimes}</span>}
      </div>

      <label>
        I&apos;m interested in
        <select name="product" value={form.product} onChange={update}>
          <option value="General">General enquiry</option>
          {products.filter((p) => p.route).map((p) => (
            <option key={p.slug} value={p.short}>{p.name} ({p.short})</option>
          ))}
          <option value="Partnership">Partnership</option>
        </select>
      </label>

      <label>
        Message *
        <textarea
          name="message"
          rows="5"
          value={form.message}
          onChange={update}
          placeholder="Tell us about your requirements - beds, departments, locations…"
          required
          aria-invalid={!!errors.message}
        />
        {errors.message && <span className="field-error" role="alert">{errors.message}</span>}
      </label>

      {errors._global && <p className="field-error" role="alert">{errors._global}</p>}

      <button className="btn btn-primary btn-lg" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}
