import { useEffect, useState } from "react";
import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import CTABanner from "../components/CTABanner.jsx";
import FeatureTabs from "../components/FeatureTabs.jsx";
import FaqSection, { useFaqJsonLd } from "../components/FaqSection.jsx";
import Icon from "../components/Icon.jsx";
import { PageDoc, Scope, useCms, useListItems, useScope, joinKey, useText } from "../cms/content.jsx";
import { T, R, Img, Btn, List, Ico, Sec } from "../cms/primitives.jsx";
import { Sections } from "../cms/sections.jsx";
import { hms, integrations, roadmap, hmsFaqs } from "../data/siteData.js";

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KIBO360 Hospital Management Software (HMS)",
  alternateName: "KIBO360 HIS - Hospital Information System",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  url: "https://kibo360.in/products/hospitalmanagementsoftware",
  description: "AI-powered, cloud-native hospital management software unifying OPD/IPD, EMR/EHR, diagnostics, pharmacy, billing, finance ERP, HR & payroll and analytics on one intelligent database.",
  publisher: { "@id": "https://kibo360.in/#org" },
  offers: { "@type": "Offer", availability: "https://schema.org/InStock", url: "https://kibo360.in/contact" },
};

const itemAttrs = (mode, e, listKey, docId) =>
  mode === "edit" ? { "data-kibo-item": e.id, "data-kibo-base": e.baseId, "data-kibo-list": listKey, "data-kibo-doc": docId, "data-kibo-hidden": e.hidden ? "1" : undefined } : {};

/* One module rendered as a magazine-style "chapter": accent icon + ghost
   number, feature tag pills, a vertical workflow timeline and a stat strip. */
const CHAPTER_TONES = ["violet", "pink", "coral"];

function ModuleChapter({ mod, index, domId, ...rest }) {
  const tone = CHAPTER_TONES[index % CHAPTER_TONES.length];
  return (
    <article className="module-chapter" id={domId} {...rest}>
      <span className="chapter-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <header className="chapter-head">
        <span className={`chapter-icon ${tone}`} aria-hidden="true"><Ico name={mod.icon} size={22} /></span>
        <div>
          <T k="title" as="h3">{mod.title}</T>
          <T k="tagline" as="p" className="chapter-tagline">{mod.tagline}</T>
        </div>
      </header>
      <div className="chapter-grid">
        <div>
          <T k="featuresLabel" as="p" className="chapter-label">Key Features</T>
          <div className="ftags">
            <List k="features" items={mod.features}>
              {(f) => <span className="ftag"><Icon name="check" size={12} strokeWidth={2.6} /> <T k="text">{f}</T></span>}
            </List>
          </div>
          {mod.extra && (
            <div className="chapter-extra">
              <T k="extraHeading" as="h4">{mod.extra.heading}</T>
              <ul>
                <List k="extra" items={mod.extra.items}>{(i) => <R k="text" as="li">{i}</R>}</List>
              </ul>
            </div>
          )}
        </div>
        <div>
          <T k="workflowLabel" as="p" className="chapter-label">Workflow</T>
          <ol className="vtimeline">
            <List k="workflow" items={mod.workflow}>
              {(s, { index: i }) => (
                <li className="vt-step"><span className={`vt-num ${tone}`} aria-hidden="true">{i + 1}</span><T k="text">{s}</T></li>
              )}
            </List>
          </ol>
        </div>
      </div>
      <div className="stat-strip">
        <List k="stats" items={mod.stats} getId={(s) => s.label}>
          {(s) => (
            <div>
              <T k="value" className="stat-value gradient-text">{s.value}</T>
              <T k="label" className="stat-label">{s.label}</T>
            </div>
          )}
        </List>
      </div>
    </article>
  );
}

