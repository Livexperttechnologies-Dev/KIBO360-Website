import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import FeatureCard from "../components/FeatureCard.jsx";
import CTABanner from "../components/CTABanner.jsx";
import FaqSection, { faqJsonLd } from "../components/FaqSection.jsx";
import Icon from "../components/Icon.jsx";
import { useDemoModal } from "../components/DemoModalContext.jsx";
import { integrations, securityFeatures, cmsFaqs, images, testimonials } from "../data/siteData.js";

// Page copy comes verbatim from "Kibo360 CMS Page.docx"

const problemCards = [
  { icon: "file-text", pain: "Too much paperwork", fix: "More organised records", text: "Keep essential patient and clinic information in one place." },
  { icon: "calendar", pain: "Missed appointments", fix: "Better schedule management", text: "Give your team a clearer view of upcoming appointments." },
  { icon: "link", pain: "Disconnected processes", fix: "One connected workflow", text: "Bring clinical and administrative tasks together." },
  { icon: "clock", pain: "Too much admin", fix: "Less repetitive work", text: "Make everyday clinic processes easier to manage." },
];

const coreFunctions = [
  { icon: "users", title: "Patient Management", text: "Keep patient information organised and accessible to authorised staff." },
  { icon: "calendar", title: "Appointment Management", text: "Manage schedules and appointments while keeping your team informed." },
  { icon: "file-text", title: "Clinical Records", text: "Maintain organised patient records that can be accessed when needed." },
  { icon: "stethoscope", title: "Doctor & Staff Management", text: "Manage information and responsibilities across your clinical team." },
  { icon: "receipt", title: "Billing Management", text: "Keep billing-related information and processes organised alongside patient workflows." },
  { icon: "bar-chart", title: "Reports & Insights", text: "Get a clearer picture of your clinic's activities and performance." },
];

const journeySteps = ["Register", "Schedule", "Consult", "Record", "Bill", "Follow Up"];

const personas = [
  { icon: "stethoscope", title: "Doctors & Practitioners", text: "Access relevant patient information and manage clinical work." },
  { icon: "users", title: "Reception Teams", text: "Manage appointments, patient information, and everyday front-desk tasks." },
  { icon: "layers", title: "Clinic Administrators", text: "Get better visibility into operations and administrative work." },
  { icon: "message", title: "Support Teams", text: "Work with the information they need without relying on multiple systems." },
  { icon: "trending-up", title: "Clinic Owners & Managers", text: "Get a clearer view of how the clinic is operating." },
];

const cmsJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "KIBO360 Clinical Management System (CMS)",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      url: "https://kibo360.in/products/cms",
      description:
        "Clinical Management Software in India - patient management, appointments, clinical records, billing, staff management and reports for clinics and healthcare practices, in one connected system.",
      publisher: { "@id": "https://kibo360.in/#org" },
      offers: { "@type": "Offer", availability: "https://schema.org/InStock", url: "https://kibo360.in/contact" },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://kibo360.in/" },
        { "@type": "ListItem", position: 2, name: "Products", item: "https://kibo360.in/products" },
        { "@type": "ListItem", position: 3, name: "Clinical Management System (CMS)" },
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
        title="Clinical Management System (CMS) - Clinical Management Software in India"
        description="Kibo360 CMS brings patients, appointments, clinical records, billing and staff management together in one connected system - Clinical Management Software for clinics and modern practices in India. Book a demo."
        path="/products/cms"
        jsonLd={cmsJsonLd}
      />
      <div className="container">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Products", to: "/products" },
            { label: "Clinical Management System (CMS)" },
          ]}
        />
      </div>

      {/* Fold 1 - hero */}
      <section className="hero" style={{ paddingTop: 20 }}>
        <div className="container hero-inner">
          <div>
            <div className="hero-badges">
              <span className="hero-badge"><Icon name="stethoscope" size={14} /> Built for Modern Clinics</span>
              <span className="hero-badge soft"><Icon name="sparkle" size={13} /> AI Powered</span>
              <span className="hero-badge soft"><Icon name="sparkle" size={13} /> Secure</span>
              <span className="hero-badge soft"><Icon name="sparkle" size={13} /> Cloud Based</span>
            </div>
            <h1>Simplify the Work Behind Better Patient Care</h1>
            <p className="hero-text">
              Running a clinic means managing patients, appointments, records,
              billing, staff, and countless daily tasks. Kibo360 Clinical Management
              System brings these processes together in one place, helping your team
              spend less time on administration and more time focused on patient
              care.
            </p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>
                See Kibo360 CMS in Action
              </button>
              <Link to="/contact" className="btn btn-outline btn-lg">
                Talk to a Clinical Management Expert
              </Link>
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

      {/* Fold 2 - what a CMS is */}
      <section className="tight">
        <div className="container" style={{ maxWidth: 860 }}>
          <SectionHeading
            title="One System for the Work That Keeps Your Clinic Running"
            subtitle="A Clinical Management System helps healthcare practices manage the clinical and administrative work that happens around patient care."
          />
          <p style={{ maxWidth: "none", textAlign: "center", marginBottom: 14 }}>
            Kibo360 CMS brings patient information, appointments, clinical records,
            billing, staff management, and everyday workflows into one connected
            system.
          </p>
          <p style={{ maxWidth: "none", textAlign: "center" }}>
            Instead of relying on spreadsheets, paper records, separate applications,
            and manual processes, your team can manage essential clinic operations
            from one place.
          </p>
        </div>
      </section>

      {/* Fold 3 - the problem, with pain → fix cards */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="The Problem"
            title="Your Clinic Shouldn't Have to Run on Spreadsheets, Paperwork, and Memory"
            subtitle="When your clinic grows, so does the amount of information your team has to manage. Appointments need to be scheduled. Patient information needs to be updated. Records need to be accessible. Bills need to be managed. Staff need to stay coordinated."
          />
          <p style={{ textAlign: "center", margin: "0 auto 26px", maxWidth: "62ch" }}>
            When all of this happens across disconnected systems, things get missed,
            and your team spends valuable time keeping the processes together.
            Kibo360 CMS gives your clinic one system to bring these moving parts
            together.
          </p>
          <div className="problem-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {problemCards.map((c) => (
              <div key={c.fix} className="pain-card">
                <span className="pain-icon" aria-hidden="true">
                  <Icon name={c.icon} size={19} />
                </span>
                <div>
                  <span className="muted">{c.pain} →</span>
                  <h3>{c.fix}</h3>
                  <p>{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fold 4 - core functions */}
      <section id="cms-modules">
        <div className="container">
          <SectionHeading
            eyebrow="Core Functions"
            title="Manage the Everyday Work of Your Clinic From One Place"
            subtitle="Kibo360 CMS brings together the core functions your clinic needs to manage patients and daily operations."
          />
          <div className="grid grid-3">
            {coreFunctions.map((m) => (
              <FeatureCard key={m.title} icon={m.icon} title={m.title} text={m.text} />
            ))}
          </div>
          <p style={{ textAlign: "center", margin: "26px auto 0" }}>
            <Link to="/products" className="btn btn-primary">Explore Kibo360 CMS</Link>
          </p>
        </div>
      </section>

      {/* Fold 5 - appointments (image split kept) */}
      <section>
        <div className="container split">
          <div>
            <span className="eyebrow">Appointments</span>
            <h2>Make Every Appointment Easier to Manage.</h2>
            <p style={{ margin: "14px 0 6px" }}>
              A busy clinic needs more than a calendar. Your team needs to know what
              is scheduled, who is coming in, and what needs attention throughout the
              day. Kibo360 CMS helps organise appointments and schedules in one
              place, giving your team better visibility into the clinic's day-to-day
              activity.
            </p>
            <ul className="tab-list" style={{ marginTop: 18 }}>
              <li><strong>Manage schedules:</strong> keep appointments organised and easier to track.</li>
              <li><strong>Reduce scheduling confusion:</strong> give staff a shared view of appointments.</li>
              <li><strong>Keep patient information connected:</strong> access relevant patient details alongside appointment information.</li>
              <li><strong>Make the day easier to manage:</strong> give your team a clearer picture of what is coming up.</li>
            </ul>
          </div>
          <div className="split-visual">
            <div className="img-wrapper">
              <img
                src={images.ePrescription}
                alt="Clinic team managing appointments in KIBO360 CMS"
                className="main-img"
                loading="lazy"
                width="900"
                height="675"
              />
              <div className="img-overlay right">
                <div className="overlay-header"><span className="ohl"><Icon name="calendar" size={16} /> Today's Schedule</span></div>
                <div className="overlay-item-flex"><span>10:00 AM · Follow-up consult</span> <span className="lbl-good">Confirmed</span></div>
                <div className="overlay-item-flex"><span>10:30 AM · New patient visit</span> <span className="lbl-busy">In-Queue</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fold 6 - patient journey (workflow chain kept) */}
      <section className="tight">
        <div className="container">
          <SectionHeading
            eyebrow="The Patient Journey"
            title="Keep the Patient Journey Connected From First Visit to Follow-Up."
            subtitle="Patient care doesn't begin and end with the consultation. Registration, appointments, clinical information, billing, and follow-ups all form part of the patient's journey. Kibo360 CMS helps connect these processes, so your team can manage patient information throughout their interactions with your clinic."
          />
          <div className="workflow">
            {journeySteps.map((s, i) => (
              <div key={s} style={{ display: "contents" }}>
                <span className="workflow-step">
                  <span className="workflow-num">{i + 1}</span>
                  {s}
                </span>
                {i < journeySteps.length - 1 && <span className="workflow-arrow">→</span>}
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", margin: "20px auto 0", fontWeight: 700, color: "var(--primary)" }}>
            One connected process. Less information to chase.
          </p>
        </div>
      </section>

      {/* Fold 7 - records (dark band) */}
      <section className="band-dark">
        <div className="container">
          <SectionHeading
            title="Give Your Team the Patient Information They Need, When They Need It"
            subtitle="Patient information becomes harder to manage as a clinic grows. Kibo360 CMS helps keep clinical records organised within a central system, making it easier for authorised users to access relevant information when managing patients."
          />
          <p style={{ textAlign: "center", margin: "0 auto", color: "rgba(255,255,255,0.85)", maxWidth: "58ch" }}>
            The result is a more organised way to manage records without relying on
            scattered files or disconnected systems.
          </p>
        </div>
      </section>

      {/* Fold 8 - less busywork (image split kept) */}
      <section>
        <div className="container split reverse">
          <div>
            <span className="eyebrow pink">Less Busywork</span>
            <h2>Take the Busywork Out of Running Your Clinic</h2>
            <p style={{ margin: "14px 0 6px" }}>
              Your team's time is better spent with patients than on repetitive
              administrative tasks. Kibo360 CMS helps simplify everyday processes and
              keeps related information together, reducing the need to repeatedly
              enter, search for, or move information between different systems.
            </p>
            <ul className="tab-list" style={{ marginTop: 18 }}>
              <li><strong>Less manual administration:</strong> make repetitive tasks easier to manage.</li>
              <li><strong>Less searching:</strong> keep important information organised in one system.</li>
              <li><strong>Better coordination:</strong> help clinical and administrative teams work from connected information.</li>
              <li><strong>More time for patients:</strong> reduce the time spent keeping systems and records in order.</li>
            </ul>
            <button type="button" className="btn btn-primary" style={{ marginTop: 24 }} onClick={openDemo}>
              See How Kibo360 Simplifies Clinic Operations
            </button>
          </div>
          <div className="split-visual">
            <div className="img-wrapper">
              <img
                src={images.patientPortal}
                alt="Clinic staff spending time with a patient instead of paperwork"
                className="main-img"
                loading="lazy"
                width="900"
                height="675"
              />
              <div className="img-overlay">
                <div className="overlay-header"><span className="ohl"><Icon name="check" size={16} /> Daily Tasks</span></div>
                <div className="overlay-item">Patient records updated automatically after each visit.</div>
                <div className="overlay-item">Billing details connected to every appointment.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fold 9 - sensitive information (security chips kept) */}
      <section className="tight">
        <div className="container">
          <SectionHeading
            eyebrow="Data & Access"
            title="Keep Sensitive Patient Information Under Control"
            subtitle="Healthcare organisations handle information that needs to be treated carefully. Kibo360 CMS provides a central environment for managing patient and clinic information, with access designed around the needs of your organisation."
          />
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {integrations.map((i) => <span key={i} className="chip">{i}</span>)}
          </div>
          <div className="chip-row">
            {securityFeatures.map((s) => <span key={s} className="chip lock"><Icon name="lock" size={14} /> {s}</span>)}
          </div>
        </div>
      </section>

      {/* Fold 10 - personas */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="Who It's For"
            title="Built for the People Who Keep Your Clinic Moving"
            subtitle="Kibo360 CMS is designed for the different people involved in managing a healthcare practice."
          />
          <div className="trust-bar">
            {personas.map((p) => (
              <div key={p.title} className="trust-item">
                <span className="trust-icon" aria-hidden="true">
                  <Icon name={p.icon} size={19} />
                </span>
                <div>
                  <strong>{p.title}</strong>
                  <span>{p.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fold 11 (blank in doc) - testimonials kept */}
      <section>
        <div className="container">
          <SectionHeading eyebrow="What Clinics Say" title="Loved by doctors and clinic teams." />
          <div className="test-grid">
            {testimonials.map((t) => (
              <figure key={t.name} className="test-card">
                <span className="quote-mark" aria-hidden="true">“</span>
                <blockquote>{t.quote}</blockquote>
                <figcaption className="test-user">
                  {t.img ? (
                    <img src={t.img} alt="" className="test-avatar" loading="lazy" width="96" height="96" />
                  ) : (
                    <span className="test-avatar initials" aria-hidden="true">
                      {t.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </span>
                  )}
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Folds 12 & 13 - why Kibo360 CMS (SEO copy) */}
      <section className="tight">
        <div className="container" style={{ maxWidth: 860 }}>
          <SectionHeading
            title="The Best Clinical Management Software Should Make Work Simpler"
            subtitle="Choosing the Best Clinical Management Software isn't just about having more features. Kibo360 focuses on bringing essential clinical and administrative processes together in a practical system that your team can actually use every day."
          />
          <p style={{ maxWidth: "none", textAlign: "center", marginBottom: 34 }}>
            For clinics looking for Clinical Management Software for Clinics, Kibo360
            provides fewer disconnected systems, better organised information, and a
            smoother way to run the practice.
          </p>
          <SectionHeading
            title="Clinical Management Software Designed for the Way Modern Practices Work"
            subtitle="Every clinic has its own patients, teams, processes, and operational requirements. Kibo360 provides Clinical Management Software in India that brings essential clinic processes together while giving practices room to adapt as their needs change."
          />
          <p style={{ maxWidth: "none", textAlign: "center" }}>
            For healthcare organisations searching for Clinical Management Software
            in Noida, Kibo360 offers a broader platform that can support clinical
            operations alongside other business requirements.
          </p>
        </div>
      </section>

      {/* FAQ (kept - also emitted as FAQPage structured data) */}
      <FaqSection faqs={cmsFaqs} title="CMS - frequently asked questions." />

      {/* Fold 14 - final CTA */}
      <CTABanner
        title="Your Patients Need Your Attention. Your Software Shouldn't."
        text="Bring appointments, patients, records, billing, and everyday clinic operations together with Kibo360 CMS. See how a connected clinical management system can make your team's day easier."
        primary={{ label: "Book Your CMS Demo" }}
        secondaryLabel="Talk to a Clinical Management Expert"
      />
    </>
  );
}
