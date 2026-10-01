import { useMemo, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { siteEntries } from "../../cms/seo.js";
import { sanitizeHtml } from "../../cms/sanitize.js";
import { useAuth } from "../AdminApp.jsx";
import { useContent } from "../store.jsx";
import { mediaUrl } from "../api.js";
import { Alert, Badge, Button, Card, Check, Counter, Empty, ErrorBox, Field, I, IconButton, Input, PageHead, Select, Spinner, Textarea, Toggle, useConfirm } from "../ui.jsx";
import { imageValue, same, siteSection } from "../docOps.js";
import DocBar from "../DocBar.jsx";
import { MediaPicker } from "./Media.jsx";

// ---------------------------------------------------------------------------
// Website: header & footer, menus, announcement banners, site settings and
// header/footer scripts. All of it lives in the "site" document (draft ->
// publish like pages). Scripts need their own permission ("site.code").
// ---------------------------------------------------------------------------

const TABS = [
  { id: "header", label: "Header & Footer", icon: "layout" },
  { id: "menus", label: "Menus", icon: "menu" },
  { id: "banners", label: "Banners", icon: "megaphone" },
  { id: "settings", label: "Website Settings", icon: "settings" },
  { id: "code", label: "Scripts & Code", icon: "code" },
];
const mid = (p = "mi") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export default function Site() {
  const store = useContent();
  const { can } = useAuth();
  const tab = (useParams()["*"] || "header").split("/")[0] || "header";
  if (!store?.loaded) return <div className="a-page"><Spinner /></div>;
  if (store.error) return <div className="a-page"><ErrorBox error={store.error} onRetry={store.load} /></div>;
  const ro = !can("site.edit");
  const roCode = !can("site.code");
  const site = store.working.site || {};
  const set = (section, value, label) => {
    if (section === "code" ? roCode : ro) return;
    store.update("site", (d) => ({ ...(d || {}), [section]: value }), { label, coalesce: `site|${section}` });
  };
  const t = TABS.find((x) => x.id === tab) || TABS[0];
  return (
    <div className="a-page">
      <PageHead
        title={t.label}
        subtitle={tab === "code" ? "Code added to the live website - tags, pixels, chat widgets, custom CSS. Drafts until published." : "Site-wide elements shown on every page. Changes are drafts until published."}
        actions={tab !== "code" && <Link className="a-btn" to="/admin/editor?path=/"><I n="eye" size={15} /> See it on the page</Link>}
      />
      <div className="a-tabs">
        {TABS.map((x) => <NavLink key={x.id} to={`/admin/site/${x.id}`} className={({ isActive }) => `a-tab ${isActive ? "active" : ""}`}><I n={x.icon} size={15} />{x.label}</NavLink>)}
      </div>
      <DocBar docIds={["site"]} />
      {tab === "header" && <HeaderFooter site={site} set={set} ro={ro} />}
      {tab === "menus" && <Menus site={site} set={set} ro={ro} />}
      {tab === "banners" && <Banners site={site} set={set} ro={ro} />}
      {tab === "settings" && <Settings site={site} set={set} ro={ro} />}
      {tab === "code" && <Scripts site={site} published={store.published.site} set={set} ro={roCode} />}
    </div>
  );
}

// ------------------------------------------------------------ small parts
export function ImageField({ label, value, onChange, disabled, hint, dark }) {
  const [open, setOpen] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="a-row nowrap">
        <div className="ed-img-prev" style={{ width: 150, minHeight: 64, flex: "none", background: dark ? "#1a0c43" : undefined }}>{value?.src ? <img src={mediaUrl(value.src)} alt="" style={{ maxHeight: 64 }} /> : <I n="image" />}</div>
        <div className="a-stack tight" style={{ flex: 1 }}>
          <Button size="sm" icon="image" disabled={disabled} onClick={() => setOpen(true)}>Change image</Button>
          <Input value={value?.alt} disabled={disabled} placeholder="Alt text" onChange={(v) => onChange({ ...(value || {}), t: "img", alt: v })} />
        </div>
      </div>
      {open && <MediaPicker kind="image" onClose={() => setOpen(false)} onSelect={(item) => { onChange(imageValue(item, value)); setOpen(false); }} />}
    </Field>
  );
}

