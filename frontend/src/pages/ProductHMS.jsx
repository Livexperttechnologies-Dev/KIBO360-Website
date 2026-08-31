import { useEffect, useState } from "react";
import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import CTABanner from "../components/CTABanner.jsx";
import FeatureTabs from "../components/FeatureTabs.jsx";
import FaqSection, { faqJsonLd } from "../components/FaqSection.jsx";
import Icon from "../components/Icon.jsx";
import { useDemoModal } from "../components/DemoModalContext.jsx";
import { hms, integrations, roadmap, hmsFaqs } from "../data/siteData.js";

const hmsJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "KIBO360 Hospital Management Software (HMS)",
      alternateName: "KIBO360 HIS - Hospital Information System",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      url: "https://kibo360.in/products/hms",
      description:
        "AI-powered, cloud-native hospital management software unifying OPD/IPD, EMR/EHR, diagnostics, pharmacy, billing, finance ERP, HR & payroll and analytics on one intelligent database.",
      publisher: { "@id": "https://kibo360.in/#org" },
      offers: { "@type": "Offer", availability: "https://schema.org/InStock", url: "https://kibo360.in/contact" },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://kibo360.in/" },
        { "@type": "ListItem", position: 2, name: "Products", item: "https://kibo360.in/products" },
        { "@type": "ListItem", position: 3, name: "Hospital Management Software (HMS)" },
      ],
    },
    faqJsonLd(hmsFaqs),
  ],
};

/* One module rendered as a magazine-style "chapter": accent icon + ghost
   number, feature tag pills, a vertical workflow timeline and a stat strip. */
const CHAPTER_TONES = ["violet", "pink", "coral"];

