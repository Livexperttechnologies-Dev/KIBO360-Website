import { useState } from "react";
import { Link } from "react-router-dom";
import Icon, { ICON_NAMES } from "../../components/Icon.jsx";
import { BLOCKS } from "../../cms/blocks.jsx";
import { mediaUrl, upload } from "../api.js";
import { Alert, Badge, Button, Check, Field, I, Input, Select, Textarea, Toggle, timeAgo, useToast, Counter } from "../ui.jsx";
import { getField, siteSection, describeChanges, imageValue } from "../docOps.js";

// ---------------------------------------------------------------------------
// Right-hand panel: settings for whatever is selected on the page.
// ---------------------------------------------------------------------------

const ACTIONS = [
  { value: "link", label: "Go to a page or website" },
  { value: "demo", label: "Open the “Book a demo” form" },
  { value: "tel", label: "Call a phone number" },
  { value: "mailto", label: "Send an email" },
  { value: "whatsapp", label: "Open WhatsApp chat" },
  { value: "none", label: "No action (label only)" },
];
const STYLES = [
  { value: "", label: "Keep design default" },
  { value: "primary", label: "Primary (filled)" },
  { value: "outline", label: "Outline" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Current value of the selected field (draft override, else what the page showed). */
function useValue(ctx, sel) {
  const cur = sel?.key ? getField(ctx.store.working[sel.docId], sel.docId, sel.key) : undefined;
  return { value: cur !== undefined ? cur : sel?.value, overridden: cur !== undefined };
}

export default function Inspector({ ctx }) {
  const { sel } = ctx;
  if (!sel) return <PageSummary ctx={ctx} />;
  // keyed by the selected field so local input state never carries over
  const selKey = `${sel.docId}|${sel.key || sel.item?.id || sel.section?.id || sel.region || ""}`;
  const body = (() => {
    switch (sel.kind) {
      case "text": return <TextInspector ctx={ctx} sel={sel} />;
      case "rich": return <RichInspector ctx={ctx} sel={sel} />;
      case "img": return <ImageInspector ctx={ctx} sel={sel} />;
      case "btn": return <ButtonInspector ctx={ctx} sel={sel} />;
      case "icon": return <IconInspector ctx={ctx} sel={sel} />;
      case "video": return <VideoInspector ctx={ctx} sel={sel} />;
      case "item": return null;
      case "section": return <SectionInspector ctx={ctx} section={sel.section} />;
      case "region": return <RegionInspector ctx={ctx} sel={sel} />;
      default: return null;
    }
  })();
  return (
    <>
      <div className="ed-insp-title">
        <I n={{ text: "edit", rich: "edit", img: "image", btn: "cursor", icon: "sparkle", video: "video", item: "layers", section: "layers", region: "layout" }[sel.kind] || "edit"} />
        <h3>{sel.kind === "section" ? "Section" : sel.label}</h3>
        <Button size="sm" variant="ghost" icon="x" onClick={() => { ctx.select(null); ctx.frame()?.contentWindow?.postMessage({ source: "kibo-admin", type: "deselect" }, window.location.origin); }} aria-label="Close" />
      </div>
      {sel.docId === "site" && <Alert tone="info">Part of the site-wide header / footer - changes appear on every page.</Alert>}
      <div key={selKey} className="a-stack">{body}</div>
      {sel.href && sel.kind !== "btn" && <LinkInfo ctx={ctx} href={sel.href} />}
      {sel.item && sel.kind !== "section" && <ItemActions ctx={ctx} item={sel.item} />}
      {sel.section && sel.kind !== "section" && (
        <div className="ed-crumbs">In section <button type="button" className="a-btn a-btn-ghost a-btn-sm" onClick={() => ctx.select({ kind: "section", section: sel.section, label: sel.section.label, docId: sel.section.docId })}>{sel.section.label} <I n="chevronRight" size={12} /></button></div>
      )}
    </>
  );
}

function ResetButton({ ctx, sel, overridden }) {
  if (!overridden || ctx.readonly) return null;
  return <Button size="sm" variant="ghost" icon="refresh" onClick={() => ctx.setValue(sel.docId, sel.key, null, "Reset to original")}>Reset to original</Button>;
}

function TextInspector({ ctx, sel }) {
  const { value, overridden } = useValue(ctx, sel);
  const isHeading = /Heading/.test(sel.label);
  return (
    <>
      <p className="a-muted a-small">Type directly on the page - the layout and styling stay exactly as designed. Press <span className="a-kbd">Enter</span> to finish, <span className="a-kbd">Esc</span> to cancel.</p>
      <Field label="Text" counter={isHeading ? <Counter value={value} max={90} /> : null}>
        <Textarea value={typeof value === "string" ? value : ""} rows={isHeading ? 2 : 4} disabled={ctx.readonly} onChange={(v) => ctx.setValue(sel.docId, sel.key, v.replace(/\n+/g, " "), `Edit ${sel.label.toLowerCase()}`)} />
      </Field>
      {typeof value === "string" && !value && <Alert tone="warn">This text is empty, so it is hidden on the live site.</Alert>}
      <ResetButton ctx={ctx} sel={sel} overridden={overridden} />
    </>
  );
}

function RichInspector({ ctx, sel }) {
  const { overridden } = useValue(ctx, sel);
  return (
    <>
      <p className="a-muted a-small">Click the text on the page to edit it. Select words to make them <strong>bold</strong>, <em>italic</em> or a link using the toolbar that appears above the text.</p>
      <div className="a-stack tight a-small">
        <div><span className="a-kbd">Ctrl</span> + <span className="a-kbd">B</span> bold · <span className="a-kbd">Ctrl</span> + <span className="a-kbd">I</span> italic · <span className="a-kbd">Ctrl</span> + <span className="a-kbd">K</span> link</div>
        {sel.mode === "block" ? <div>This area supports headings, bullet and numbered lists and quotes.</div> : <div><span className="a-kbd">Shift</span> + <span className="a-kbd">Enter</span> adds a line break.</div>}
        <div className="a-muted">Pasted text is cleaned automatically - fonts and colours from Word or Google Docs are removed so the page style stays consistent.</div>
      </div>
      <ResetButton ctx={ctx} sel={sel} overridden={overridden} />
    </>
  );
}

function ImageInspector({ ctx, sel }) {
  const { value, overridden } = useValue(ctx, sel);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const img = value && typeof value === "object" ? value : {};
  const set = (patch, label = "Edit image") => ctx.setValue(sel.docId, sel.key, { ...img, t: "img", ...patch }, label);
  const pick = async () => {
    const item = await ctx.openMedia({ kind: "image" });
    if (item) set(imageValue(item, img), "Replace image");
  };
  const uploadNew = async (file) => {
    if (!file) return;
    setBusy(true);
    try { const r = await upload("/api/admin/media", file, { alt: img.alt || "" }); set(imageValue(r.item, img), "Replace image"); toast("Image uploaded and placed"); } catch (e) { toast(e.message, { tone: "error" }); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="ed-img-prev">{img.src ? <img src={mediaUrl(img.src)} alt="" /> : <I n="image" size={30} />}</div>
      {!ctx.readonly && (
        <div className="a-row">
          <Button size="sm" variant="primary" icon="image" onClick={pick}>Choose from library</Button>
          {ctx.can("media.upload") && (
            <label className="a-btn a-btn-sm" style={{ cursor: "pointer" }}>
              {busy ? <span className="a-spin" /> : <I n="upload" size={14} />}<span>Upload</span>
              <input type="file" accept="image/*" hidden onChange={(e) => uploadNew(e.target.files?.[0])} />
            </label>
          )}
        </div>
      )}
      <p className="a-hint">Tip: you can also drag an image file from your computer straight onto the picture on the page.</p>
      <Field label="Alt text (describe the image)" hint="Read by screen readers and used by Google Images. Leave empty only for purely decorative images." counter={<Counter value={img.alt} max={125} />} error={!img.alt ? "Missing alt text" : null}>
        <Input value={img.alt} disabled={ctx.readonly} onChange={(v) => set({ alt: v }, "Edit alt text")} placeholder="e.g. Doctor reviewing patient records on a tablet" />
      </Field>
      <Field label="Title (tooltip, optional)">
        <Input value={img.title} disabled={ctx.readonly} onChange={(v) => set({ title: v })} />
      </Field>
      {img.width && img.height && <p className="a-hint">{img.width} × {img.height}px{img.srcset?.length ? ` · ${img.srcset.length} responsive WebP sizes` : ""}</p>}
      <ResetButton ctx={ctx} sel={sel} overridden={overridden} />
    </>
  );
}

function ButtonInspector({ ctx, sel }) {
  const { value, overridden } = useValue(ctx, sel);
  const b = { t: "btn", action: "link", ...(value || {}) };
  const set = (patch, label = "Edit button") => ctx.setValue(sel.docId, sel.key, { ...b, ...patch }, label);
  const hrefLabel = b.action === "tel" ? "Phone number link" : b.action === "mailto" ? "Email link" : "Link to";
  const hrefPlaceholder = b.action === "tel" ? "tel:+918008005672" : b.action === "mailto" ? "mailto:support@kibo360.in" : "/contact or https://…";
  const internal = b.action === "link" && typeof b.href === "string" && b.href.startsWith("/") && !b.href.startsWith("//");
  return (
    <>
      <p className="a-muted a-small">Click the button on the page to change its text directly, or use the fields below.</p>
      <Field label="Button text" counter={<Counter value={b.label} max={40} />}>
        <Input value={b.label} disabled={ctx.readonly} onChange={(v) => set({ label: v }, "Edit button text")} />
      </Field>
      <Field label="When clicked">
        <Select value={b.action} disabled={ctx.readonly} onChange={(v) => set({ action: v, href: v === "tel" ? "tel:" : v === "mailto" ? "mailto:" : v === "link" ? b.href?.startsWith("/") || b.href?.startsWith("http") ? b.href : "/" : undefined })} options={ACTIONS} />
      </Field>
      {["link", "tel", "mailto"].includes(b.action) && (
        <Field label={hrefLabel} hint={b.action === "link" ? "Pick a page or paste a full web address." : null}>
          <Input value={b.href} disabled={ctx.readonly} list="ed-pages" placeholder={hrefPlaceholder} onChange={(v) => set({ href: v })} />
          <datalist id="ed-pages">{ctx.pages.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}</datalist>
        </Field>
      )}
      {b.action === "link" && <Check checked={b.newTab} disabled={ctx.readonly} onChange={(v) => set({ newTab: v || undefined })} label="Open in a new tab" />}
      <Field label="Style">
        <Select value={b.style || ""} disabled={ctx.readonly} onChange={(v) => set({ style: v || undefined })} options={STYLES} />
      </Field>
      {internal && <Button size="sm" variant="ghost" icon="external" onClick={() => ctx.goPage(b.href.split("#")[0].split("?")[0])}>Edit the linked page</Button>}
      <ResetButton ctx={ctx} sel={sel} overridden={overridden} />
    </>
  );
}

function IconInspector({ ctx, sel }) {
  const { value, overridden } = useValue(ctx, sel);
  const [q, setQ] = useState("");
  const name = value?.name;
  const names = ICON_NAMES.filter((n) => !["menu", "close", "chevron-down", "chevron-left", "chevron-right"].includes(n) && n.includes(q.toLowerCase()));
  return (
    <>
      <Input value={q} onChange={setQ} placeholder="Search icons…" />
      <div className="ed-icons">
        {names.map((n) => (
          <button key={n} type="button" title={n} className={n === name ? "on" : ""} disabled={ctx.readonly} onClick={() => ctx.setValue(sel.docId, sel.key, { t: "icon", name: n }, "Change icon")}>
            <Icon name={n} size={20} />
          </button>
        ))}
      </div>
      <ResetButton ctx={ctx} sel={sel} overridden={overridden} />
    </>
  );
}

function parseVideo(raw) {
  const s = String(raw || "").trim();
  let m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/.exec(s);
  if (m) return { provider: "youtube", id: m[1] };
  m = /vimeo\.com\/(?:video\/)?(\d{4,15})/.exec(s);
  if (m) return { provider: "vimeo", id: m[1] };
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { provider: "youtube", id: s };
  return null;
}

function VideoInspector({ ctx, sel }) {
  const { value, overridden } = useValue(ctx, sel);
  const v = value || {};
  const [url, setUrl] = useState(v.provider === "youtube" ? `https://youtu.be/${v.id}` : v.provider === "vimeo" ? `https://vimeo.com/${v.id}` : "");
  const [err, setErr] = useState("");
  const set = (patch, label = "Edit video") => ctx.setValue(sel.docId, sel.key, { t: "video", title: v.title || "", ...v, ...patch }, label);
  return (
    <>
      <Field label="YouTube or Vimeo link" error={err} hint="Embeds use privacy-friendly players (youtube-nocookie, Vimeo DNT).">
        <div className="a-input-group">
          <Input value={url} disabled={ctx.readonly} onChange={(x) => { setUrl(x); setErr(""); }} placeholder="https://www.youtube.com/watch?v=…" />
          <Button disabled={ctx.readonly} onClick={() => { const p = parseVideo(url); if (!p) { setErr("That doesn't look like a YouTube or Vimeo link"); return; } set({ ...p, src: undefined }, "Set video"); }}>Use</Button>
        </div>
      </Field>
      <div className="a-row">
        <Button size="sm" icon="video" disabled={ctx.readonly} onClick={async () => { const item = await ctx.openMedia({ kind: "video" }); if (item) set({ provider: "file", src: item.url, id: undefined }, "Set video"); }}>Use an uploaded video</Button>
        <Button size="sm" icon="image" disabled={ctx.readonly} onClick={async () => { const item = await ctx.openMedia({ kind: "image" }); if (item) set({ poster: imageValue(item) }, "Set poster"); }}>Poster image</Button>
      </div>
      <Field label="Title (for accessibility)"><Input value={v.title} disabled={ctx.readonly} onChange={(x) => set({ title: x })} /></Field>
      <ResetButton ctx={ctx} sel={sel} overridden={overridden} />
    </>
  );
}

function LinkInfo({ ctx, href }) {
  const internal = href.startsWith("/") && !href.startsWith("//");
  const page = internal ? ctx.pages.find((p) => p.path === href.split("#")[0].split("?")[0]) : null;
  return (
    <div className="a-card" style={{ padding: 12, boxShadow: "none" }}>
      <div className="a-small a-muted">Links to</div>
      <div className="a-row between">
        <code className="a-ellipsis" style={{ maxWidth: 190 }}>{href}</code>
        {page ? <Button size="sm" variant="ghost" icon="external" onClick={() => ctx.goPage(page.path)}>Edit that page</Button> : !internal && <a className="a-btn a-btn-sm a-btn-ghost" href={href} target="_blank" rel="noopener noreferrer"><I n="external" size={14} /> Open</a>}
      </div>
    </div>
  );
}

function ItemActions({ ctx, item: picked }) {
  if (ctx.readonly) return null;
  // hidden flag from the live draft (the selection snapshot goes stale)
  const item = { ...picked, hidden: !!ctx.store.working[picked.docId]?.lists?.[picked.list]?.hidden?.[picked.id] };
  const op = (action) => ctx.doItem({ action, ...item, order: itemOrder(ctx, item) });
  return (
    <div>
      <div className="a-section-title">This item in its list</div>
      <div className="a-row">
        <Button size="sm" icon="up" onClick={() => op("up")}>Earlier</Button>
        <Button size="sm" icon="down" onClick={() => op("down")}>Later</Button>
        <Button size="sm" icon="copy" onClick={() => op("duplicate")}>Duplicate</Button>
        <Button size="sm" icon={item.hidden ? "eye" : "eyeOff"} onClick={() => op(item.hidden ? "show" : "hide")}>{item.hidden ? "Show" : "Hide"}</Button>
        {item.dup && <Button size="sm" variant="danger" icon="trash" onClick={() => op("remove")}>Delete</Button>}
      </div>
    </div>
  );
}
function itemOrder(ctx, item) {
  const doc = ctx.frame()?.contentDocument;
  if (!doc) return [];
  const seen = new Set();
  for (const el of doc.querySelectorAll("[data-kibo-item]")) if (el.dataset.kiboDoc === item.docId && el.dataset.kiboList === item.list) seen.add(el.dataset.kiboItem);
  return [...seen];
}

const BG = [{ value: "", label: "Default" }, { value: "soft", label: "Soft tint" }, { value: "brand", label: "Brand gradient (light)" }, { value: "dark", label: "Dark band" }];

function SectionInspector({ ctx, section }) {
  const s = (ctx.structure?.sections || []).find((x) => x.id === section.id) || section;
  const order = (ctx.structure?.sections || []).map((x) => x.id);
  const op = (action) => ctx.doSection({ action, docId: section.docId, id: s.id, base: s.base, order });
  const layout = ctx.store.working[section.docId]?.layout || {};
  const block = layout.blocks?.[s.id];
  const def = block ? BLOCKS[block.type] : null;
  const setOpt = (patch) => {
    if (ctx.readonly) return;
    ctx.store.update(section.docId, (d) => {
      const l = { order: [], hidden: {}, dups: {}, blocks: {}, ...(d?.layout || {}) };
      const b = { ...l.blocks[s.id], ...patch };
      for (const [k, v] of Object.entries(b)) if (v === "" || v == null) delete b[k];
      return { ...d, layout: { ...l, blocks: { ...l.blocks, [s.id]: b } } };
    }, { label: "Section settings", coalesce: `blk|${s.id}` });
  };
  const forms = ctx.store.working.forms?.forms || [];
  const isCopy = s.id !== s.base && !block;
  return (
    <>
      <div className="a-row"><strong style={{ color: "var(--a-ink)" }}>{s.label}</strong>{isCopy && <Badge tone="violet">copy</Badge>}{block && <Badge tone="blue">{def?.label || block.type}</Badge>}{s.hidden && <Badge tone="gray">hidden</Badge>}</div>
      {!ctx.readonly && (
        <div className="a-row">
          <Button size="sm" icon="up" onClick={() => op("up")}>Move up</Button>
          <Button size="sm" icon="down" onClick={() => op("down")}>Move down</Button>
          {!s.nodup && <Button size="sm" icon="copy" onClick={() => op("duplicate")}>Duplicate</Button>}
          <Button size="sm" icon={s.hidden ? "eye" : "eyeOff"} onClick={() => op(s.hidden ? "show" : "hide")}>{s.hidden ? "Show" : "Hide"}</Button>
          {(block || isCopy) && <Button size="sm" variant="danger" icon="trash" onClick={() => op("remove")}>Delete</Button>}
        </div>
      )}
      {block && (
        <>
          <div className="a-section-title">Design options</div>
          <Field label="Background"><Select value={block.bg || ""} disabled={ctx.readonly} onChange={(v) => setOpt({ bg: v })} options={BG} /></Field>
          {def?.options?.includes("align") && <Field label="Image position"><Select value={block.align || ""} disabled={ctx.readonly} onChange={(v) => setOpt({ align: v })} options={[{ value: "", label: "Image on the right" }, { value: "left", label: "Image on the left" }]} /></Field>}
          {def?.options?.includes("columns") && <Field label="Columns"><Select value={block.columns || "3"} disabled={ctx.readonly} onChange={(v) => setOpt({ columns: v })} options={["2", "3", "4"]} /></Field>}
          {def?.options?.includes("formId") && (
            <Field label="Form" hint={<Link to="/admin/forms">Manage forms in the Form Builder</Link>}>
              <Select value={block.formId || "demo"} disabled={ctx.readonly} onChange={(v) => setOpt({ formId: v })} options={forms.map((f) => ({ value: f.id, label: f.name }))} />
            </Field>
          )}
          <Field label="Anchor (optional)" hint="Lets you link straight to this section, e.g. /page#pricing">
            <Input value={block.anchor} disabled={ctx.readonly} placeholder="pricing" onChange={(v) => setOpt({ anchor: v.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40) })} />
          </Field>
        </>
      )}
      {!ctx.readonly && <Button size="sm" icon="plus" onClick={() => ctx.openBlocks(s.id)}>Add a section below</Button>}
      <p className="a-hint">Click any text, image or button inside this section on the page to edit it.</p>
    </>
  );
}

// ------------------------------------------------------------ site regions
function RegionInspector({ ctx, sel }) {
  const site = ctx.store.working.site || {};
  const ro = ctx.readonly || !ctx.can("site.edit");
  if (sel.region === "header") {
    const h = siteSection(site, "header");
    const menus = siteSection(site, "menus");
    const set = (patch) => ctx.updateSite("header", { ...h, ...patch }, "Edit header");
    return (
      <>
        <Alert tone="info">The header is shared by every page.</Alert>
        <ImagePickerField ctx={ctx} label="Logo" value={h.logo} disabled={ro} onChange={(v) => set({ logo: v })} />
        <Toggle checked={h.showCta !== false} disabled={ro} onChange={(v) => set({ showCta: v })} label="Show the header button" hint={`"${h.cta?.label || "Book a Demo"}" - click it on the page to edit`} />
        <div className="a-section-title">Menu</div>
        <div className="a-stack tight">
          {menus.header.map((m) => (
            <div key={m.id} className="a-row a-small"><I n="menu" size={12} /> <strong>{m.label}</strong> <span className="a-muted">{m.href}</span>{m.hidden && <Badge tone="gray">hidden</Badge>}{m.children?.length ? <Badge tone="violet">{m.children.length} sub-items</Badge> : null}</div>
          ))}
        </div>
        <Link className="a-btn a-btn-sm" to="/admin/site/menus"><I n="menu" size={14} /> Edit menus</Link>
      </>
    );
  }
  if (sel.region === "footer") {
    const f = siteSection(site, "footer");
    const set = (patch) => ctx.updateSite("footer", { ...f, ...patch }, "Edit footer");
    return (
      <>
        <ImagePickerField ctx={ctx} label="Footer logo" value={f.logo} disabled={ro} onChange={(v) => set({ logo: v })} />
        <Field label="Motto"><Input value={f.motto} disabled={ro} onChange={(v) => set({ motto: v })} /></Field>
        <Field label="Powered by line"><Input value={f.powered} disabled={ro} onChange={(v) => set({ powered: v })} /></Field>
        <Field label="Copyright" hint="{year} is replaced with the current year"><Input value={f.copyright} disabled={ro} onChange={(v) => set({ copyright: v })} /></Field>
        <Field label="Certification badges (one per line)" hint="Only list certifications the company actually holds.">
          <Textarea value={(f.certs || []).join("\n")} disabled={ro} onChange={(v) => set({ certs: v.split("\n").map((x) => x.trim()).filter(Boolean) })} />
        </Field>
        <Toggle checked={f.showContact !== false} disabled={ro} onChange={(v) => set({ showContact: v })} label="Show contact column" hint="Address, phone and email come from Website Settings" />
        <Toggle checked={f.showSocial !== false} disabled={ro} onChange={(v) => set({ showSocial: v })} label="Show social icons" />
        <div className="a-row">
          <Link className="a-btn a-btn-sm" to="/admin/site/menus"><I n="menu" size={14} /> Footer links</Link>
          <Link className="a-btn a-btn-sm" to="/admin/site/settings"><I n="settings" size={14} /> Contact details</Link>
        </div>
      </>
    );
  }
  if (sel.region === "banner") {
    return <><p className="a-muted">This announcement bar is managed in Banners (text, link, schedule, which pages).</p><Link className="a-btn a-btn-sm" to="/admin/site/banners"><I n="megaphone" size={14} /> Open Banners</Link></>;
  }
  if (sel.region === "form") {
    const form = (ctx.store.working.forms?.forms || []).find((f) => f.id === sel.formId);
    return (
      <>
        <p className="a-muted">This is the <strong>{form?.name || sel.formId}</strong> form. Its fields, button text, success message and notifications are managed in the Form Builder.</p>
        {form && <p className="a-small">{form.fields.length} fields · submits as “{form.submitLabel}”</p>}
        <Link className="a-btn a-btn-sm" to={`/admin/forms?form=${encodeURIComponent(sel.formId || "")}`}><I n="form" size={14} /> Open in Form Builder</Link>
      </>
    );
  }
  return null;
}

export function ImagePickerField({ ctx, label, value, onChange, disabled, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="a-row nowrap">
        <div className="ed-img-prev" style={{ width: 96, minHeight: 56, flex: "none" }}>{value?.src ? <img src={mediaUrl(value.src)} alt="" style={{ maxHeight: 56 }} /> : <I n="image" />}</div>
        <div className="a-stack tight" style={{ flex: 1 }}>
          <Button size="sm" disabled={disabled} icon="image" onClick={async () => { const item = await ctx.openMedia({ kind: "image" }); if (item) onChange(imageValue(item, value)); }}>Change</Button>
          <Input value={value?.alt} disabled={disabled} placeholder="Alt text" onChange={(v) => onChange({ ...(value || {}), t: "img", alt: v })} />
        </div>
      </div>
    </Field>
  );
}

// -------------------------------------------------------------- page info
function PageSummary({ ctx }) {
  const { store, pageDocId, entry } = ctx;
  if (!entry) {
    return <Alert tone="warn">This address is not a page on the website. Pick a page from the list at the top, or create a new one under Pages.</Alert>;
  }
  const st = store.status[pageDocId];
  const pub = store.published[pageDocId];
  const changes = describeChanges(pageDocId, pub || {}, store.working[pageDocId] || {});
  const siteChanges = describeChanges("site", store.published.site || {}, store.working.site || {});
  return (
    <>
      <div className="ed-insp-title"><I n="pages" /><h3>{entry.label}</h3></div>
      <code className="a-small">{entry.path}</code>
      <div className="m-kv">
        <dt>Live version</dt><dd>{pub ? `rev ${st?.publishedRev || "-"} · ${timeAgo(st?.publishedAt)}${st?.publishedBy?.name ? ` by ${st.publishedBy.name}` : ""}` : entry.builtin ? "Original website content" : "Not published yet"}</dd>
        <dt>Draft</dt><dd>{changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"} not live yet` : "Same as live"}{st?.draftUpdatedBy?.name ? ` · last edit by ${st.draftUpdatedBy.name} ${timeAgo(st.draftUpdatedAt)}` : ""}</dd>
        {siteChanges.length > 0 && <><dt>Header/footer</dt><dd>{siteChanges.length} site-wide change{siteChanges.length === 1 ? "" : "s"} not live yet</dd></>}
        {st?.scheduled?.length > 0 && <><dt>Scheduled</dt><dd>{new Date(st.scheduled[0].at).toLocaleString()}</dd></>}
      </div>
      {(changes.length > 0 || siteChanges.length > 0) && ctx.can(["pages.publish", "site.publish", "seo.publish"]) && (
        <Button variant="primary" icon="send" onClick={ctx.openPublish}>Review &amp; publish</Button>
      )}
      <div className="a-section-title">How to edit</div>
      <ul className="a-stack tight a-small" style={{ paddingLeft: 0 }}>
        <li><I n="edit" size={13} /> Click any heading or paragraph and type.</li>
        <li><I n="link" size={13} /> Select words to make them bold, italic or a link.</li>
        <li><I n="image" size={13} /> Click an image to replace it, or drag a file onto it.</li>
        <li><I n="cursor" size={13} /> Click a button to change its text and where it goes.</li>
        <li><I n="layers" size={13} /> Hover a section for move / duplicate / hide / add.</li>
        <li><I n="check" size={13} /> Everything autosaves as a draft. Visitors see nothing until you publish.</li>
      </ul>
    </>
  );
}
