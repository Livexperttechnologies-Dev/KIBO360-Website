import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatCard from "../components/StatCard.jsx";
import FeatureCard from "../components/FeatureCard.jsx";
import CTABanner from "../components/CTABanner.jsx";
import FaqSection, { faqJsonLd } from "../components/FaqSection.jsx";
import Icon from "../components/Icon.jsx";
import { useDemoModal } from "../components/DemoModalContext.jsx";
import { cms, integrations, securityFeatures, cmsFaqs, images, testimonials } from "../data/siteData.js";

const cmsJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "KIBO360 Clinic Management Software (CMS)",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      url: "https://kibo360.in/products/cms",
      description:
        "Clinic management software for single doctors, polyclinics and chains — appointments, queue & token, doctor EMR, e-prescriptions, GST billing, pharmacy and WhatsApp reminders.",
      publisher: { "@id": "https://kibo360.in/#org" },
      offers: { "@type": "Offer", availability: "https://schema.org/InStock", url: "https://kibo360.in/contact" },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://kibo360.in/" },
        { "@type": "ListItem", position: 2, name: "Products", item: "https://kibo360.in/products" },
        { "@type": "ListItem", position: 3, name: "Clinic Management Software (CMS)" },
      ],
    },
    faqJsonLd(cmsFaqs),
  ],
};