function ModuleChapter({ mod, index }) {
  const tone = CHAPTER_TONES[index % CHAPTER_TONES.length];
  return (
    <article className="module-chapter" id={mod.id}>
      <span className="chapter-num" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>

      <header className="chapter-head">
        <span className={`chapter-icon ${tone}`} aria-hidden="true">
          <Icon name={mod.icon} size={22} />
        </span>
        <div>
          <h3>{mod.title}</h3>
          <p className="chapter-tagline">{mod.tagline}</p>
        </div>
      </header>

      <div className="chapter-grid">
        <div>
          <p className="chapter-label">Key Features</p>
          <div className="ftags">
            {mod.features.map((f) => (
              <span key={f} className="ftag">
                <Icon name="check" size={12} strokeWidth={2.6} /> {f}
              </span>
            ))}
          </div>
          {mod.extra && (
            <div className="chapter-extra">
              <h4>{mod.extra.heading}</h4>
              <ul>
                {mod.extra.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div>
          <p className="chapter-label">Workflow</p>
          <ol className="vtimeline">
            {mod.workflow.map((s, i) => (
              <li key={s} className="vt-step">
                <span className={`vt-num ${tone}`} aria-hidden="true">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="stat-strip">
        {mod.stats.map((s) => (
          <div key={s.label}>
            <span className="stat-value gradient-text">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

/* Glass dashboard mock - reference-page style with sparkline + radial chart */
function HeroDashboard() {
  return (
    <div className="mini-dash" aria-label="KIBO360 HMS dashboard preview">
      <div className="mini-dash-head">
        <span className="mini-dash-title">KIBO360 · HMS Dashboard</span>
        <div className="mini-dash-user">
          <div className="mini-dash-avatar">RS</div>
          <div>
            <strong>Dr. Ranveer Singh</strong>
            <span>Administrator</span>
          </div>
        </div>
      </div>

      <div className="mini-dash-grid">
        <div className="mini-dash-card">
          <p className="k">Today&apos;s Collections <span style={{ color: "#10b981" }}>+18.6%</span></p>
          <p className="v">₹25.4 Cr</p>
          <div className="sparkline">
            <svg viewBox="0 0 100 20" className="spark-svg" aria-hidden="true">
              <defs>
                <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6C22D6" />
                  <stop offset="50%" stopColor="#E03E8F" />
                  <stop offset="100%" stopColor="#FF7555" />
                </linearGradient>
              </defs>
              <path
                d="M0,15 Q15,5 30,12 T60,4 T90,14 T100,5"
                fill="none"
                stroke="url(#brandGrad)"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        <div className="mini-dash-card flex-center">
          <div className="radial-wrapper">
            <svg viewBox="0 0 36 36" className="radial-chart" aria-hidden="true">
              <path
                className="circle-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="circle"
                strokeDasharray="76, 100"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.5" className="percentage">76%</text>
            </svg>
            <span className="radial-label">Overall Bed Occupancy</span>
          </div>
        </div>

        {hms.dashboardStats.slice(0, 2).map((d) => (
          <div key={d.label} className="mini-dash-card">
            <p className="k">{d.label}</p>
            <p className="v">{d.value}</p>
            <p className="d">{d.delta}</p>
          </div>
        ))}
      </div>

      <div className="mini-dash-rows">
        <h4>Active OPD Patients</h4>
        <div className="booking-row">
          <span>Rahul Sharma</span> <span className="pill violet">OPD-19</span>
        </div>
        <div className="booking-row">
          <span>Priya Patel</span> <span className="pill pink">OPD-20</span>
        </div>
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
    points: [
      "Intelligent time-slot allocation minimizes overlapping appointments.",
      "Automated SMS / WhatsApp reminder funnels cut no-show rates.",
      "80% faster registration · 60% reduced waiting time.",
    ],
    cta: "Deploy Smart Scheduling",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
    alt: "Streamlined hospital patient booking and scheduling operations",
    overlay: (
      <>
        <div className="overlay-header">
          <strong>Consultation Bookings</strong>
          <span className="pill green">Auto-Sync</span>
        </div>
        <div className="overlay-item-flex"><span>10:00 AM · Dr. Sanchita Sharma - Pediatrics</span> <span className="lbl-good">Confirmed</span></div>
        <div className="overlay-item-flex"><span>10:30 AM · Dr. Neelesh Kapoor - Gen. Medicine</span> <span className="lbl-busy">In-Queue</span></div>
      </>
    ),
  },
  {
    label: "Digital Prescription",
    title: "E-Prescriptions Optimized for Direct Clinical Workflow",
    text: "Generate highly readable, standardized digital prescriptions in seconds - synced with the patient timeline, pharmacy and lab billing modules in real time.",
    points: [
      "Custom quick-templates for recurring diagnostics.",
      "Direct sync with pharmacy dispensing and lab orders.",
      "Complete allergy and history checks on every prescription.",
    ],
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
    points: [
      "Interactive patient portal with self-registration.",
      "Automated health instructions over WhatsApp / SMS.",
      "92% patient satisfaction across deployments.",
    ],
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
    points: [
      "Real-time tracking of collections and outstanding balances.",
      "35% denial reduction · 20% faster collections.",
      "Executive dashboards with drill-down KPIs.",
    ],
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

export default function ProductHMS() {
  const { openDemo } = useDemoModal();
  // Scrollspy: highlight the module currently in view on the sticky rail.
  // Position-based (not IntersectionObserver) because the stacking-deck
  // chapters pin at a fixed top and would otherwise never "re-enter" view
  // when scrolling back up. Active = last chapter whose top crossed 35% vh.
  const [activeModule, setActiveModule] = useState(hms.modules[0].id);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const line = window.innerHeight * 0.35;
        let current = hms.modules[0].id;
        for (const m of hms.modules) {
          const el = document.getElementById(m.id);
          if (el && el.getBoundingClientRect().top <= line) current = m.id;
        }
        setActiveModule(current);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <>
      <Seo
        title="Hospital Management Software (HMS / HIS) - AI-Powered & Cloud-Native"
        description="KIBO360 HMS unifies OPD/IPD, EMR/EHR, diagnostics, pharmacy, billing, finance ERP, HR & payroll and AI analytics on one intelligent database. 80% faster registration, 98% billing accuracy. Book a free demo."
        path="/products/hms"
        jsonLd={hmsJsonLd}
      />
      <div className="container">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Products", to: "/products" },
            { label: "Hospital Management Software (HMS)" },
          ]}
        />
      </div>
      {/* Hero (deck p.1, reference-style visual) */}
      <section className="hero" style={{ paddingTop: 20 }}>
        <div className="container hero-inner">
          <div>
            <div className="hero-badges">
              <span className="hero-badge"><Icon name="rocket" size={14} /> Next-Gen Hospital Operations</span>
              {hms.heroBadges.map((b) => <span key={b} className="hero-badge soft"><Icon name="sparkle" size={13} /> {b}</span>)}
            </div>
            <h1>{hms.heroTitle}</h1>
            <p className="hero-text" style={{ fontWeight: 700, color: "var(--ink)" }}>
              {hms.heroSub}
            </p>
            <p className="hero-text">{hms.heroText}</p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>
                Book a Free Demo
              </button>
              <a href="#modules" className="btn btn-outline btn-lg">Explore Modules</a>
            </div>
            <p className="hero-note">
              Product application runs at <code>hms.kibo360.in</code> · Also known as
              HIS (Hospital Information System).
            </p>
          </div>
          <HeroDashboard />
        </div>
      </section>

      {/* Challenges (deck p.3) - pain cards + animated damage meters */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="The Problem"
            title="Healthcare industry challenges."
            subtitle="Legacy, paper-driven hospital workflows leak revenue and patient trust every single day."
          />
          <div className="problem-panel">
            <div className="problem-grid">
              {hms.challenges.map((c) => (
                <div key={c.name} className="pain-card">
                  <span className="pain-icon" aria-hidden="true">
                    <Icon name={c.icon} size={19} />
                  </span>
                  <div>
                    <h3>{c.name}</h3>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="problem-meters">
              <p className="meters-title">What it costs a hospital every day</p>
              {hms.challengeStats.map((s) => (
                <div key={s.label} className="meter">
                  <div className="meter-head">
                    <span className="meter-label">{s.label}</span>
                    <span className="meter-value">{s.value}</span>
                  </div>
                  <div className="meter-track" aria-hidden="true">
                    <div className="meter-fill" style={{ "--pct": `${s.pct}%` }} />
                  </div>
                </div>
              ))}
              <p className="meters-foot">
                KIBO360 HMS exists to claw all of this back.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Business Intelligence split with image + chart overlay */}
      <section>
        <div className="container split">
          <div>
            <span className="eyebrow">Business Intelligence</span>
            <h2>Intelligent control center for hospital administrators.</h2>
            <p style={{ margin: "14px 0 6px" }}>
              Access structured, real-time performance profiles for your hospital.
              Spot financial leakages, optimize staffing ratios, and turn operational
              data into decisions.
            </p>
            <ul className="tab-list" style={{ marginTop: 18 }}>
              <li><strong>Live financial tracking:</strong> Instant visibility of daily collections, outstanding balances and department-wise revenue.</li>
              <li><strong>Departmental BI:</strong> Drill-down diagnostics for OPD queues, IPD beds, pharmacy sales and lab reports.</li>
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 26 }}
              onClick={openDemo}
            >
              Configure Admin Dashboard
            </button>
          </div>
          <div className="split-visual">
            <div className="img-wrapper">
              <img
                src="https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=800&q=80"
                alt="Administrator reviewing real-time hospital analytics"
                className="main-img"
                loading="lazy"
              />
              <div className="img-overlay">
                <div className="overlay-header">
                  <span>Monthly Revenue Growth</span>
                  <span className="pill green">Active Analytics</span>
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
                  <polyline
                    fill="url(#chartGrad)"
                    stroke="none"
                    points="0,200 50,150 100,120 150,165 200,90 250,70 300,110 350,50 400,80 450,40 500,20 500,200 0,200"
                  />
                  <polyline
                    fill="none"
                    stroke="url(#lineGrad)"
                    strokeWidth="4"
                    points="0,180 50,150 100,120 150,165 200,90 250,70 300,110 350,50 400,80 450,40 500,20"
                  />
                  <circle cx="250" cy="70" r="6" fill="#E03E8F" />
                  <circle cx="350" cy="50" r="6" fill="#FF7555" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Auto-rotating feature tabs (reference component) */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="All-In-One"
            title="The enterprise hospital OS."
            subtitle="Explore specialized clinical and administrative workflows - the tabs rotate automatically, or click to jump."
          />
          <FeatureTabs tabs={featureTabs} />
        </div>
      </section>

      {/* Solution overview (deck p.4) */}
      <section className="band-dark">
        <div className="container">
          <SectionHeading
            title="HMS Solution Overview"
            subtitle="Nine integrated module families on one platform - one patient record, one billing engine, one source of truth."
          />
          <div className="chip-row">
            {hms.solutionWheel.map((m) => <span key={m} className="chip">{m}</span>)}
          </div>
        </div>
      </section>

      {/* Module deep-dives (deck p.5–38): sticky index rail + chapters */}
      <section id="modules">
        <div className="container">
          <SectionHeading
            eyebrow="Inside the Product"
            title="Every module, in depth."
            subtitle="Eleven integrated modules, one platform. Use the index to jump anywhere - it follows you as you scroll."
          />
          <div className="modules-layout">
            <aside className="module-rail" aria-label="Module index">
              <p className="rail-title">Modules - 11</p>
              {hms.modules.map((m, i) => (
                <a
                  key={m.id}
                  href={`#${m.id}`}
                  className={`rail-item ${activeModule === m.id ? "active" : ""}`}
                  aria-current={activeModule === m.id ? "true" : undefined}
                >
                  <span className="rail-num">{String(i + 1).padStart(2, "0")}</span>
                  <span>{m.title}</span>
                </a>
              ))}
              <button type="button" className="btn btn-primary rail-cta" onClick={openDemo}>
                Book a Demo
              </button>
            </aside>

            <div className="modules-flow">
              {hms.modules.map((m, i) => (
                <ModuleChapter key={m.id} mod={m} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Integrations (deck p.39) */}
      <section className="tight">
        <div className="container">
          <SectionHeading eyebrow="Integrations" title="Plugs into your existing ecosystem." />
          <div className="chip-row">
            {integrations.map((i) => <span key={i} className="chip">{i}</span>)}
          </div>
        </div>
      </section>

      {/* Security & compliance (deck p.40) - dark card, reference style */}
      <section>
        <div className="container">
          <div className="security-card">
            <div className="sec-badge"><Icon name="lock" size={15} /> Security &amp; Compliance</div>
            <h2>Built for India. Secure by design.</h2>
            <p>
              KIBO360 HMS is ABDM-ready and aligned with the DPDP Act 2023, with
              clinical documentation that supports NABH accreditation - all on an
              encrypted, role-based, fully audited platform.
            </p>
            <div className="certs-grid">
              {securityCerts.map((c) => (
                <div key={c.title} className="cert-item">
                  <div className="cert-title">{c.title}</div>
                  <p>{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why choose (deck p.41) */}
      <section className="tight">
        <div className="container">
          <SectionHeading eyebrow="Why KIBO360 HMS" title="Why hospitals choose KIBO360." />
          <div className="chip-row">
            {hms.whyChoose.map((w) => <span key={w} className="chip success">{w}</span>)}
          </div>
        </div>
      </section>

      {/* Roadmap (deck p.42) */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="Future Roadmap"
            title="Where KIBO360 HMS is heading."
          />
          <div className="grid grid-4">
            {roadmap.map((r) => (
              <article key={r.step} className="roadmap-card">
                <span className="roadmap-step">{r.step}</span>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ (also emitted as FAQPage structured data) */}
      <FaqSection faqs={hmsFaqs} title="HMS - frequently asked questions." />

      <CTABanner
        title="Ready to modernize your hospital operations?"
        text="Book a personalized KIBO360 HMS walkthrough for your team - see your own workflows, digitized."
      />
    </>
  );
}
