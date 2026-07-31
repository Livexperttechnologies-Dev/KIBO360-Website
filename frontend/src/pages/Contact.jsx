import Seo from "../components/Seo.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import ContactForm from "../components/ContactForm.jsx";
import Icon from "../components/Icon.jsx";
import { company } from "../data/siteData.js";

const contactJsonLd = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Contact KIBO360",
  url: "https://kibo360.in/contact",
  mainEntity: {
    "@type": "Organization",
    "@id": "https://kibo360.in/#org",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: "+91-800-800-5672",
      email: "info@livexperttechnologies.com",
      areaServed: "IN",
      availableLanguage: ["en", "hi"],
    },
  },
};

const infoCards = [
  {
    icon: "map-pin",
    title: "Location",
    body: company.address,
  },
  {
    icon: "phone",
    title: "Call",
    body: company.phone,
    href: `tel:${company.phone.replace(/[^+\d]/g, "")}`,
  },
  {
    icon: "mail",
    title: "Email",
    body: company.email,
    href: `mailto:${company.email}`,
  },
  {
    icon: "globe",
    title: "Website",
    body: company.website,
  },
];

export default function Contact() {
  return (
    <>
      <Seo
        title="Contact Us — Book a Free Demo of KIBO360 HMS or CMS"
        description="Book a free demo of KIBO360 Hospital or Clinic Management Software. Call +91-800 800 5672, email info@livexperttechnologies.com, or send us a message — we respond within one business day."
        path="/contact"
        jsonLd={contactJsonLd}
      />
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Contact Us</span>
          <h1>
            Let&apos;s build your <span className="gradient-text">digital hospital.</span>
          </h1>
          <p className="section-subtitle" style={{ margin: "0 auto" }}>
            Book a demo, ask about pricing, or just say hello — we respond within one
            business day.
          </p>
        </div>
      </section>

      <section>
        <div className="container contact-layout">
          <div>
            <SectionHeading
              eyebrow="Reach us"
              title="We're here to help."
              center={false}
            />
            {infoCards.map((c) => (
              <div key={c.title} className="contact-info-card">
                <span className="contact-info-icon" aria-hidden="true"><Icon name={c.icon} size={22} /></span>
                <div>
                  <h3>{c.title}</h3>
                  {c.href ? <a href={c.href}>{c.body}</a> : <p>{c.body}</p>}
                </div>
              </div>
            ))}
            <div className="contact-info-card">
              <span className="contact-info-icon" aria-hidden="true"><Icon name="clock" size={22} /></span>
              <div>
                <h3>Office Hours</h3>
                <p>Monday – Saturday, 9:30 AM – 6:30 PM IST · 24×7 support for customers</p>
              </div>
            </div>
          </div>

          <ContactForm />
        </div>
      </section>
    </>
  );
}
