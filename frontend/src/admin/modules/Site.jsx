import { useMemo, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { siteEntries } from "../../cms/seo.js";
import { sanitizeHtml } from "../../cms/sanitize.js";
import { useAuth } from "../AdminApp.jsx";
import { useContent } from "../store.jsx";
import { mediaUrl } from "../api.js";
import { Alert, Badge, Button, Card, Check, Empty, ErrorBox, Field, I, IconButton, Input, PageHead, Select, Spinner, Textarea, Toggle, useConfirm } from "../ui.jsx";
import { imageValue, siteSection } from "../docOps.js";
import DocBar from "../DocBar.jsx";
import { MediaPicker } from "./Media.jsx";

// ---------------------------------------------------------------------------
// Website: header & footer, menus, announcement banners, site settings.
// All of it lives in the "site" document (draft -> publish like pages).
// ---------------------------------------------------------------------------

const TABS = [
  { id: "header", label: "Header & Footer", icon: "layout" },
  { id: "menus", label: "Menus", icon: "menu" },
  { id: "banners", label: "Banners", icon: "megaphone" },
  { id: "settings", label: "Website Settings", icon: "settings" },
];
const mid = (p = "mi") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export default function Site() {
  const store = useContent();
  const { can } = useAuth();
  const tab = (useParams()["*"] || "header").split("/")[0] || "header";
  if (!store?.loaded) return <div className="a-page"><Spinner /></div>;
  if (store.error) return <div className="a-page"><ErrorBox error={store.error} onRetry={store.load} /></div>;
  const ro = !can("site.edit");
  const site = store.working.site || {};
  const set = (section, value, label) => { if (!ro) store.update("site", (d) => ({ ...(d || {}), [section]: value }), { label, coalesce: `site|${section}` }); };
  const t = TABS.find((x) => x.id === tab) || TABS[0];
  return (
    <div className="a-page">
      <PageHead title={t.label} subtitle="Site-wide elements shown on every page. Changes are drafts until published." actions={<Link className="a-btn" to="/admin/editor?path=/"><I n="eye" size={15} /> See it on the page</Link>} />
      <div className="a-tabs">
        {TABS.map((x) => <NavLink key={x.id} to={`/admin/site/${x.id}`} className={({ isActive }) => `a-tab ${isActive ? "active" : ""}`}><I n={x.icon} size={15} />{x.label}</NavLink>)}
      </div>
      <DocBar docIds={["site"]} />
      {tab === "header" && <HeaderFooter site={site} set={set} ro={ro} />}
      {tab === "menus" && <Menus site={site} set={set} ro={ro} />}
      {tab === "banners" && <Banners site={site} set={set} ro={ro} />}
      {tab === "settings" && <Settings site={site} set={set} ro={ro} />}
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
                  {!all && (
                    <div className="a-row">
                      {!b.pages?.length && <span className="a-small" style={{ color: "var(--a-amber)" }}>Pick at least one page - otherwise the banner is not shown anywhere.</span>}
                      {pages.map((p) => <Check key={p.path} checked={b.pages?.includes(p.path)} disabled={ro} onChange={(v) => upd(b.id, { pages: v ? [...(b.pages || []), p.path] : (b.pages || []).filter((x) => x !== p.path) })} label={p.label} />)}
                    </div>
                  )}
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
