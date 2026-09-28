import Seo from "../components/Seo.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import ContactForm from "../components/ContactForm.jsx";
import Icon from "../components/Icon.jsx";
import { PageDoc, useCompany, Scope } from "../cms/content.jsx";
import { T, R, Sec } from "../cms/primitives.jsx";
import { Sections } from "../cms/sections.jsx";

function InfoCard({ k, icon, title, body, href }) {
  return (
    <Scope k={k}>
      <div className="contact-info-card">
        <span className="contact-info-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
        <div>
          <T k="title" as="h3">{title}</T>
          {href ? <a href={href}>{body}</a> : <p>{body}</p>}
        </div>
      </div>
    </Scope>
  );
}

export default function Contact() {
  const company = useCompany();
  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact KIBO360",
    url: "https://kibo360.in/contact",
    mainEntity: { "@id": "https://kibo360.in/#org" },
  };
  return (
    <PageDoc id="contact">
      <Seo page="contact" jsonLd={contactJsonLd} />
      <Sections>
        <Sec id="hero" label="Hero" noDuplicate>
          <section className="page-hero">
            <div className="container">
              <T k="eyebrow" className="eyebrow">Contact Us</T>
              <h1><T k="title">Let&apos;s build your</T> <T k="titleHighlight" className="gradient-text">digital hospital.</T></h1>
              <R k="text" className="section-subtitle" style={{ margin: "0 auto" }}>Book a demo, ask about pricing, or just say hello - we respond within one business day.</R>
            </div>
          </section>
        </Sec>

        <Sec id="contact" label="Contact details & form" noDuplicate>
          <section>
            <div className="container contact-layout">
              <div>
                <SectionHeading eyebrow="Reach us" title="We're here to help." center={false} />
                {/* Values come from Super Admin -> Settings -> Company details */}
                <InfoCard k="location" icon="map-pin" title="Location" body={company.address} />
                <InfoCard k="call" icon="phone" title="Call" body={company.phone} href={`tel:${company.phone.replace(/[^+\d]/g, "")}`} />
                <InfoCard k="email" icon="mail" title="Email" body={company.email} href={`mailto:${company.email}`} />
                <InfoCard k="website" icon="globe" title="Website" body={company.website} />
                <Scope k="hours">
                  <div className="contact-info-card">
                    <span className="contact-info-icon" aria-hidden="true"><Icon name="clock" size={22} /></span>
                    <div>
                      <T k="title" as="h3">Office Hours</T>
                      <p>{company.hours}</p>
                    </div>
                  </div>
                </Scope>
              </div>
              <ContactForm />
            </div>
          </section>
        </Sec>
      </Sections>
    </PageDoc>
  );
}
