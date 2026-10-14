import { useMemo, useState } from "react";
import { useContent } from "./store.jsx";
import { Alert, Button, Field, Input, Modal, useToast } from "./ui.jsx";
import { slugProblem } from "./editor/panels.jsx";

// ---------------------------------------------------------------------------
// Duplicate a page: a new draft page with the same design, sections and
// content. Copies of built-in pages keep that page's design; landing pages
// copy their blocks. Used from Pages & Content and from the visual editor.
// ---------------------------------------------------------------------------

/** "Spring Offer!" -> "spring-offer" (at most 60 characters, cut at a word, never ending in "-") */
export function slugify(s) {
  let t = String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "");
  if (t.length > 60) { const cut = t.lastIndexOf("-", 60); t = cut > 20 ? t.slice(0, cut) : t.slice(0, 60); }
  return t.replace(/-+$/, "");
}

/** First free address: /name, /name-2, /name-3 … */
function freeSlug(base, store) {
  for (let i = 1; i < 100; i++) {
    const s = i === 1 ? base : `${base}-${i}`;
    if (!slugProblem(s, store, null)) return s;
  }
  return base;
}

/**
 * source: { docId, label, path, builtin }
 * onCreated(path) - called with the new page's address
 */
export default function DuplicatePage({ source, onClose, onCreated }) {
  const store = useContent();
  const toast = useToast();
  const [label, setLabel] = useState(`${String(source.label).slice(0, 120 - " (copy)".length).trimEnd()} (copy)`);
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const isLive = source.builtin || !!store.published[source.docId];
  const hasDraft = store.isDirty(source.docId);
  const [from, setFrom] = useState("draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const auto = useMemo(() => { const b = slugify(label); return b ? freeSlug(`/${b}`, store) : ""; }, [label, store]);
  const value = touched ? slug : auto;
  const problem = value ? slugProblem(value, store, null) : null;
  const choose = hasDraft && isLive; // only then do draft and live differ
  // built-in pages and copies of them keep that page's design
  const template = source.builtin ? source.docId.slice(5) : store.working[source.docId]?.meta?.template;
  const keepsDesign = !!template && template !== "custom";

  const go = async () => {
    setBusy(true); setError(null);
    try {
      await store.flush(); // copy the draft exactly as it is on screen
      const r = await store.duplicatePage(source.docId, { label: label.trim(), slug: value, from: choose ? from : "draft" });
      toast("Copy created as a draft - edit it, then publish when ready");
      onCreated(store.getWorking(r.docId)?.meta?.slug || value);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };

  return (
    <Modal
      title="Duplicate page"
      onClose={onClose}
      width={600}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" icon="copy" busy={busy} disabled={!label.trim() || !value || !!problem} onClick={go}>Duplicate &amp; edit</Button></>}
    >
      <p className="a-muted">
        Makes a new page with the same design, sections and content as <strong>{source.label}</strong> ({source.path}).
        {keepsDesign ? " The copy keeps this page's design - you can change its text, images, buttons and lists, rearrange or hide sections and add new ones." : " The copy gets the same sections in the same order, ready to edit."}
      </p>
      <Field label="Name of the new page"><Input value={label} onChange={setLabel} maxLength={120} autoFocus aria-label="Name of the new page" /></Field>
      <Field label="Address (URL)" error={problem} hint={value ? `kibo360.in${value}` : "Generated from the name - you can change it"}>
        <Input value={value} onChange={(v) => { setTouched(true); setSlug(v.toLowerCase().replace(/\s+/g, "-")); }} placeholder="/landing/new-page" aria-label="Address (URL)" />
      </Field>
      {choose && (
        <>
          <div className="a-label">Copy</div>
          <div className="ed-blocks" role="radiogroup" aria-label="Which version to copy">
            {[
              { id: "draft", name: "Current draft", text: "Includes the changes that are not published yet - what you see in the editor" },
              { id: "live", name: "Live version", text: "What visitors see on the website right now" },
            ].map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={from === o.id} className="ed-block-opt" style={from === o.id ? { borderColor: "var(--a-brand)", background: "var(--a-brand-soft)" } : undefined} onClick={() => setFrom(o.id)}>
                <strong>{o.name}</strong><span>{o.text}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <Alert tone="info">
        The copy starts as a draft - nothing changes on the live website until you publish it. Its search title, description and social preview start fresh (set them in the copy&apos;s SEO settings), so the two pages don&apos;t compete in Google.
      </Alert>
      {error && <Alert tone="error">{error.message}</Alert>}
    </Modal>
  );
}
