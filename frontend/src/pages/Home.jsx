import { useCallback, useEffect, useRef, useState } from "react";
import Seo from "../components/Seo.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatCard from "../components/StatCard.jsx";
import CTABanner from "../components/CTABanner.jsx";
import Icon from "../components/Icon.jsx";
import { PageDoc, useCms, useListItems, Scope, useScope, joinKey } from "../cms/content.jsx";
import { T, R, Img, Btn, List, Ico, Sec } from "../cms/primitives.jsx";
import { Sections } from "../cms/sections.jsx";
import {
  ecosystemNodes, valuePillars, platformBadges,
  products, capabilityMatrix, platformStats, targetSectors,
  integrations, securityGroups, testimonials, images,
} from "../data/siteData.js";

// Home product cards - copy comes verbatim from "Kibo360 Homepage.docx"
// (Home-page only; /products and the footer keep their own copy).
const homeProductCards = [
  {
    id: "hms", name: "HMS", short: "HMS", live: true, route: "/products/hospitalmanagementsoftware", subdomain: "hms.kibo360.in",
    blurb: "Operations, Patients, Auto Updates, Billings with Data Security",
    highlights: ["Patient Access & OPD/IPD", "EMR / EHR", "Diagnostics & Pharmacy"],
  },
  {
    id: "cms", name: "CMS", short: "CMS", live: true, route: "/products/clinicalmanagementsoftware", subdomain: "cms.kibo360.in",
    blurb: "Streamline clinical operations, patient records, care workflows, and healthcare processes.",
    highlights: ["Appointments & Queue", "Doctor EMR & e-Rx", "Billing & GST Invoicing"],
  },
  { id: "erp", name: "ERP", icon: "banknote", blurb: "Manage core business operations, resources, and processes.", highlights: ["Finance & Accounting", "Procurement & Vendors", "Operations & Reporting"] },
  { id: "crm", name: "CRM", icon: "heart", subdomain: "crm.kibo360.in", blurb: "Manage customer relationships, sales, and interactions.", highlights: ["Leads & Pipeline", "Customer 360 View", "Campaigns & Follow-Ups"] },
  { id: "lis", name: "LIS", icon: "flask", subdomain: "lis.kibo360.in", blurb: "Manage laboratory processes, records, and reporting with instrument integration.", highlights: ["Sample Lifecycle", "Instrument Integration", "Smart Lab Reports"] },
  { id: "inventory", name: "Inventory", icon: "box", subdomain: "inventory.kibo360.in", blurb: "Track stock, manage inventory levels, and keep products moving efficiently.", highlights: ["Stock & Batch Tracking", "Purchase & Reorder", "Expiry Management"] },
  { id: "more", name: "And More", icon: "sparkle", moreLink: true, blurb: "Explore solutions built for other business needs as Kibo360 continues to grow." },
];

const heroBadges = [
  { id: "built-by", icon: "rocket", text: "A Platform Built By Livexpert Technologies", primary: true },
  { id: "ai", icon: "cpu", text: "AI Powered" },
  { id: "cloud", icon: "cloud", text: "Cloud Native" },
  { id: "secure", icon: "lock", text: "Secure & Compliant" },
];

const indiaReady = [
  { title: "ABHA Certified", text: "Create, verify and link ABHA health IDs directly from our healthcare products." },
  { title: "GST-Compliant Billing", text: "Tax-ready invoicing with GST built into every bill and pharmacy sale." },
  { title: "UPI & Card Payments", text: "Accept UPI and card payments through integrated payment gateways." },
  { title: "WhatsApp & SMS Reminders", text: "Appointment reminders, reports and follow-ups on the channels patients already use." },
];

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "KIBO360 Products",
  itemListElement: products
    .filter((p) => p.route)
    .map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SoftwareApplication",
        name: `KIBO360 ${p.name}`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        url: `https://kibo360.in${p.route}`,
        description: p.blurb,
      },
    })),
};

