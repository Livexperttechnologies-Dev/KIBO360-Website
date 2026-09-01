import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
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
  const [status, setStatus] = useState("idle"); // idle | sending | success | error
  const [errors, setErrors] = useState({});
  const successRef = useRef(null);

  // Keep keyboard/screen-reader users oriented when the form swaps to the
  // success view (the focused submit button unmounts at that moment).
  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
    // Slots are optional, but picking exactly one defeats their purpose -
    // the team needs a backup in case that slot is busy.
    if (form.preferredTimes.length === 1) {
      setErrors({ preferredTimes: "Please select 2-3 time slots, so we have a backup if one is busy." });
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
        setStatus("success");
        setForm(initial);
      } else {
        setErrors(data.errors || {});
        setStatus("error");
      }
    } catch {
      setErrors({ _global: "Could not reach the server. Is the backend running on port 5001?" });
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="form-success" role="status" tabIndex={-1} ref={successRef}>
        <span className="form-success-icon"><Icon name="check" size={30} strokeWidth={2.4} /></span>
        <h3>Thank you! Your message has been received.</h3>
        <p>Our team will get back to you within one business day.</p>
        <button className="btn btn-primary" onClick={() => setStatus("idle")}>
          Send another message
        </button>
      </div>
    );
  }

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
          <input name="phone" value={form.phone} onChange={update} placeholder="+91-98xxxxxxx" />
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
          min={new Date().toISOString().slice(0, 10)}
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