/* Glass dashboard mock - reference-page style with sparkline + radial chart */
function HeroDashboard() {
  return (
    <div className="mini-dash" aria-label="KIBO360 HMS dashboard preview">
      <div className="mini-dash-head">
        <T k="dashTitle" className="mini-dash-title">KIBO360 · HMS Dashboard</T>
        <div className="mini-dash-user">
          <div className="mini-dash-avatar">RS</div>
          <div>
            <T k="dashUser" as="strong">Dr. Ranveer Singh</T>
            <T k="dashRole">Administrator</T>
          </div>
        </div>
      </div>
      <div className="mini-dash-grid">
        <div className="mini-dash-card">
          <p className="k"><T k="dashCollLabel">Today&apos;s Collections</T> <T k="dashCollDelta" style={{ color: "#10b981" }}>+18.6%</T></p>
          <T k="dashColl" as="p" className="v">₹25.4 Cr</T>
          <div className="sparkline">
            <svg viewBox="0 0 100 20" className="spark-svg" aria-hidden="true">
              <defs>
                <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6C22D6" />
                  <stop offset="50%" stopColor="#E03E8F" />
                  <stop offset="100%" stopColor="#FF7555" />
                </linearGradient>
              </defs>
              <path d="M0,15 Q15,5 30,12 T60,4 T90,14 T100,5" fill="none" stroke="url(#brandGrad)" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div className="mini-dash-card flex-center">
          <div className="radial-wrapper">
            <svg viewBox="0 0 36 36" className="radial-chart" aria-hidden="true">
              <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="circle" strokeDasharray="76, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <text x="18" y="20.5" className="percentage">76%</text>
            </svg>
            <T k="dashRadial" className="radial-label">Overall Bed Occupancy</T>
          </div>
        </div>
        <List k="dashStats" items={hms.dashboardStats.slice(0, 2)} getId={(d) => d.label}>
          {(d) => (
            <div className="mini-dash-card">
              <T k="label" as="p" className="k">{d.label}</T>
              <T k="value" as="p" className="v">{d.value}</T>
              <T k="delta" as="p" className="d">{d.delta}</T>
            </div>
          )}
        </List>
      </div>
      <div className="mini-dash-rows">
        <T k="dashRowsTitle" as="h4">Active OPD Patients</T>
        <div className="booking-row"><T k="dashRow1">Rahul Sharma</T> <span className="pill violet">OPD-19</span></div>
        <div className="booking-row"><T k="dashRow2">Priya Patel</T> <span className="pill pink">OPD-20</span></div>
      </div>
    </div>
  );
}

/* 4-tab auto-rotating showcase - images on HMS page only */
const featureTabs = [
  {
    label: "Patient Access",
    title: "Zero-Friction Scheduling & Unified Queue Orchestration",
    text: "Unify walk-ins and digital bookings inside a single master queue. Keep patients informed with automatic wait-time recalibration and real-time status updates.",
    points: ["Intelligent time-slot allocation minimizes overlapping appointments.", "Automated SMS / WhatsApp reminder funnels cut no-show rates.", "80% faster registration · 60% reduced waiting time."],
    cta: "Deploy Smart Scheduling",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
    alt: "Streamlined hospital patient booking and scheduling operations",
    overlay: (
      <>
        <div className="overlay-header"><strong>Consultation Bookings</strong><span className="pill green">Auto-Sync</span></div>
        <div className="overlay-item-flex"><span>10:00 AM · Dr. Sanchita Sharma - Pediatrics</span> <span className="lbl-good">Confirmed</span></div>
        <div className="overlay-item-flex"><span>10:30 AM · Dr. Neelesh Kapoor - Gen. Medicine</span> <span className="lbl-busy">In-Queue</span></div>
      </>
    ),
  },
  {
    label: "Digital Prescription",
    title: "E-Prescriptions Optimized for Direct Clinical Workflow",
    text: "Generate highly readable, standardized digital prescriptions in seconds - synced with the patient timeline, pharmacy and lab billing modules in real time.",
    points: ["Custom quick-templates for recurring diagnostics.", "Direct sync with pharmacy dispensing and lab orders.", "Complete allergy and history checks on every prescription."],
    cta: "Deploy Digital Rx",
    image: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80",
    alt: "E-prescription system interface",
    overlay: (
      <>
        <div className="overlay-header"><span className="ohl"><Icon name="pill" size={16} /> Rx - Prescribed Treatment</span></div>
        <div className="overlay-item">Paracetamol 650mg - Post Meals - 3 Days</div>
        <div className="overlay-item">Amoxicillin 500mg - Twice Daily - 5 Days</div>
      </>
    ),
  },
  {
    label: "Patient Engagement",
    title: "Proactive Patient Retention & Digital Follow-Up",
    text: "Enable direct patient communication, automated treatment check-ins, medical record access and feedback collection through the patient portal and mobile app.",
    points: ["Interactive patient portal with self-registration.", "Automated health instructions over WhatsApp / SMS.", "92% patient satisfaction across deployments."],
    cta: "Activate Patient Portal",
    image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80",
    alt: "Patient engagement and portal software",
    overlay: (
      <>
        <div className="overlay-header"><span className="ohl"><Icon name="message" size={16} /> Patient Alerts</span></div>
        <div className="overlay-item">Your lab test report is ready. Click to download.</div>
        <div className="overlay-item">Reminder: follow-up with Dr. Sharma tomorrow, 10:30 AM.</div>
      </>
    ),
  },
  {
    label: "Practice Analytics",
    title: "Actionable Operational Intelligence",
    text: "Eliminate revenue leakage in billing procedures, monitor department utilization benchmarks and analyze clinical output trends with interactive reports.",
    points: ["Real-time tracking of collections and outstanding balances.", "35% denial reduction · 20% faster collections.", "Executive dashboards with drill-down KPIs."],
    cta: "Unlock BI Insights",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
    alt: "Clinical performance analytics dashboard",
    overlay: (
      <>
        <div className="overlay-header"><span className="ohl"><Icon name="trending-up" size={16} /> Practice Performance</span></div>
        <div className="overlay-item-flex"><span>Billing Accuracy</span> <strong>98%</strong></div>
        <div className="overlay-item-flex"><span>Collection Efficiency</span> <strong>96.8%</strong></div>
      </>
    ),
  },
];