const ACTIONS = [
  { value: "link", label: "Go to a page or website" },
  { value: "demo", label: "Open the demo form" },
  { value: "tel", label: "Call" },
  { value: "mailto", label: "Email" },
  { value: "whatsapp", label: "WhatsApp chat" },
  { value: "none", label: "No action" },
];
export function ButtonFields({ value, onChange, disabled, pages }) {
  const b = { t: "btn", action: "link", ...(value || {}) };
  const set = (patch) => onChange({ ...b, ...patch });
  return (
    <div className="a-stack tight">
      <div className="a-grid-2">
        <Field label="Button text"><Input value={b.label} disabled={disabled} onChange={(v) => set({ label: v })} /></Field>
        <Field label="When clicked"><Select value={b.action} disabled={disabled} onChange={(v) => set({ action: v, href: v === "tel" ? "tel:" : v === "mailto" ? "mailto:" : b.href })} options={ACTIONS} /></Field>
      </div>
      {["link", "tel", "mailto"].includes(b.action) && (
        <Field label="Link">
          <Input value={b.href} disabled={disabled} list="site-pages" onChange={(v) => set({ href: v })} placeholder="/contact" />
          <datalist id="site-pages">{(pages || []).map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}</datalist>
        </Field>
      )}
      {b.action === "link" && <Check checked={b.newTab} disabled={disabled} onChange={(v) => set({ newTab: v || undefined })} label="Open in a new tab" />}
    </div>
  );
}

/**
 * Tick the pages something is shown on. Paths that no longer match a page
 * (renamed or deleted) stay listed so they can be unticked, and a warning
 * shows when none of the ticked paths is a real page.
 */
function PagePicker({ value, pages, disabled, onChange, nowhere }) {
  const list = value || [];
  const known = new Set(pages.map((p) => p.path));
  const missing = list.filter((p) => p !== "*" && !known.has(p));
  const toggle = (path, on) => onChange(on ? [...list, path] : list.filter((x) => x !== path));
  return (
    <div className="a-row">
      {!list.some((p) => known.has(p)) && (
        <span className="a-small" style={{ color: "var(--a-amber)" }}>
          {missing.length ? `The ticked page${missing.length === 1 ? " no longer exists" : "s no longer exist"} - pick a page, ${nowhere}.` : `Pick at least one page - ${nowhere}.`}
        </span>
      )}
      {pages.map((p) => <Check key={p.path} checked={list.includes(p.path)} disabled={disabled} onChange={(v) => toggle(p.path, v)} label={p.label} />)}
      {missing.map((path) => <Check key={path} checked disabled={disabled} onChange={(v) => toggle(path, v)} label={`${path} (page not found)`} />)}
    </div>
  );
}

function usePages() {
  const store = useContent();
  return useMemo(() => siteEntries(store.working).map((e) => ({ path: e.path, label: e.label })), [store.working]);
}