export default function ProductCMS() {
  const { openDemo } = useDemoModal();
  return (
    <>
      <Seo
        title="Clinic Management Software (CMS) — Appointments, EMR & Billing"
        description="KIBO360 CMS runs your clinic end to end: online appointments, queue & token, doctor EMR, e-prescriptions, GST billing, pharmacy and WhatsApp/SMS reminders. Live in days — upgrade to full HMS anytime."
        path="/products/cms"
        jsonLd={cmsJsonLd}
      />
      <div className="container">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Products", to: "/products" },
            { label: "Clinic Management Software (CMS)" },
          ]}
        />
      </div>
      {/* Hero */}
      <section className="hero" style={{ paddingTop: 20 }}>
        <div className="container hero-inner">
          <div>
            <div className="hero-badges">
              <span className="hero-badge"><Icon name="stethoscope" size={14} /> Built for Modern Clinics</span>
              {cms.heroBadges.map((b) => <span key={b} className="hero-badge soft"><Icon name="sparkle" size={13} /> {b}</span>)}
            </div>
            <h1>{cms.heroTitle}</h1>
            <p className="hero-text" style={{ fontWeight: 600, color: "var(--ink)" }}>
              {cms.heroSub}
            </p>
            <p className="hero-text">{cms.heroText}</p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>
                Book a Demo
              </button>
              <a href="#cms-modules" className="btn btn-outline btn-lg">See Features</a>
            </div>
            <p className="hero-note">
              Product application runs at <code>cms.kibo360.in</code>
            </p>
          </div>

          <div className="mini-dash" aria-label="KIBO360 CMS preview">
            <div className="mini-dash-head">
              <span className="mini-dash-title">KIBO360 · Clinic Dashboard</span>
              <div className="mini-dash-user">
                <div className="mini-dash-avatar">DR</div>
                <div>
                  <strong>Dr. A. Verma</strong>
                  <span>Clinic Owner</span>
                </div>
              </div>
            </div>
            <div className="mini-dash-grid">
              <div className="mini-dash-card">
                <p className="k">Appointments Today</p>
                <p className="v">64</p>
                <p className="d">↑ 9% vs yesterday</p>
              </div>
              <div className="mini-dash-card">
                <p className="k">In Queue</p>
                <p className="v">7</p>
                <p className="d">Avg wait 12 min</p>
              </div>
              <div className="mini-dash-card">
                <p className="k">Today's Collections</p>
                <p className="v">₹45,760</p>
                <p className="d">↑ 15.3%</p>
              </div>
              <div className="mini-dash-card">
                <p className="k">Follow-ups Sent</p>
                <p className="v">38</p>
                <p className="d">via WhatsApp</p>
              </div>
            </div>
            <div className="mini-dash-footer">
              <span>No-shows this week <strong>↓ 41%</strong></span>
              <span>Patient rating <strong>4.8★</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* Challenges */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="The Problem"
            title="Running a clinic on paper costs you patients."
          />
          <div className="chip-row">
            {cms.challenges.map((c) => (
              <span key={c.name} className="chip danger"><Icon name={c.icon} size={15} /> {c.name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="cms-modules">
        <div className="container">
          <SectionHeading
            eyebrow="Core Modules"
            title="Everything your clinic needs. Nothing it doesn't."
          />
          <div className="grid grid-4">
            {cms.modules.map((m) => (
              <FeatureCard key={m.title} icon={m.icon} title={m.title} text={m.text} />
            ))}
          </div>
        </div>
      </section>

      {/* Image split — consult & e-prescribe */}
      <section>
        <div className="container split">
          <div>
            <span className="eyebrow">Consult &amp; Prescribe</span>
            <h2>Faster consults, clearer prescriptions.</h2>
            <p style={{ margin: "14px 0 6px" }}>
              Doctors see the full patient timeline, record notes and generate readable
              e-prescriptions in seconds — synced straight to your pharmacy and billing.
            </p>
            <ul className="tab-list" style={{ marginTop: 18 }}>
              <li>Vitals, history and allergies on one screen.</li>
              <li>Printable, standardized e-prescriptions.</li>
              <li>Quick-templates for repeat diagnoses.</li>
            </ul>
            <button type="button" className="btn btn-primary" style={{ marginTop: 24 }} onClick={openDemo}>
              See a Live Demo
            </button>
          </div>
          <div className="split-visual">
            <div className="img-wrapper">
              <img
                src={images.ePrescription}
                alt="Doctor writing a digital prescription in KIBO360 CMS"
                className="main-img"
                loading="lazy"
                width="900"
                height="675"
              />
              <div className="img-overlay right">
                <div className="overlay-header"><span className="ohl"><Icon name="pill" size={16} /> e-Prescription</span></div>
                <div className="overlay-item">Paracetamol 650mg — Post Meals — 3 Days</div>
                <div className="overlay-item">Azithromycin 500mg — Once Daily — 3 Days</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="tight">
        <div className="container">
          <SectionHeading eyebrow="How it works" title="From booking to follow-up in one flow." />
          <div className="workflow">
            {cms.workflow.map((s, i) => (
              <div key={s} style={{ display: "contents" }}>
                <span className="workflow-step">
                  <span className="workflow-num">{i + 1}</span>
                  {s}
                </span>
                {i < cms.workflow.length - 1 && <span className="workflow-arrow">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="band-dark">
        <div className="container">
          <SectionHeading title="Clinics feel the difference fast." />
          <div className="grid grid-4">
            {cms.stats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* Image split — patient engagement */}
      <section>
        <div className="container split reverse">
          <div>
            <span className="eyebrow pink">Keep Patients Coming Back</span>
            <h2>Reminders and reports on WhatsApp.</h2>
            <p style={{ margin: "14px 0 6px" }}>
              Automated appointment reminders, follow-up nudges and report-ready alerts
              go out over WhatsApp and SMS — the single biggest lever for cutting
              no-shows and keeping patients engaged.
            </p>
            <ul className="tab-list" style={{ marginTop: 18 }}>
              <li>Patient portal for reports, prescriptions &amp; history.</li>
              <li>Automated follow-up sequences after every visit.</li>
              <li>Feedback collection to grow your clinic's rating.</li>
            </ul>
          </div>
          <div className="split-visual">
            <div className="img-wrapper">
              <img
                src={images.patientPortal}
                alt="Patient receiving clinic reminders and reports on a phone"
                className="main-img"
                loading="lazy"
                width="900"
                height="675"
              />
              <div className="img-overlay">
                <div className="overlay-header"><span className="ohl"><Icon name="message" size={16} /> Patient Reminders</span></div>
                <div className="overlay-item">Reminder: appointment tomorrow, 10:30 AM with Dr. Verma.</div>
                <div className="overlay-item">Your lab report is ready — tap to download.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why CMS */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="Why KIBO360 CMS"
            title="Start small. Never migrate again."
            subtitle="CMS runs on the same KIBO360 platform as our full Hospital Management Software — when your clinic grows into a hospital, your data and workflows come with you."
          />
          <div className="chip-row">
            {cms.whyChoose.map((w) => <span key={w} className="chip success">{w}</span>)}
          </div>
        </div>
      </section>

      {/* Built for Indian clinics */}
      <section className="tight">
        <div className="container">
          <SectionHeading
            eyebrow="Built for India"
            title="Ready for Indian clinics from day one."
            subtitle="ABDM-ready with ABHA health IDs, GST-compliant billing, UPI payments and DPDP Act 2023-aligned data handling."
          />
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {integrations.map((i) => <span key={i} className="chip">{i}</span>)}
          </div>
          <div className="chip-row">
            {securityFeatures.map((s) => <span key={s} className="chip lock"><Icon name="lock" size={14} /> {s}</span>)}
          </div>
        </div>
      </section>

      {/* Testimonials (placeholder quotes — replace with real customers) */}
      <section>
        <div className="container">
          <SectionHeading eyebrow="What Clinics Say" title="Loved by doctors and clinic teams." />
          <div className="test-grid">
            {testimonials.map((t) => (
              <figure key={t.role} className="test-card">
                <span className="quote-mark" aria-hidden="true">“</span>
                <blockquote>{t.quote}</blockquote>
                <figcaption className="test-user">
                  {t.img ? (
                    <img src={t.img} alt="" className="test-avatar" loading="lazy" width="96" height="96" />
                  ) : (
                    <span className="test-avatar initials" aria-hidden="true">
                      {t.role.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </span>
                  )}
                  <div>
                    <strong>{t.role}</strong>
                    <span>{t.org}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ (also emitted as FAQPage structured data) */}
      <FaqSection faqs={cmsFaqs} title="CMS — frequently asked questions." />

      <CTABanner
        title="Give your clinic superpowers."
        text="Book a 30-minute KIBO360 CMS demo — see your clinic's workflow, digitized."
      />
    </>
  );
}