const securityCerts = [
  { title: "ABDM & ABHA Ready", text: "Create and link ABHA health IDs and connect to India's Ayushman Bharat Digital Mission." },
  { title: "DPDP Act 2023 Aligned", text: "Patient data handling aligned with India's Digital Personal Data Protection Act." },
  { title: "NABH-Aligned Records", text: "Clinical documentation and audit trails that support NABH accreditation readiness." },
  { title: "AES-256 · RBAC · 2FA", text: "Encrypted records, role-based access, two-factor auth, audit logs, backups & disaster recovery." },
];

const heroBadges = [{ id: "nextgen", icon: "rocket", text: "Next-Gen Hospital Operations", primary: true }, ...hms.heroBadges.map((b) => ({ id: b, icon: "sparkle", text: b }))];

/** Meter width follows the percentage text once an admin edits it, e.g. "40%". */
function Meter({ s, ...rest }) {
  const value = useText("value", s.value);
  const pct = value === s.value ? s.pct : Math.min(100, Math.max(0, parseFloat(value) || s.pct));
  return (
    <div className="meter" {...rest}>
      <div className="meter-head">
        <T k="label" className="meter-label">{s.label}</T>
        <T k="value" className="meter-value">{s.value}</T>
      </div>
      <div className="meter-track" aria-hidden="true"><div className="meter-fill" style={{ "--pct": `${pct}%` }} /></div>
    </div>
  );
}

function ModulesAtlas() {
  const { mode } = useCms();
  const { docId, prefix } = useScope();
  const listKey = joinKey(prefix, "modules");
  const entries = useListItems("modules", hms.modules);
  const [active, setActive] = useState(entries[0]?.id);

  // Scrollspy: highlight the module currently in view on the sticky rail.
  // Position-based (not IntersectionObserver) because the stacking-deck
  // chapters pin at a fixed top and would otherwise never "re-enter" view
  // when scrolling back up. Active = last chapter whose top crossed 35% vh.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.35;
        let current = entries[0]?.id;
        for (const e of entries) {
          const el = document.getElementById(e.id);
          if (el && el.getBoundingClientRect().top <= line) current = e.id;
        }
        setActive(current);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [entries]);

  // Rail navigation: native #anchor scrolling breaks for chapters already
  // pinned by the stacking deck (a stuck card reports its pinned position),
  // so compute each chapter's NATURAL position from the preceding heights.
  const jumpTo = (e, idx, id) => {
    e.preventDefault();
    if (mode === "edit") return;
    const flow = document.querySelector(".modules-flow");
    if (!flow) return;
    const chapters = flow.querySelectorAll(".module-chapter");
    let y = flow.getBoundingClientRect().top + window.scrollY;
    for (let i = 0; i < idx && i < chapters.length; i++) {
      const cs = getComputedStyle(chapters[i]);
      y += chapters[i].offsetHeight + (parseFloat(cs.marginBottom) || 0) + (parseFloat(cs.marginTop) || 0);
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const offset = window.innerWidth <= 1100 ? 160 : 100;
    window.scrollTo({ top: y - offset, behavior: reduce ? "auto" : "smooth" });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="modules-layout">
      <aside className="module-rail" aria-label="Module index">
        <p className="rail-title"><T k="railTitle">Modules</T> - {entries.filter((e) => !e.hidden).length}</p>
        {entries.map((e, i) => (
          <Scope key={e.id} k={`modules.${e.id}`}>
            <a
              href={`#${e.id}`}
              className={`rail-item ${active === e.id ? "active" : ""}`}
              aria-current={active === e.id ? "true" : undefined}
              onClick={(ev) => jumpTo(ev, i, e.id)}
            >
              <span className="rail-num">{String(i + 1).padStart(2, "0")}</span>
              <T k="title">{e.item.title}</T>
            </a>
          </Scope>
        ))}
        <Btn k="railCta" className="btn btn-primary rail-cta" action="demo">Book a Demo</Btn>
      </aside>
      <div className="modules-flow">
        {entries.map((e, i) => (
          <Scope key={e.id} k={`modules.${e.id}`}>
            <ModuleChapter mod={e.item} index={i} domId={e.id} {...itemAttrs(mode, e, listKey, docId)} />
          </Scope>
        ))}
      </div>
    </div>
  );
}

