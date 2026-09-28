import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import FeatureCard from "../components/FeatureCard.jsx";
import CTABanner from "../components/CTABanner.jsx";
import FaqSection, { useFaqJsonLd } from "../components/FaqSection.jsx";
import Icon from "../components/Icon.jsx";
import { PageDoc } from "../cms/content.jsx";
import { T, R, Img, Btn, List, Ico, Sec } from "../cms/primitives.jsx";
import { Sections } from "../cms/sections.jsx";
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

const heroBadges = [
  { id: "built", icon: "stethoscope", text: "Built for Modern Clinics", primary: true },
  { id: "ai", icon: "sparkle", text: "AI Powered" },
  { id: "secure", icon: "sparkle", text: "Secure" },
  { id: "cloud", icon: "sparkle", text: "Cloud Based" },
];

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KIBO360 Clinical Management System (CMS)",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  url: "https://kibo360.in/products/clinicalmanagementsoftware",
  description: "Clinical Management Software in India - patient management, appointments, clinical records, billing, staff management and reports for clinics and healthcare practices, in one connected system.",
  publisher: { "@id": "https://kibo360.in/#org" },
  offers: { "@type": "Offer", availability: "https://schema.org/InStock", url: "https://kibo360.in/contact" },
};

function Journey() {
  return (
    <div className="workflow">
      <List k="steps" items={journeySteps}>
        {(s, { index: i }) => (
          <div style={{ display: "contents" }}>
            <span className="workflow-step"><span className="workflow-num">{i + 1}</span><T k="text">{s}</T></span>
            <span className="workflow-arrow">→</span>
          </div>
        )}
      </List>
    </div>
  );
}