function EcosystemOrbit() {
  const nodes = useListItems("orbit", ecosystemNodes);
  const step = 360 / Math.max(1, nodes.length);
  return (
    <div>
      {/* Animated ecosystem wheel: chips pop in one by one, then revolve
          around the KIBO360 logo. Hover pauses; reduced-motion disables. */}
      <div className="orbit" aria-hidden="true">
        <div className="orbit-ring" />
        <div className="orbit-ring inner" />
        <div className="orbit-rotator">
          {nodes.map((n, i) => (
            <Scope key={n.id} k={`orbit.${n.id}`}>
              <div className="orbit-node" style={{ "--a": `${step * i - 90}deg` }}>
                <T k="label" className="orbit-chip" as="div" style={{ "--d": `${0.3 + i * 0.13}s` }}>{n.item}</T>
              </div>
            </Scope>
          ))}
        </div>
        <div className="orbit-center">
          <img src="/kibo360-logo.png" alt="KIBO360" className="orbit-logo" width="331" height="135" />
        </div>
      </div>
      <div className="orbit-fallback">
        <List k="orbit" items={ecosystemNodes}>{(node) => <T k="label">{node}</T>}</List>
      </div>
    </div>
  );
}

function ProductScroller() {
  const { mode } = useCms();
  const scrollerRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);
  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows]);
  const scrollByCard = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector(".product-card");
    const step = (card ? card.getBoundingClientRect().width : 280) + 18;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  // Auto-slide the product cards; pauses while hovering / touching and loops
  // back to the start at the end. Skipped for reduced-motion users and in the editor.
  const autoPausedRef = useRef(false);
  useEffect(() => {
    if (mode === "edit" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const iv = setInterval(() => {
      const el = scrollerRef.current;
      if (!el || autoPausedRef.current || document.hidden) return;
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 8) el.scrollTo({ left: 0, behavior: "smooth" });
      else scrollByCard(1);
    }, 3500);
    return () => clearInterval(iv);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="scroller-controls">
        <button type="button" className="scroller-arrow" aria-label="Previous products" disabled={!canPrev} onClick={() => scrollByCard(-1)}>
          <Icon name="chevron-left" size={18} strokeWidth={2.2} />
        </button>
        <button type="button" className="scroller-arrow" aria-label="Next products" disabled={!canNext} onClick={() => scrollByCard(1)}>
          <Icon name="chevron-right" size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div
        className="product-scroller compact"
        role="list"
        ref={scrollerRef}
        onScroll={updateArrows}
        onMouseEnter={() => { autoPausedRef.current = true; }}
        onMouseLeave={() => { autoPausedRef.current = false; }}
        onTouchStart={() => { autoPausedRef.current = true; }}
        onTouchEnd={() => { setTimeout(() => { autoPausedRef.current = false; }, 4000); }}
      >
        <List k="cards" items={homeProductCards}>
          {(p) => (
            <article className={`product-card ${p.live ? "" : "soon"}`} role="listitem">
              <div className="product-top">
                {p.live ? (
                  <T k="short" className="product-avatar">{p.short}</T>
                ) : (
                  <span className="product-avatar soon-avatar" aria-hidden="true"><Ico name={p.icon} size={24} /></span>
                )}
                <T k="status" className={`product-status ${p.live ? "" : "soon"}`}>{p.live ? "Live" : "Coming Soon"}</T>
              </div>
              <T k="name" as="h3">{p.name}</T>
              <R k="blurb" className="blurb">{p.blurb}</R>
              {p.highlights && (
                <div className="product-highlights">
                  <List k="highlights" items={p.highlights}>{(h) => <T k="text">{h}</T>}</List>
                </div>
              )}
              {p.subdomain && (
                <p className="product-sub">
                  <T k="subLabel">{p.live ? "Runs at" : "Will run at"}</T> <T k="subdomain" as="code">{p.subdomain}</T>
                </p>
              )}
              <div className="product-actions">
                {p.route && <Btn k="learn" className="btn btn-primary" to={p.route}>Learn More</Btn>}
                {p.moreLink ? (
                  <Btn k="more" className="btn btn-outline" to="/products">Explore All Solutions</Btn>
                ) : (
                  <Btn k="demo" className="btn btn-outline" action="demo">{p.live ? "Get a Demo" : "Get Early Access"}</Btn>
                )}
              </div>
            </article>
          )}
        </List>
      </div>
    </>
  );
}

function editItemAttrs(mode, e, listKey, docId) {
  return mode === "edit" ? { "data-kibo-item": e.id, "data-kibo-base": e.baseId, "data-kibo-list": listKey, "data-kibo-doc": docId, "data-kibo-hidden": e.hidden ? "1" : undefined } : {};
}