export default function ProductHMS() {
  const faqLd = useFaqJsonLd("page:hms", "faq.items", hmsFaqs);
  return (
    <PageDoc id="hms">
      <Seo page="hms" jsonLd={[appJsonLd, faqLd]} />
      <Sections>
        <Sec id="breadcrumbs" label="Breadcrumbs" noDuplicate>
          <div className="container"><Breadcrumbs page="hms" /></div>
        </Sec>

        <Sec id="hero" label="Hero" noDuplicate>
          <section className="hero" style={{ paddingTop: 20 }}>
            <div className="container hero-inner">
              <div>
                <div className="hero-badges">
                  <List k="badges" items={heroBadges}>
                    {(b) => <span className={b.primary ? "hero-badge" : "hero-badge soft"}><Ico name={b.icon} size={b.primary ? 14 : 13} /> <T k="text">{b.text}</T></span>}
                  </List>
                </div>
                <T k="title" as="h1">{hms.heroTitle}</T>
                <R k="sub" className="hero-text" style={{ fontWeight: 700, color: "var(--ink)" }}>{hms.heroSub}</R>
                <R k="text" className="hero-text">{hms.heroText}</R>
                <div className="hero-actions">
                  <Btn k="primary" className="btn btn-primary btn-lg" action="demo">Book a Free Demo</Btn>
                  <Btn k="secondary" className="btn btn-outline btn-lg" href="#modules" action="link">Explore Modules</Btn>
                </div>
                <R k="note" className="hero-note" html="Product application runs at <code>hms.kibo360.in</code> · Also known as HIS (Hospital Information System)." />
              </div>
              <HeroDashboard />
            </div>
          </section>
        </Sec>

        <Sec id="problem" label="The problem">
          <section>
            <div className="container">
              <SectionHeading eyebrow="The Problem" title="Healthcare industry challenges." subtitle="Legacy, paper-driven hospital workflows leak revenue and patient trust every single day." />
              <div className="problem-panel">
                <div className="problem-grid">
                  <List k="pains" items={hms.challenges} getId={(c) => c.name}>
                    {(c) => (
                      <div className="pain-card">
                        <span className="pain-icon" aria-hidden="true"><Ico name={c.icon} size={19} /></span>
                        <div>
                          <T k="name" as="h3">{c.name}</T>
                          <R k="text">{c.text}</R>
                        </div>
                      </div>
                    )}
                  </List>
                </div>
                <div className="problem-meters">
                  <T k="metersTitle" as="p" className="meters-title">What it costs a hospital every day</T>
                  <List k="meters" items={hms.challengeStats} getId={(s) => s.label}>{(s) => <Meter s={s} />}</List>
                  <R k="metersFoot" className="meters-foot">KIBO360 HMS exists to claw all of this back.</R>
                </div>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="bi" label="Business intelligence">
          <section>
            <div className="container split">
              <div>
                <T k="eyebrow" className="eyebrow">Business Intelligence</T>
                <T k="title" as="h2">Intelligent control center for hospital administrators.</T>
                <R k="text" style={{ margin: "14px 0 6px" }}>Access structured, real-time performance profiles for your hospital. Spot financial leakages, optimize staffing ratios, and turn operational data into decisions.</R>
                <ul className="tab-list" style={{ marginTop: 18 }}>
                  <List k="points" items={[
                    { id: "financial", html: "<strong>Live financial tracking:</strong> Instant visibility of daily collections, outstanding balances and department-wise revenue." },
                    { id: "departmental", html: "<strong>Departmental BI:</strong> Drill-down diagnostics for OPD queues, IPD beds, pharmacy sales and lab reports." },
                  ]}>
                    {(p) => <R k="text" as="li" html={p.html} />}
                  </List>
                </ul>
                <Btn k="cta" className="btn btn-primary" action="demo" style={{ marginTop: 26 }}>Configure Admin Dashboard</Btn>
              </div>
              <div className="split-visual">
                <div className="img-wrapper">
                  <Img k="image" src="https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=800&q=80" alt="Administrator reviewing real-time hospital analytics" className="main-img" loading="lazy" />
                  <div className="img-overlay">
                    <div className="overlay-header">
                      <T k="overlayTitle">Monthly Revenue Growth</T>
                      <T k="overlayPill" className="pill green">Active Analytics</T>
                    </div>
                    <svg viewBox="0 0 500 200" className="overlay-svg-chart" aria-hidden="true">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6C22D6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#E03E8F" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6C22D6" />
                          <stop offset="50%" stopColor="#E03E8F" />
                          <stop offset="100%" stopColor="#FF7555" />
                        </linearGradient>
                      </defs>
                      <polyline fill="url(#chartGrad)" stroke="none" points="0,200 50,150 100,120 150,165 200,90 250,70 300,110 350,50 400,80 450,40 500,20 500,200 0,200" />
                      <polyline fill="none" stroke="url(#lineGrad)" strokeWidth="4" points="0,180 50,150 100,120 150,165 200,90 250,70 300,110 350,50 400,80 450,40 500,20" />
                      <circle cx="250" cy="70" r="6" fill="#E03E8F" />
                      <circle cx="350" cy="50" r="6" fill="#FF7555" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="tabs" label="All-in-one tabs" noDuplicate>
          <section>
            <div className="container">
              <SectionHeading eyebrow="All-In-One" title="The enterprise hospital OS." subtitle="Explore specialized clinical and administrative workflows - the tabs rotate automatically, or click to jump." />
              <FeatureTabs tabs={featureTabs} />
            </div>
          </section>
        </Sec>

        <Sec id="overview" label="Solution overview">
          <section className="band-dark">
            <div className="container">
              <SectionHeading title="HMS Solution Overview" subtitle="Nine integrated module families on one platform - one patient record, one billing engine, one source of truth." />
              <div className="chip-row">
                <List k="chips" items={hms.solutionWheel}>{(m) => <T k="label" className="chip">{m}</T>}</List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="modules" label="Modules in depth" noDuplicate>
          <section id="modules">
            <div className="container">
              <SectionHeading eyebrow="Inside the Product" title="Every module, in depth." subtitle="Eleven integrated modules, one platform. Use the index to jump anywhere - it follows you as you scroll." />
              <ModulesAtlas />
            </div>
          </section>
        </Sec>

        <Sec id="integrations" label="Integrations">
          <section className="tight">
            <div className="container">
              <SectionHeading eyebrow="Integrations" title="Plugs into your existing ecosystem." />
              <div className="chip-row">
                <List k="chips" items={integrations}>{(i) => <T k="label" className="chip">{i}</T>}</List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="security" label="Security & compliance">
          <section>
            <div className="container">
              <div className="security-card">
                <div className="sec-badge"><Icon name="lock" size={15} /> <T k="badge">Security &amp; Compliance</T></div>
                <T k="title" as="h2">Built for India. Secure by design.</T>
                <R k="text">KIBO360 HMS is ABDM-ready and aligned with the DPDP Act 2023, with clinical documentation that supports NABH accreditation - all on an encrypted, role-based, fully audited platform.</R>
                <div className="certs-grid">
                  <List k="certs" items={securityCerts}>
                    {(c) => (
                      <div className="cert-item">
                        <T k="title" as="div" className="cert-title">{c.title}</T>
                        <R k="text">{c.text}</R>
                      </div>
                    )}
                  </List>
                </div>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="why" label="Why choose">
          <section className="tight">
            <div className="container">
              <SectionHeading eyebrow="Why KIBO360 HMS" title="Why hospitals choose KIBO360." />
              <div className="chip-row">
                <List k="chips" items={hms.whyChoose}>{(w) => <T k="label" className="chip success">{w}</T>}</List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="roadmap" label="Roadmap">
          <section>
            <div className="container">
              <SectionHeading eyebrow="Future Roadmap" title="Where KIBO360 HMS is heading." />
              <div className="grid grid-4">
                <List k="items" items={roadmap} getId={(r) => r.title}>
                  {(r) => (
                    <article className="roadmap-card">
                      <T k="step" className="roadmap-step">{r.step}</T>
                      <T k="title" as="h3">{r.title}</T>
                      <R k="text">{r.text}</R>
                    </article>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="faq" label="FAQ" noDuplicate>
          <FaqSection faqs={hmsFaqs} title="HMS - frequently asked questions." />
        </Sec>

        <Sec id="cta" label="Final call to action">
          <CTABanner title="Ready to modernize your hospital operations?" text="Book a personalized KIBO360 HMS walkthrough for your team - see your own workflows, digitized." />
        </Sec>
      </Sections>
    </PageDoc>
  );
}