// ---------------------------------------------------------- header/footer
function HeaderFooter({ site, set, ro }) {
  const pages = usePages();
  const h = siteSection(site, "header");
  const f = siteSection(site, "footer");
  const upH = (patch) => set("header", { ...h, ...patch }, "Edit header");
  const upF = (patch) => set("footer", { ...f, ...patch }, "Edit footer");
  const [certs, setCerts] = useState((f.certs || []).join("\n"));
  return (
    <div className="a-two">
      <Card title="Header">
        <div className="a-stack">
          <ImageField label="Logo" value={h.logo} disabled={ro} onChange={(v) => upH({ logo: v })} hint="PNG or SVG with a transparent background, about 330 × 136 px." />
          <Toggle checked={h.showCta !== false} disabled={ro} onChange={(v) => upH({ showCta: v })} label="Show the header button" />
          {h.showCta !== false && <ButtonFields value={h.cta} disabled={ro} pages={pages} onChange={(v) => upH({ cta: v })} />}
          <Link className="a-btn a-btn-sm" to="/admin/site/menus"><I n="menu" size={14} /> Edit the menu</Link>
        </div>
      </Card>
      <Card title="Footer">
        <div className="a-stack">
          <ImageField label="Footer logo" value={f.logo} dark disabled={ro} onChange={(v) => upF({ logo: v })} hint="Shown on the dark footer - use the white version." />
          <Field label="Motto"><Input value={f.motto} disabled={ro} onChange={(v) => upF({ motto: v })} /></Field>
          <Field label="Powered by line"><Input value={f.powered} disabled={ro} onChange={(v) => upF({ powered: v })} /></Field>
          <Field label="Copyright line" hint="{year} becomes the current year"><Input value={f.copyright} disabled={ro} onChange={(v) => upF({ copyright: v })} /></Field>
          <Field label="Certification badges (one per line)" hint="Only certifications the company actually holds (currently ISO 9001:2015, CMMI Level 3).">
            <Textarea rows={3} value={certs} disabled={ro} onChange={(v) => { setCerts(v); upF({ certs: v.split("\n").map((x) => x.trim()).filter(Boolean) }); }} />
          </Field>
          <Toggle checked={f.showContact !== false} disabled={ro} onChange={(v) => upF({ showContact: v })} label="Show contact details column" hint="Address, phone and email from Website Settings" />
          <Toggle checked={f.showSocial !== false} disabled={ro} onChange={(v) => upF({ showSocial: v })} label="Show social media icons" hint="Links from Website Settings → Social" />
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ menus
function MenuItems({ items, onChange, disabled, pages, depth = 0 }) {
  const confirm = useConfirm();
  const upd = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, d) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="a-rows">
      {items.map((m, i) => (
        <div key={m.id} className={`a-rowcard ${m.hidden ? "muted" : ""} ${depth ? "child" : ""}`}>
          <div className="a-kv-row" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr) auto" }}>
            <Input value={m.label} disabled={disabled} onChange={(v) => upd(i, { label: v })} placeholder="Label" aria-label="Label" />
            <Input value={m.href} disabled={disabled} list="site-pages-menu" onChange={(v) => upd(i, { href: v })} placeholder="/page or https://… (empty = plain text)" aria-label="Link" />
            <div className="a-row nowrap">
              <IconButton icon="up" label="Move up" disabled={disabled || i === 0} onClick={() => move(i, -1)} />
              <IconButton icon="down" label="Move down" disabled={disabled || i === items.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon={m.hidden ? "eyeOff" : "eye"} className={m.hidden ? "on" : ""} label={m.hidden ? "Show" : "Hide"} disabled={disabled} onClick={() => upd(i, { hidden: !m.hidden || undefined })} />
              <IconButton icon="trash" className="danger" label="Delete" disabled={disabled} onClick={async () => { if (!m.children?.length || await confirm({ title: "Delete menu item?", message: `“${m.label}” and its ${m.children.length} sub-item(s) are removed.`, danger: true, confirmLabel: "Delete" })) onChange(items.filter((_, j) => j !== i)); }} />
            </div>
          </div>
          <div className="a-row" style={{ marginTop: 6 }}>
            <Check checked={m.newTab} disabled={disabled} onChange={(v) => upd(i, { newTab: v || undefined })} label="Open in new tab" />
            {depth === 0 && <Button size="sm" variant="ghost" icon="plus" disabled={disabled} onClick={() => upd(i, { children: [...(m.children || []), { id: mid(), label: "New link", href: "/" }] })}>Add sub-item</Button>}
          </div>
          {depth === 0 && m.children?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <MenuItems items={m.children} disabled={disabled} pages={pages} depth={1} onChange={(c) => upd(i, { children: c })} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Menus({ site, set, ro }) {
  const pages = usePages();
  const menus = siteSection(site, "menus");
  const up = (patch, label = "Edit menus") => set("menus", { ...menus, ...patch }, label);
  const cols = menus.footerColumns;
  return (
    <div className="a-two">
      <Card title="Main menu" subtitle="Items with sub-items become a dropdown (desktop) and a collapsible group (mobile)." actions={!ro && <Button size="sm" icon="plus" onClick={() => up({ header: [...menus.header, { id: mid(), label: "New page", href: "/" }] })}>Add item</Button>}>
        <MenuItems items={menus.header} disabled={ro} pages={pages} onChange={(v) => up({ header: v })} />
      </Card>
      <Card title="Footer links" actions={!ro && cols.length < 6 && <Button size="sm" icon="plus" onClick={() => up({ footerColumns: [...cols, { title: "New column", items: [] }] })}>Add column</Button>}>
        <div className="a-stack">
          {cols.map((c, ci) => (
            <div key={ci} className="a-rowcard">
              <div className="a-row nowrap">
                <Input value={c.title} disabled={ro} onChange={(v) => up({ footerColumns: cols.map((x, j) => (j === ci ? { ...x, title: v } : x)) })} aria-label="Column title" />
                <IconButton icon="trash" className="danger" label="Delete column" disabled={ro} onClick={() => up({ footerColumns: cols.filter((_, j) => j !== ci) })} />
              </div>
              <div style={{ marginTop: 8 }}>
                <MenuItems items={c.items} disabled={ro} pages={pages} depth={1} onChange={(items) => up({ footerColumns: cols.map((x, j) => (j === ci ? { ...x, items } : x)) })} />
                {!ro && <Button size="sm" variant="ghost" icon="plus" onClick={() => up({ footerColumns: cols.map((x, j) => (j === ci ? { ...x, items: [...x.items, { id: mid(), label: "New link", href: "/" }] } : x)) })}>Add link</Button>}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <datalist id="site-pages-menu">{pages.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}</datalist>
    </div>
  );
}

// ---------------------------------------------------------------- banners
const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v) => (v ? new Date(v).toISOString() : undefined);
function Banners({ site, set, ro }) {
  const pages = usePages();
  const confirm = useConfirm();
  const list = siteSection(site, "banners");
  const up = (next, label = "Edit banners") => set("banners", next, label);
  const upd = (id, patch) => up(list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const now = Date.now();
  return (
    <div className="a-stack">
      <Card
        title="Announcement bars"
        subtitle="A thin bar above the header for offers, events or news. The first active banner for a page is shown."
        actions={!ro && <Button size="sm" variant="primary" icon="plus" onClick={() => up([...list, { id: mid("bn"), enabled: false, html: "New: <strong>KIBO360 CMS</strong> for clinics is here.", style: "brand", dismissible: true, pages: ["*"], link: { t: "btn", label: "Learn more", action: "link", href: "/products/clinicalmanagementsoftware" } }], "Add banner")}>New banner</Button>}
      >
        {!list.length && <Empty icon="megaphone" text="No banners yet." />}
        <div className="a-stack">
          {list.map((b) => {
            const live = b.enabled && (!b.startAt || Date.parse(b.startAt) <= now) && (!b.endAt || Date.parse(b.endAt) > now);
            const all = (b.pages ?? ["*"]).includes("*");
            return (
              <div key={b.id} className="a-rowcard">
                <div className={`announce announce-${b.style || "brand"}`} style={{ borderRadius: 8, marginBottom: 10 }}>
                  <div className="announce-inner" style={{ padding: "8px 12px" }}>
                    <span className="announce-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.html, { mode: "inline" }) }} />
                    {b.link?.label && <span className="announce-link">{b.link.label}</span>}
                    {b.dismissible !== false && <span className="announce-close">×</span>}
                  </div>
                </div>
                <div className="a-row" style={{ marginBottom: 8 }}>
                  <Toggle checked={b.enabled} disabled={ro} onChange={(v) => upd(b.id, { enabled: v })} label={b.enabled ? "On" : "Off"} />
                  {live ? <Badge tone="green">showing (after publish)</Badge> : b.enabled ? <Badge tone="blue">scheduled / ended</Badge> : <Badge tone="gray">off</Badge>}
                  <span className="a-spacer" />
                  {!ro && <IconButton icon="trash" className="danger" label="Delete banner" onClick={async () => { if (await confirm({ title: "Delete banner?", danger: true, confirmLabel: "Delete" })) up(list.filter((x) => x.id !== b.id), "Delete banner"); }} />}
                </div>
                <div className="a-stack tight">
                  <Field label="Message" hint="You can use <strong>bold</strong> and <a href=&quot;/page&quot;>links</a>. Keep it short.">
                    <Input value={b.html} disabled={ro} onChange={(v) => upd(b.id, { html: v })} />
                  </Field>
                  <div className="a-grid-3">
                    <Field label="Colour"><Select value={b.style} disabled={ro} onChange={(v) => upd(b.id, { style: v })} options={[{ value: "brand", label: "Brand gradient" }, { value: "dark", label: "Dark" }, { value: "soft", label: "Soft" }, { value: "warning", label: "Warning (amber)" }]} /></Field>
                    <Field label="Start (optional)"><Input type="datetime-local" value={toLocal(b.startAt)} disabled={ro} onChange={(v) => upd(b.id, { startAt: fromLocal(v) })} /></Field>
                    <Field label="End (optional)"><Input type="datetime-local" value={toLocal(b.endAt)} disabled={ro} onChange={(v) => upd(b.id, { endAt: fromLocal(v) })} /></Field>
                  </div>
                  <Check checked={b.dismissible !== false} disabled={ro} onChange={(v) => upd(b.id, { dismissible: v })} label="Visitors can close it" />
                  <div className="a-section-title">Button (optional)</div>
                  <ButtonFields value={b.link || { t: "btn", label: "", action: "link", href: "" }} disabled={ro} pages={pages} onChange={(v) => upd(b.id, { link: v })} />
                  <div className="a-section-title">Show on</div>
                  <Check checked={all} disabled={ro} onChange={(v) => upd(b.id, { pages: v ? ["*"] : [] })} label="All pages" />
                  {!all && <PagePicker value={b.pages} pages={pages} disabled={ro} onChange={(v) => upd(b.id, { pages: v })} nowhere="otherwise the banner is not shown anywhere" />}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------- settings
function Settings({ site, set, ro }) {
  const s = siteSection(site, "settings");
  const up = (section, patch, label = "Edit website settings") => set("settings", { ...s, [section]: { ...s[section], ...patch } }, label);
  const c = s.company;
  const a = s.analytics;
  const k = s.cookies;
  const soc = s.social;
  const ver = s.verification;
  const idOk = { ga4: /^G-[A-Z0-9]{4,16}$/, gtm: /^GTM-[A-Z0-9]{4,12}$/, clarity: /^[a-z0-9]{6,16}$/, metaPixel: /^\d{8,20}$/, linkedinPartner: /^\d{4,12}$/ };
  const bad = (key) => a[key] && !idOk[key].test(a[key]);
  return (
    <div className="a-stack">
      <div className="a-two">
        <Card title="Company & contact" subtitle="Used in the footer, contact page, buttons and structured data.">
          <div className="a-stack tight">
            <div className="a-grid-2">
              <Field label="Brand name"><Input value={c.name} disabled={ro} onChange={(v) => up("company", { name: v })} /></Field>
              <Field label="Legal name"><Input value={c.legalName} disabled={ro} onChange={(v) => up("company", { legalName: v })} /></Field>
            </div>
            <Field label="Tagline"><Input value={c.tagline} disabled={ro} onChange={(v) => up("company", { tagline: v })} /></Field>
            <div className="a-grid-2">
              <Field label="Phone"><Input value={c.phone} disabled={ro} onChange={(v) => up("company", { phone: v })} /></Field>
              <Field label="WhatsApp number" hint="Digits with country code, e.g. 918008005672"><Input value={c.whatsapp} disabled={ro} onChange={(v) => up("company", { whatsapp: v.replace(/\D/g, "") })} /></Field>
            </div>
            <div className="a-grid-2">
              <Field label="Email"><Input type="email" value={c.email} disabled={ro} onChange={(v) => up("company", { email: v })} /></Field>
              <Field label="Website"><Input value={c.website} disabled={ro} onChange={(v) => up("company", { website: v })} /></Field>
            </div>
            <Field label="Address"><Textarea rows={2} value={c.address} disabled={ro} onChange={(v) => up("company", { address: v })} /></Field>
            <Field label="Business hours"><Input value={c.hours} disabled={ro} onChange={(v) => up("company", { hours: v })} /></Field>
          </div>
        </Card>
        <div className="a-stack">
          <Card title="Branding">
            <div className="a-stack tight">
              <ImageField label="Logo (for schema / share cards)" value={s.branding.logo} disabled={ro} onChange={(v) => up("branding", { logo: v })} />
              <ImageField label="White logo" value={s.branding.logoWhite} dark disabled={ro} onChange={(v) => up("branding", { logoWhite: v })} />
              <ImageField label="Favicon" value={s.branding.favicon} disabled={ro} onChange={(v) => up("branding", { favicon: v })} hint="Square PNG or ICO, at least 48 × 48 px." />
              <p className="a-hint">The logo in the header and footer is set under Header &amp; Footer. The default share image is under SEO → Defaults.</p>
            </div>
          </Card>
          <Card title="Social media">
            <div className="a-stack tight">
              {[["linkedin", "LinkedIn"], ["facebook", "Facebook"], ["instagram", "Instagram"], ["x", "X (Twitter)"], ["youtube", "YouTube"]].map(([key, label]) => (
                <Field key={key} label={label}><Input value={soc[key]} disabled={ro} onChange={(v) => up("social", { [key]: v.trim() })} placeholder={`https://www.${key === "x" ? "x" : key}.com/…`} /></Field>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <div className="a-two">
        <Card title="Analytics & tracking" subtitle="Scripts load only on the live site. With consent required, nothing loads until the visitor accepts (DPDP / GDPR friendly).">
          <div className="a-stack tight">
            <div className="a-grid-2">
              <Field label="Google Analytics 4 ID" error={bad("ga4") ? "Looks like G-XXXXXXX" : null}><Input value={a.ga4} disabled={ro} onChange={(v) => up("analytics", { ga4: v.trim().toUpperCase() })} placeholder="G-XXXXXXXXXX" /></Field>
              <Field label="Google Tag Manager ID" error={bad("gtm") ? "Looks like GTM-XXXXXX" : null}><Input value={a.gtm} disabled={ro} onChange={(v) => up("analytics", { gtm: v.trim().toUpperCase() })} placeholder="GTM-XXXXXXX" /></Field>
              <Field label="Microsoft Clarity ID" error={bad("clarity") ? "6-16 lowercase letters/digits" : null}><Input value={a.clarity} disabled={ro} onChange={(v) => up("analytics", { clarity: v.trim().toLowerCase() })} /></Field>
              <Field label="Meta Pixel ID" error={bad("metaPixel") ? "Digits only" : null}><Input value={a.metaPixel} disabled={ro} onChange={(v) => up("analytics", { metaPixel: v.trim() })} /></Field>
              <Field label="LinkedIn Insight partner ID" error={bad("linkedinPartner") ? "Digits only" : null}><Input value={a.linkedinPartner} disabled={ro} onChange={(v) => up("analytics", { linkedinPartner: v.trim() })} /></Field>
            </div>
            <Toggle checked={a.requireConsent !== false} disabled={ro} onChange={(v) => up("analytics", { requireConsent: v })} label="Ask for cookie consent before tracking" hint="Recommended. Turning this off loads tracking for every visitor." />
            <p className="a-hint">Form submissions fire a <code>generate_lead</code> event (GA4 / GTM) and a Lead event (Meta) automatically.</p>
          </div>
        </Card>
        <Card title="Cookie banner">
          <div className="a-stack tight">
            <Toggle checked={k.enabled} disabled={ro} onChange={(v) => up("cookies", { enabled: v })} label="Show the cookie banner" hint="Shown automatically when tracking needs consent, even if this is off." />
            <Field label="Message" hint="Bold and links allowed"><Textarea rows={2} value={k.html} disabled={ro} onChange={(v) => up("cookies", { html: v })} /></Field>
            <div className="a-grid-3">
              <Field label="Accept button"><Input value={k.acceptLabel} disabled={ro} onChange={(v) => up("cookies", { acceptLabel: v })} /></Field>
              <Field label="Decline button"><Input value={k.rejectLabel} disabled={ro} onChange={(v) => up("cookies", { rejectLabel: v })} /></Field>
              <Field label="Policy link"><Input value={k.policyUrl} disabled={ro} onChange={(v) => up("cookies", { policyUrl: v })} /></Field>
            </div>
          </div>
        </Card>
      </div>
      <Card title="Search engine verification" subtitle="Paste only the verification code from each tool.">
        <div className="a-grid-3">
          {[["google", "Google Search Console"], ["bing", "Bing Webmaster"], ["yandex", "Yandex"], ["pinterest", "Pinterest"], ["facebook", "Facebook domain"]].map(([key, label]) => (
            <Field key={key} label={label}><Input value={ver[key]} disabled={ro} onChange={(v) => up("verification", { [key]: v.replace(/^.*content=["']?([^"'>\s]+).*$/i, "$1").trim() })} /></Field>
          ))}
        </div>
      </Card>
      {ro && <Alert tone="warn">View only - you need the Website edit permission to change these settings.</Alert>}
    </div>
  );
}

// --------------------------------------------------------- scripts & code
const MAX_SNIPPETS = 30;
const MAX_CODE = 50000;
const LOCATIONS = [
  { value: "head", label: "Header - inside <head>" },
  { value: "bodyStart", label: "Body start - right after <body>" },
  { value: "bodyEnd", label: "Footer - just before </body>" },
];
const locLabel = (v) => ({ head: "Header", bodyStart: "Body start", bodyEnd: "Footer" }[v] || "Header");
const VISIBLE_TAGS = new Set(["div", "iframe", "img", "p", "span", "a", "button", "section", "form", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "video", "audio", "canvas", "svg"]);
const JS_TYPE = /^(?:(?:text|application)\/(?:x-)?(?:java|ecma)script)?$/i;
const WRAP = {
  script: (c) => `<script>\n${c}\n</script>`,
  jsonld: (c) => `<script type="application/ld+json">\n${c}\n</script>`,
  style: (c) => `<style>\n${c}\n</style>`,
};
const WRAP_LABEL = { script: "<script>", jsonld: "<script type=\"application/ld+json\">", style: "<style>" };
const TRACKING = /googletagmanager|gtag\(|fbq\(|clarity\.ms|hotjar|snap\.licdn|analytics|pixel|doubleclick|tiktok|bat\.bing/i;

/**
 * Friendly checks for pasted code. Nothing here blocks saving - the code is
 * the author's responsibility - but common mistakes are pointed out early.
 * Scripts are only compiled (new Function) to find syntax errors, never run.
 */
export function lintSnippet(s, { requireConsent = true } = {}) {
  const out = [];
  const code = s.code || "";
  if (!code.trim()) return [{ tone: "info", text: "Empty - nothing is added to the website until you paste code here." }];
  let frag = null;
  try {
    const tpl = document.createElement("template");
    tpl.innerHTML = code; // inert: nothing in a template runs or loads
    frag = tpl.content;
  } catch { /* very old browser */ }
  // Markup = what the HTML parser turns into tags or comments (so JavaScript
  // like "i<items.length" without tags is still recognised as such).
  const hasMarkup = frag ? [...frag.childNodes].some((n) => n.nodeType === 1 || n.nodeType === 8) : /<[a-z!/]/i.test(code);
  if (!hasMarkup) {
    // no tags at all: work out what was pasted and offer the right wrapper
    const raw = code.trim();
    if (/^(?:G|GTM|AW|UA|DC)-[A-Z0-9-]+$/i.test(raw) || /^\d{5,}$/.test(raw) || /^[\w.-]+=[\w.-]+$/.test(raw)) {
      return [{ tone: "warn", text: "This looks like an ID, not code. Use the ready-made fields under Website Settings (Analytics, or Search engine verification), or paste the provider's full snippet including its <script> tags." }];
    }
    let kind = null;
    try { JSON.parse(raw); kind = "jsonld"; } catch { /* not JSON */ }
    if (!kind && /^(?:[^{};]+\{(?:\s*[-a-z]+\s*:\s*[^{};]+;?)*\s*\}\s*)+$/i.test(raw)) kind = "style";
    if (!kind) { try { new Function(raw); kind = "script"; } catch { /* not JavaScript either */ } } // eslint-disable-line no-new-func
    if (!kind) return [{ tone: "info", text: s.location === "head" ? "Plain text in the header is ignored - paste HTML or code with its tags." : "This is plain text - visitors see it as it is." }];
    const where = s.location === "head" ? "in the header it would be ignored" : "visitors would see it as text";
    const what = { script: "plain JavaScript", jsonld: "structured data (JSON)", style: "CSS" }[kind];
    out.push({ tone: "warn", text: `This looks like ${what} without ${WRAP_LABEL[kind]} tags - ${where}.`, fix: kind });
    return out;
  }
  // Script bodies may contain "<script" inside strings, and comments may
  // mention it - skip complete blocks the way the HTML parser does (earliest
  // match wins), then look for leftovers.
  const rest = code.replace(/<!--[\s\S]*?(?:-->|$)|<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  if (/<script\b/i.test(rest)) out.push({ tone: "error", text: "A <script> tag is missing its closing </script>." });
  else if (/<\/script\s*>/i.test(rest)) out.push({ tone: "error", text: "There is a </script> without a matching <script> tag." });
  if (frag?.querySelector("noscript")) out.push({ tone: "info", text: "<noscript> parts are left out: they are only for browsers without JavaScript, and this code only runs with JavaScript." });
  if (frag) {
    const scripts = [...frag.querySelectorAll("script")];
    scripts.forEach((el, i) => {
      const type = (el.getAttribute("type") || "").trim();
      const label = scripts.length > 1 ? `Script ${i + 1}` : "The script";
      if (/^application\/(ld\+)?json$/i.test(type)) {
        try { JSON.parse(el.textContent); } catch (e) { out.push({ tone: "error", text: `${label} is not valid JSON: ${e.message}` }); }
      } else if (JS_TYPE.test(type) && !el.hasAttribute("src") && el.textContent.trim()) {
        try { new Function(el.textContent); } catch (e) { // eslint-disable-line no-new-func
          if (e instanceof SyntaxError) out.push({ tone: "error", text: `${label} has a JavaScript error: ${e.message}` });
        }
      }
      if (/^http:\/\//i.test(el.getAttribute("src") || "")) out.push({ tone: "warn", text: `${label} loads over http:// - browsers block that on an https website. Use https://.` });
    });
    const top = [...frag.children].map((el) => el.localName);
    if (s.location === "head" && top.some((t) => VISIBLE_TAGS.has(t))) out.push({ tone: "warn", text: "Visible elements (like <div> or <iframe>) can't be shown from the header. Choose Body start or Footer for them." });
    if (s.location !== "head" && top.some((t) => t === "meta" || t === "title" || t === "base")) out.push({ tone: "warn", text: "<meta>, <title> and <base> tags only work in the header (<head>)." });
    if (s.location === "head" && top.includes("title")) out.push({ tone: "warn", text: "Page titles are set under SEO Management - a <title> here is replaced on every page." });
    const external = [...frag.querySelectorAll("form[action]")].some((f) => { try { return new URL(f.getAttribute("action"), window.location.href).origin !== window.location.origin; } catch { return false; } });
    if (external) out.push({ tone: "info", text: "This form sends its data to another website. If the website runs on the Node site server, that address must be added to its SITE_FORM_ACTION setting - ask your developer." });
  }
  if (/document\.write/.test(code)) out.push({ tone: "info", text: "Uses document.write - its output is inserted where the script is, after the page has loaded." });
  if (requireConsent && s.consent !== "analytics" && TRACKING.test(code)) out.push({ tone: "warn", text: "This looks like tracking or marketing code. Turn on “Needs cookie consent” so it only loads after the visitor accepts cookies." });
  return out;
}

function Scripts({ site, published, set, ro }) {
  const pages = usePages();
  const confirm = useConfirm();
  const list = Array.isArray(site.code?.snippets) ? site.code.snippets : [];
  const live = new Map((Array.isArray(published?.code?.snippets) ? published.code.snippets : []).map((s) => [s.id, s]));
  const requireConsent = siteSection(site, "settings").analytics?.requireConsent !== false;
  // no snippets left = no "code" section at all (the server stores it that way too)
  const up = (next, label = "Edit scripts") => set("code", next.length ? { snippets: next } : undefined, label);
  const upd = (id, patch) => up(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (i, d) => { const n = [...list]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; up(n, "Reorder scripts"); };
  const add = (location) => up([...list, { id: mid("sn"), name: `${locLabel(location)} code`, location, code: "", enabled: false, pages: ["*"], consent: "none", preview: false }], "Add script");
  const status = (s) => {
    const p = live.get(s.id);
    if (!s.enabled) return p?.enabled ? <Badge tone="amber" title="Turned off in the draft - still running on the live site until you publish">off · live until published</Badge> : <Badge tone="gray">off</Badge>;
    if (p?.enabled && same(p, s)) return <Badge tone="green">live</Badge>;
    return <Badge tone="blue" title="Goes live when the website changes are published">{p?.enabled ? "changed · publish to update" : "publish to go live"}</Badge>;
  };
  return (
    <div className="a-stack">
      <Alert tone="info">
        Code here is added to the <strong>live website</strong> after you publish - on every page, or only the pages you choose. It never runs inside Super Admin or the visual editor. To try it first, turn on “Also run on preview links” and use <strong>Preview</strong> above.
        {" "}Within each position, code runs from top to bottom.
      </Alert>
      {ro && <Alert tone="warn">View only - adding or changing code needs the “Header &amp; footer scripts” permission. Ask a Super Admin.</Alert>}
      <Card
        title="Header & footer scripts"
        subtitle="Tags, pixels, chat widgets, custom CSS or structured data. Google Analytics, Tag Manager, Clarity, Meta Pixel and LinkedIn also have ready-made fields under Website Settings."
        actions={!ro && (
          <div className="a-row nowrap">
            {LOCATIONS.map((l) => <Button key={l.value} size="sm" icon="plus" disabled={list.length >= MAX_SNIPPETS} onClick={() => add(l.value)}>{locLabel(l.value)}</Button>)}
          </div>
        )}
      >
        {!list.length && <Empty icon="code" title="No custom code yet" text="Add code for the header (<head>), the start of the page body, or the footer (before </body>)." />}
        {list.length >= MAX_SNIPPETS && <Alert tone="warn">This is the limit of {MAX_SNIPPETS} snippets - combine some of them to add more.</Alert>}
        <div className="a-stack">
          {list.map((s, i) => {
            const all = (s.pages ?? ["*"]).includes("*");
            const issues = lintSnippet(s, { requireConsent });
            return (
              <div key={s.id} className={`a-rowcard ${s.enabled ? "" : "muted"}`} data-snippet={s.id}>
                <div className="a-rowcard-head" style={{ flexWrap: "wrap" }}>
                  <Toggle checked={s.enabled} disabled={ro} onChange={(v) => upd(s.id, { enabled: v })} label={s.enabled ? "On" : "Off"} />
                  <Input className="a-grow" style={{ flex: "1 1 180px" }} value={s.name} disabled={ro} maxLength={80} aria-label="Name" placeholder="Name, e.g. Chat widget" onChange={(v) => upd(s.id, { name: v })} />
                  {status(s)}
                  <IconButton icon="up" label="Move up" disabled={ro || i === 0} onClick={() => move(i, -1)} />
                  <IconButton icon="down" label="Move down" disabled={ro || i === list.length - 1} onClick={() => move(i, 1)} />
                  {!ro && <IconButton icon="trash" className="danger" label="Delete" onClick={async () => { if (await confirm({ title: `Delete “${s.name}”?`, message: live.get(s.id)?.enabled ? "It keeps running on the live website until you publish." : undefined, danger: true, confirmLabel: "Delete" })) up(list.filter((x) => x.id !== s.id), "Delete script"); }} />}
                </div>
                <div className="a-rowcard-body">
                  <div className="a-grid-2">
                    <Field label="Where on the page"><Select value={s.location} disabled={ro} options={LOCATIONS} onChange={(v) => upd(s.id, { location: v })} /></Field>
                    <Field label="Show on">
                      <Check checked={all} disabled={ro} onChange={(v) => upd(s.id, { pages: v ? ["*"] : [] })} label="All pages" />
                    </Field>
                  </div>
                  {!all && <PagePicker value={s.pages} pages={pages} disabled={ro} onChange={(v) => upd(s.id, { pages: v })} nowhere="otherwise this code runs nowhere" />}
                  <Field label="Code" counter={<Counter value={s.code} max={MAX_CODE} />} hint="Paste the snippet exactly as the provider gives it, including the <script> tags.">
                    <textarea
                      className="a-code"
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      rows={8}
                      maxLength={MAX_CODE}
                      disabled={ro}
                      aria-label={`Code for ${s.name}`}
                      placeholder={s.location === "head" ? '<script async src="https://example.com/tag.js"></script>' : s.location === "bodyStart" ? '<div class="top-notice">…</div>' : "<script>\n  // runs at the end of the page\n</script>"}
                      value={s.code}
                      onChange={(e) => upd(s.id, { code: e.target.value })}
                    />
                  </Field>
                  {issues.map((x, k) => (
                    <Alert key={k} tone={x.tone}>
                      {x.text}
                      {x.fix && !ro && <> <Button size="sm" onClick={() => upd(s.id, { code: WRAP[x.fix](s.code.trim()) })}>Wrap in {WRAP_LABEL[x.fix]} tags</Button></>}
                    </Alert>
                  ))}
                  <div className="a-grid-2">
                    <Toggle checked={s.consent === "analytics"} disabled={ro} onChange={(v) => upd(s.id, { consent: v ? "analytics" : "none" })} label="Needs cookie consent" hint={requireConsent ? "Loads only after the visitor accepts cookies (for tracking & marketing code)." : "Consent is switched off under Website Settings → Analytics, so this loads for everyone."} />
                    <Toggle checked={!!s.preview} disabled={ro} onChange={(v) => upd(s.id, { preview: v })} label="Also run on preview links" hint="Off: only the live website runs it." />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Good to know">
        <ul className="a-small a-muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, listStyle: "disc" }}>
          <li>Code is added after the page loads. Search engines that don&apos;t run JavaScript won&apos;t see it - for site verification use Website Settings → Search engine verification.</li>
          <li>Code limited to some pages is removed when the visitor moves to another page and runs again each time they come back, like on a fresh page load. Anything it already started (for example a chat widget) keeps running until the page is reloaded.</li>
          <li>Only add code from sources you trust: it can read and change everything on the website, including what visitors type into forms.</li>
        </ul>
      </Card>
    </div>
  );
}