/** Hero badges keep their two-row layout: primary badge, then the rest. */
function HeroBadges() {
  const { mode } = useCms();
  const { docId, prefix } = useScope();
  const entries = useListItems("badges", heroBadges);
  const listKey = joinKey(prefix, "badges");
  const badge = (e) => (
    <Scope key={e.id} k={`badges.${e.id}`}>
      <span className={e.item.primary ? "hero-badge" : "hero-badge soft"} {...editItemAttrs(mode, e, listKey, docId)}>
        <Ico name={e.item.icon} size={14} /> <T k="text">{e.item.text}</T>
      </span>
    </Scope>
  );
  return (
    <div className="hero-badges">
      <div>{entries.filter((e) => e.item.primary).map(badge)}</div>
      <div>{entries.filter((e) => !e.item.primary).map(badge)}</div>
    </div>
  );
}

function SecurityGroup({ g, ...rest }) {
  return (
    <article className="sec-group" {...rest}>
      <div className="sec-group-head">
        <span className={`sec-group-icon ${g.tone}`} aria-hidden="true"><Ico name={g.icon} size={18} /></span>
        <T k="label" as="h3">{g.label}</T>
      </div>
      <ul>
        <List k="items" items={g.items}>
          {(item) => <li><Icon name="check" size={13} strokeWidth={2.4} /> <T k="text">{item}</T></li>}
        </List>
      </ul>
    </article>
  );
}

function SecurityHub() {
  const groups = useListItems("groups", securityGroups, (g) => g.key);
  const { mode } = useCms();
  const { docId, prefix } = useScope();
  const half = Math.ceil(groups.length / 2);
  const col = (list) => list.map((e) => (
    <Scope key={e.id} k={`groups.${e.id}`}>
      <SecurityGroup g={e.item} {...editItemAttrs(mode, e, joinKey(prefix, "groups"), docId)} />
    </Scope>
  ));
  return (
    <div className="security-hub">
      <div className="security-hub-col left">{col(groups.slice(0, half))}</div>
      <div className="security-core">
        <div className="core-visual" aria-hidden="true">
          <span className="core-ring" />
          <span className="core-ring r2" />
          <span className="core-ring r3" />
          <div className="core-emblem"><Icon name="shield" size={44} strokeWidth={1.5} /></div>
        </div>
        <T k="coreTitle" as="p" className="core-title">Secure by Design</T>
        <T k="coreSub" as="p" className="core-sub">Bank-grade protection at the core of every module</T>
      </div>
      <div className="security-hub-col right">{col(groups.slice(half))}</div>
    </div>
  );
}