export default function ProductCMS() {
  const faqLd = useFaqJsonLd("page:cms", "faq.items", cmsFaqs);
  return (
    <PageDoc id="cms">
      <Seo page="cms" jsonLd={[appJsonLd, faqLd]} />
      <Sections>
        <Sec id="breadcrumbs" label="Breadcrumbs" noDuplicate>
          <div className="container"><Breadcrumbs page="cms" /></div>
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
                <T k="title" as="h1">Simplify the Work Behind Better Patient Care</T>
                <R k="text" className="hero-text">Running a clinic means managing patients, appointments, records, billing, staff, and countless daily tasks. Kibo360 Clinical Management System brings these processes together in one place, helping your team spend less time on administration and more time focused on patient care.</R>
                <div className="hero-actions">
                  <Btn k="primary" className="btn btn-primary btn-lg" action="demo">See Kibo360 CMS in Action</Btn>
                  <Btn k="secondary" className="btn btn-outline btn-lg" to="/contact">Talk to a Clinical Management Expert</Btn>
                </div>
                <R k="note" className="hero-note" html="Product application runs at <code>cms.kibo360.in</code>" />
              </div>
              <div className="mini-dash" aria-label="KIBO360 CMS preview">
                <div className="mini-dash-head">
                  <T k="dashTitle" className="mini-dash-title">KIBO360 · Clinic Dashboard</T>
                  <div className="mini-dash-user">
                    <div className="mini-dash-avatar">DR</div>
                    <div>
                      <T k="dashUser" as="strong">Dr. A. Verma</T>
                      <T k="dashRole">Clinic Owner</T>
                    </div>
                  </div>
                </div>
                <div className="mini-dash-grid">
                  <List k="dash" items={[
                    { id: "appts", k: "Appointments Today", v: "64", d: "↑ 9% vs yesterday" },
                    { id: "queue", k: "In Queue", v: "7", d: "Avg wait 12 min" },
                    { id: "coll", k: "Today's Collections", v: "₹45,760", d: "↑ 15.3%" },
                    { id: "follow", k: "Follow-ups Sent", v: "38", d: "via WhatsApp" },
                  ]}>
                    {(c) => (
                      <div className="mini-dash-card">
                        <T k="label" as="p" className="k">{c.k}</T>
                        <T k="value" as="p" className="v">{c.v}</T>
                        <T k="delta" as="p" className="d">{c.d}</T>
                      </div>
                    )}
                  </List>
                </div>
                <div className="mini-dash-footer">
                  <span><T k="foot1">No-shows this week</T> <T k="foot1v" as="strong">↓ 41%</T></span>
                  <span><T k="foot2">Patient rating</T> <T k="foot2v" as="strong">4.8★</T></span>
                </div>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="intro" label="What a CMS is">
          <section className="tight">
            <div className="container" style={{ maxWidth: 860 }}>
              <SectionHeading title="One System for the Work That Keeps Your Clinic Running" subtitle="A Clinical Management System helps healthcare practices manage the clinical and administrative work that happens around patient care." />
              <R k="p1" style={{ maxWidth: "none", textAlign: "center", marginBottom: 14 }}>Kibo360 CMS brings patient information, appointments, clinical records, billing, staff management, and everyday workflows into one connected system.</R>
              <R k="p2" style={{ maxWidth: "none", textAlign: "center" }}>Instead of relying on spreadsheets, paper records, separate applications, and manual processes, your team can manage essential clinic operations from one place.</R>
            </div>
          </section>
        </Sec>

        <Sec id="problem" label="The problem">
          <section>
            <div className="container">
              <SectionHeading eyebrow="The Problem" title="Your Clinic Shouldn't Have to Run on Spreadsheets, Paperwork, and Memory" subtitle="When your clinic grows, so does the amount of information your team has to manage. Appointments need to be scheduled. Patient information needs to be updated. Records need to be accessible. Bills need to be managed. Staff need to stay coordinated." />
              <R k="text" style={{ textAlign: "center", margin: "0 auto 26px", maxWidth: "62ch" }}>When all of this happens across disconnected systems, things get missed, and your team spends valuable time keeping the processes together. Kibo360 CMS gives your clinic one system to bring these moving parts together.</R>
              <div className="problem-grid">
                <List k="cards" items={problemCards} getId={(c) => c.fix}>
                  {(c) => (
                    <div className="pain-card">
                      <span className="pain-icon" aria-hidden="true"><Ico name={c.icon} size={19} /></span>
                      <div>
                        <span className="muted"><T k="pain">{c.pain}</T> →</span>
                        <T k="fix" as="h3">{c.fix}</T>
                        <R k="text">{c.text}</R>
                      </div>
                    </div>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="functions" label="Core functions">
          <section id="cms-modules">
            <div className="container">
              <SectionHeading eyebrow="Core Functions" title="Manage the Everyday Work of Your Clinic From One Place" subtitle="Kibo360 CMS brings together the core functions your clinic needs to manage patients and daily operations." />
              <div className="grid grid-3">
                <List k="cards" items={coreFunctions}>{(m) => <FeatureCard icon={m.icon} title={m.title} text={m.text} />}</List>
              </div>
              <p style={{ textAlign: "center", margin: "26px auto 0" }}>
                <Btn k="cta" className="btn btn-primary" action="demo">Explore Kibo360 CMS</Btn>
              </p>
            </div>
          </section>
        </Sec>

        <Sec id="appointments" label="Appointments">
          <section>
            <div className="container split">
              <div>
                <T k="eyebrow" className="eyebrow">Appointments</T>
                <T k="title" as="h2">Make Every Appointment Easier to Manage.</T>
                <R k="text" style={{ margin: "14px 0 6px" }}>A busy clinic needs more than a calendar. Your team needs to know what is scheduled, who is coming in, and what needs attention throughout the day. Kibo360 CMS helps organise appointments and schedules in one place, giving your team better visibility into the clinic&apos;s day-to-day activity.</R>
                <ul className="tab-list" style={{ marginTop: 18 }}>
                  <List k="points" items={[
                    { id: "manage", html: "<strong>Manage schedules:</strong> keep appointments organised and easier to track." },
                    { id: "confusion", html: "<strong>Reduce scheduling confusion:</strong> give staff a shared view of appointments." },
                    { id: "connected", html: "<strong>Keep patient information connected:</strong> access relevant patient details alongside appointment information." },
                    { id: "day", html: "<strong>Make the day easier to manage:</strong> give your team a clearer picture of what is coming up." },
                  ]}>{(p) => <R k="text" as="li" html={p.html} />}</List>
                </ul>
              </div>
              <div className="split-visual">
                <div className="img-wrapper">
                  <Img k="image" src={images.ePrescription} alt="Clinic team managing appointments in KIBO360 CMS" className="main-img" loading="lazy" width="900" height="675" />
                  <div className="img-overlay right">
                    <div className="overlay-header"><span className="ohl"><Icon name="calendar" size={16} /> <T k="overlayTitle">Today&apos;s Schedule</T></span></div>
                    <div className="overlay-item-flex"><T k="row1">10:00 AM · Follow-up consult</T> <T k="row1s" className="lbl-good">Confirmed</T></div>
                    <div className="overlay-item-flex"><T k="row2">10:30 AM · New patient visit</T> <T k="row2s" className="lbl-busy">In-Queue</T></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="journey" label="Patient journey">
          <section className="tight">
            <div className="container">
              <SectionHeading eyebrow="The Patient Journey" title="Keep the Patient Journey Connected From First Visit to Follow-Up." subtitle="Patient care doesn't begin and end with the consultation. Registration, appointments, clinical information, billing, and follow-ups all form part of the patient's journey. Kibo360 CMS helps connect these processes, so your team can manage patient information throughout their interactions with your clinic." />
              <Journey />
              <T k="tagline" as="p" style={{ textAlign: "center", margin: "20px auto 0", fontWeight: 700, color: "var(--primary)" }}>One connected process. Less information to chase.</T>
            </div>
          </section>
        </Sec>

        <Sec id="records" label="Patient records">
          <section className="band-dark">
            <div className="container">
              <SectionHeading title="Give Your Team the Patient Information They Need, When They Need It" subtitle="Patient information becomes harder to manage as a clinic grows. Kibo360 CMS helps keep clinical records organised within a central system, making it easier for authorised users to access relevant information when managing patients." />
              <R k="text" style={{ textAlign: "center", margin: "0 auto", color: "rgba(255,255,255,0.85)", maxWidth: "58ch" }}>The result is a more organised way to manage records without relying on scattered files or disconnected systems.</R>
            </div>
          </section>
        </Sec>

        <Sec id="busywork" label="Less busywork">
          <section>
            <div className="container split reverse">
              <div>
                <T k="eyebrow" className="eyebrow pink">Less Busywork</T>
                <T k="title" as="h2">Take the Busywork Out of Running Your Clinic</T>
                <R k="text" style={{ margin: "14px 0 6px" }}>Your team&apos;s time is better spent with patients than on repetitive administrative tasks. Kibo360 CMS helps simplify everyday processes and keeps related information together, reducing the need to repeatedly enter, search for, or move information between different systems.</R>
                <ul className="tab-list" style={{ marginTop: 18 }}>
                  <List k="points" items={[
                    { id: "manual", html: "<strong>Less manual administration:</strong> make repetitive tasks easier to manage." },
                    { id: "search", html: "<strong>Less searching:</strong> keep important information organised in one system." },
                    { id: "coord", html: "<strong>Better coordination:</strong> help clinical and administrative teams work from connected information." },
                    { id: "time", html: "<strong>More time for patients:</strong> reduce the time spent keeping systems and records in order." },
                  ]}>{(p) => <R k="text" as="li" html={p.html} />}</List>
                </ul>
                <Btn k="cta" className="btn btn-primary" action="demo" style={{ marginTop: 24 }}>See How Kibo360 Simplifies Clinic Operations</Btn>
              </div>
              <div className="split-visual">
                <div className="img-wrapper">
                  <Img k="image" src={images.patientPortal} alt="Clinic staff spending time with a patient instead of paperwork" className="main-img" loading="lazy" width="900" height="675" />
                  <div className="img-overlay">
                    <div className="overlay-header"><span className="ohl"><Icon name="check" size={16} /> <T k="overlayTitle">Daily Tasks</T></span></div>
                    <T k="overlay1" as="div" className="overlay-item">Patient records updated automatically after each visit.</T>
                    <T k="overlay2" as="div" className="overlay-item">Billing details connected to every appointment.</T>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="data" label="Data & access">
          <section className="tight">
            <div className="container">
              <SectionHeading eyebrow="Data & Access" title="Keep Sensitive Patient Information Under Control" subtitle="Healthcare organisations handle information that needs to be treated carefully. Kibo360 CMS provides a central environment for managing patient and clinic information, with access designed around the needs of your organisation." />
              <div className="chip-row" style={{ marginBottom: 16 }}>
                <List k="integrations" items={integrations}>{(i) => <T k="label" className="chip">{i}</T>}</List>
              </div>
              <div className="chip-row">
                <List k="security" items={securityFeatures}>{(s) => <span className="chip lock"><Icon name="lock" size={14} /> <T k="label">{s}</T></span>}</List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="personas" label="Who it's for">
          <section>
            <div className="container">
              <SectionHeading eyebrow="Who It's For" title="Built for the People Who Keep Your Clinic Moving" subtitle="Kibo360 CMS is designed for the different people involved in managing a healthcare practice." />
              <div className="trust-bar">
                <List k="items" items={personas}>
                  {(p) => (
                    <div className="trust-item">
                      <span className="trust-icon" aria-hidden="true"><Ico name={p.icon} size={19} /></span>
                      <div><T k="title" as="strong">{p.title}</T><T k="text">{p.text}</T></div>
                    </div>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="testimonials" label="Testimonials">
          <section>
            <div className="container">
              <SectionHeading eyebrow="What Clinics Say" title="Loved by doctors and clinic teams." />
              <div className="test-grid">
                <List k="items" items={testimonials}>
                  {(t) => (
                    <figure className="test-card">
                      <span className="quote-mark" aria-hidden="true">“</span>
                      <R k="quote" as="blockquote">{t.quote}</R>
                      <figcaption className="test-user">
                        <Img k="avatar" src={t.img} alt="" className="test-avatar" loading="lazy" width="96" height="96" />
                        <div><T k="name" as="strong">{t.name}</T><T k="role">{t.role}</T></div>
                      </figcaption>
                    </figure>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="seo-copy" label="Why Kibo360 CMS">
          <section className="tight">
            <div className="container" style={{ maxWidth: 860 }}>
              <SectionHeading title="The Best Clinical Management Software Should Make Work Simpler" subtitle="Choosing the Best Clinical Management Software isn't just about having more features. Kibo360 focuses on bringing essential clinical and administrative processes together in a practical system that your team can actually use every day." />
              <R k="p1" style={{ maxWidth: "none", textAlign: "center", marginBottom: 34 }}>For clinics looking for Clinical Management Software for Clinics, Kibo360 provides fewer disconnected systems, better organised information, and a smoother way to run the practice.</R>
              <SectionHeading k="heading2" title="Clinical Management Software Designed for the Way Modern Practices Work" subtitle="Every clinic has its own patients, teams, processes, and operational requirements. Kibo360 provides Clinical Management Software in India that brings essential clinic processes together while giving practices room to adapt as their needs change." />
              <R k="p2" style={{ maxWidth: "none", textAlign: "center" }}>For healthcare organisations searching for Clinical Management Software in Noida, Kibo360 offers a broader platform that can support clinical operations alongside other business requirements.</R>
            </div>
          </section>
        </Sec>

        <Sec id="faq" label="FAQ" noDuplicate>
          <FaqSection faqs={cmsFaqs} title="CMS - frequently asked questions." />
        </Sec>

        <Sec id="cta" label="Final call to action">
          <CTABanner
            title="Your Patients Need Your Attention. Your Software Shouldn't."
            text="Bring appointments, patients, records, billing, and everyday clinic operations together with Kibo360 CMS. See how a connected clinical management system can make your team's day easier."
            primary={{ label: "Book Your CMS Demo" }}
            secondaryLabel="Talk to a Clinical Management Expert"
          />
        </Sec>
      </Sections>
    </PageDoc>
  );
}