function Marquee() {
  const { mode } = useCms();
  const items = useListItems("chips", integrations);
  return (
    <div className="marquee" aria-label="KIBO360 integrations">
      <div className="marquee-track">
        {mode === "edit" ? (
          <List k="chips" items={integrations}>{(item) => <T k="label" className="chip">{item}</T>}</List>
        ) : (
          [...items, ...items].map((e, idx) => (
            <Scope key={`${e.id}-${idx}`} k={`chips.${e.id}`}>
              <T k="label" className="chip" aria-hidden={idx >= items.length ? "true" : undefined}>{e.item}</T>
            </Scope>
          ))
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <PageDoc id="home">
      <Seo page="home" jsonLd={homeJsonLd} />
      <Sections>
        <Sec id="hero" label="Hero" noDuplicate>
          <section className="hero">
            <div className="container hero-inner">
              <div>
                <HeroBadges />
                <h1>
                  <T k="title">One Platform.</T>{" "}
                  <T k="titleHighlight" className="gradient-text">Design for Every Business.</T>
                </h1>
                <R k="text" className="hero-text">
                  Stop switching between disconnected tools. Kibo360 brings business software together on one growing platform, helping you manage operations, customers, communication, and specialised business needs from one place.
                </R>
                <div className="hero-actions">
                  <Btn k="primary" to="/products" className="btn btn-primary btn-lg">Find the Right Solution</Btn>
                  <Btn k="secondary" action="demo" className="btn btn-outline btn-lg">Book a Free Demo</Btn>
                </div>
                <R k="note" className="hero-note">One intelligent platform. Multiple solutions. Secure, scalable, and built for the future ready.</R>
              </div>
              <EcosystemOrbit />
            </div>
          </section>
        </Sec>

        <Sec id="capabilities" label="Platform capabilities">
          <section className="tight">
            <div className="container">
              <SectionHeading
                title="The Platform Your Business Needs to Get More Done."
                subtitle="When your teams spend too much time switching between systems, searching for information, and managing routine tasks, work slows down. Kibo360 brings the essential capabilities your teams need into one connected platform, helping them work faster, stay organised, and keep business moving."
              />
              <div className="trust-bar">
                <List k="items" items={platformBadges}>
                  {(b) => (
                    <div className="trust-item">
                      <span className="trust-icon" aria-hidden="true"><Ico name={b.icon} size={19} /></span>
                      <div>
                        <T k="title" as="strong">{b.title}</T>
                        <T k="text">{b.text}</T>
                      </div>
                    </div>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="about" label="About KIBO360">
          <section>
            <div className="container split">
              <div>
                <T k="eyebrow" className="eyebrow">About KIBO360</T>
                <T k="title" as="h2">Your Business Will Evolve. Your Ecosystem Should Too.</T>
                <R k="text" style={{ margin: "14px 0 24px" }}>
                  Kibo360 isn&apos;t limited to today&apos;s solutions. Our continuously expanding platform addresses new business needs, industries, and ways of working. You walk with trends; Kibo360 walks with you.
                </R>
                <Btn k="cta" to="/about" className="btn btn-outline">Discover Kibo360</Btn>
              </div>
              <div className="split-visual">
                <div className="img-wrapper">
                  <Img k="image" src={images.careTeam} alt="Care team reviewing a patient's records together" className="main-img" loading="lazy" width="900" height="675" />
                  <div className="img-overlay right">
                    <div className="overlay-header">
                      <T k="overlayTitle">Connecting Care. Empowering Life.</T>
                      <T k="overlayPill" className="pill green">Live</T>
                    </div>
                    <T k="overlay1" as="div" className="overlay-item">One patient record across OPD, IPD, lab &amp; pharmacy</T>
                    <T k="overlay2" as="div" className="overlay-item">Real-time visibility for every department</T>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="why" label="Why KIBO360">
          <section className="tight">
            <div className="container">
              <SectionHeading
                title="Why Kibo360?"
                subtitle="As your business grows, managing more systems, more teams, and more processes can quickly become complex. Kibo360 brings the right capabilities together in one connected platform, helping you reduce complexity, improve visibility, and stay in control of your business as it grows."
              />
              <div className="grid grid-3">
                <List k="pillars" items={valuePillars}>
                  {(v, { index }) => (
                    <div className="pillar-card">
                      <div className="pillar-top">
                        <span className="icon-badge" aria-hidden="true"><Ico name={v.icon} size={24} /></span>
                        <span className="pillar-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <T k="title" as="h3">{v.title}</T>
                      <R k="text">{v.text}</R>
                    </div>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="products" label="Products" noDuplicate>
          <section id="products">
            <div className="container">
              <SectionHeading
                eyebrow="Our Products"
                title="Everything You Need to Run Your Business"
                subtitle="Kibo360 brings together software for the different aspects of your business. Manage everything from teams & collaboration to inventory management, operations, and more in one place."
              />
              <ProductScroller />
              <p className="scroller-hint">
                <Btn k="allCta" to="/products" className="btn btn-primary">Explore All Solutions</Btn>
              </p>
            </div>
          </section>
        </Sec>

        <Sec id="capability" label="Capability & impact">
          <section>
            <div className="container">
              <SectionHeading eyebrow="Capability & Business Impact" title="Four strategic pillars. Measurable impact." />
              <div className="grid grid-2">
                <List k="matrix" items={capabilityMatrix} getId={(m) => m.pillar}>
                  {(m) => (
                    <article className="matrix-card">
                      <T k="pillar" as="h3">{m.pillar}</T>
                      <R k="text" style={{ fontSize: "0.92rem" }}>{m.text}</R>
                      <div className="matrix-caps">
                        <List k="caps" items={m.capabilities}>{(c) => <T k="text">{c}</T>}</List>
                      </div>
                      <p className="matrix-impact"><Icon name="trending-up" size={16} /> <T k="impact">{m.impact}</T></p>
                    </article>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="india" label="Built for India">
          <section>
            <div className="container split reverse">
              <div>
                <T k="eyebrow" className="eyebrow orange">Built for India</T>
                <T k="title" as="h2">Ready for how Indian healthcare actually runs.</T>
                <R k="text" style={{ margin: "14px 0 20px" }}>
                  From ABHA health IDs to GST invoicing and UPI payments, KIBO360 is built around the standards, schemes and workflows Indian hospitals and clinics deal with every day.
                </R>
                <div className="grid grid-2" style={{ gap: 14 }}>
                  <List k="features" items={indiaReady}>
                    {(f) => (
                      <div className="feature-card" style={{ padding: "18px 18px" }}>
                        <T k="title" as="h3" style={{ fontSize: "1rem" }}>{f.title}</T>
                        <R k="text" style={{ fontSize: "0.85rem" }}>{f.text}</R>
                      </div>
                    )}
                  </List>
                </div>
              </div>
              <div className="split-visual">
                <div className="img-wrapper">
                  <Img k="image" src={images.doctorTablet} alt="Doctor using KIBO360 on a tablet during a consultation" className="main-img" loading="lazy" width="900" height="675" />
                  <div className="img-overlay">
                    <div className="overlay-header">
                      <T k="overlayTitle">ABHA Verified</T>
                      <T k="overlayPill" className="pill green">Linked</T>
                    </div>
                    <div className="overlay-item-flex"><T k="row1Label">GST Invoice</T> <T k="row1Value" as="strong">Auto-generated</T></div>
                    <div className="overlay-item-flex"><T k="row2Label">WhatsApp Reminder</T> <T k="row2Value" as="strong">Sent</T></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="stats" label="Stats band">
          <section className="band-dark">
            <div className="container">
              <SectionHeading title="Proven at scale." subtitle="Numbers from KIBO360 deployments." />
              <div className="grid grid-5">
                <List k="stats" items={platformStats} getId={(s) => s.label}>{(s) => <StatCard value={s.value} label={s.label} />}</List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="sectors" label="Who it's for">
          <section>
            <div className="container">
              <SectionHeading
                eyebrow="Who it's for"
                title="One Platform. Different Businesses."
                subtitle="Every business has its own way of working and its own set of challenges. Kibo360 is built with that in mind, offering software solutions that work across different industries, teams, and business needs."
              />
              <div className="grid grid-5 sector-photos">
                <List k="sectors" items={targetSectors}>
                  {(s) => (
                    <figure className="sector-photo">
                      {/* alt is empty: the visible figcaption below carries the name */}
                      <Img k="image" src={s.img} alt="" loading="lazy" width="700" height="875" />
                      <figcaption>
                        <span className="sector-photo-icon" aria-hidden="true"><Ico name={s.icon} size={17} /></span>
                        <T k="name">{s.name}</T>
                      </figcaption>
                    </figure>
                  )}
                </List>
              </div>
              <R k="text" className="section-subtitle" style={{ margin: "26px auto 18px", textAlign: "center" }}>
                Whether you&apos;re running a business, managing customers, running a healthcare organisation, managing a laboratory, or handling specialised operations, Kibo360 has solutions designed to help you get the job done.
              </R>
              <p style={{ textAlign: "center", margin: "0 auto" }}>
                <Btn k="cta" to="/products" className="btn btn-outline">Find the Right Solution</Btn>
              </p>
            </div>
          </section>
        </Sec>

        <Sec id="integrations" label="Integrations">
          <section className="tight">
            <div className="container">
              <SectionHeading eyebrow="Integrations" title="Connects with everything you already use." />
            </div>
            <Marquee />
          </section>
        </Sec>

        <Sec id="security" label="Security & compliance" noDuplicate>
          <section>
            <div className="container">
              <SectionHeading
                eyebrow="Security & Compliance"
                title="Built to protect. Designed to comply."
                subtitle="Defense in depth for patient data - certified quality processes on the outside, bank-grade controls at the core."
              />
              <SecurityHub />
            </div>
          </section>
        </Sec>

        <Sec id="testimonials" label="Testimonials">
          <section>
            <div className="container">
              <SectionHeading
                eyebrow="What Teams Say"
                title="Trusted by care teams and administrators."
                subtitle="From front desk to finance, KIBO360 changes how the whole organization works."
              />
              <div className="test-grid">
                <List k="items" items={testimonials}>
                  {(t) => (
                    <figure className="test-card">
                      <span className="quote-mark" aria-hidden="true">“</span>
                      <R k="quote" as="blockquote">{t.quote}</R>
                      <figcaption className="test-user">
                        <Img k="avatar" src={t.img} alt="" className="test-avatar" loading="lazy" width="96" height="96" />
                        <div>
                          <T k="name" as="strong">{t.name}</T>
                          <T k="role">{t.role}</T>
                        </div>
                      </figcaption>
                    </figure>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="cta" label="Final call to action">
          <CTABanner
            title="You Run Your Business. We'll Handle the Software."
            text="See how KIBO360 unifies your entire organization - book a personalized demo."
            primary={{ label: "Find the Right Solution", to: "/products" }}
            secondaryLabel="Talk to Our Team"
          />
        </Sec>
      </Sections>
    </PageDoc>
  );
}
