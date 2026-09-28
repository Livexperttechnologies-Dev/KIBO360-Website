import Seo from "../components/Seo.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import FeatureCard from "../components/FeatureCard.jsx";
import CTABanner from "../components/CTABanner.jsx";
import Icon from "../components/Icon.jsx";
import { PageDoc, useCompany } from "../cms/content.jsx";
import { T, R, Btn, List, Ico, Sec } from "../cms/primitives.jsx";
import { Sections } from "../cms/sections.jsx";
import { valuePillars, capabilityMatrix, targetSectors, roadmap } from "../data/siteData.js";

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About KIBO360",
  url: "https://kibo360.in/about",
  mainEntity: { "@id": "https://kibo360.in/#org" },
};

const certs = [
  { id: "iso", icon: "award", title: "ISO 9001:2015 Certified", html: "Livexpert Technologies is certified for <strong>Quality Management Systems</strong> under ISO 9001:2015 - the processes behind building, delivering and supporting Kibo360 meet the international quality standard." },
  { id: "cmmi", icon: "target", title: "CMMI Level 3", html: "Appraised at <strong>CMMI Maturity Level 3</strong> - our engineering and delivery processes are defined, standardized and consistently managed across projects." },
  { id: "abha", icon: "shield", title: "ABHA Certified", html: "Kibo360 holds <strong>ABHA certification</strong> under the Ayushman Bharat Digital Mission - create, verify and link ABHA health IDs directly from our healthcare products." },
];

// Page copy comes verbatim from "About Us Page- Kibo360.docx"
export default function About() {
  const company = useCompany();
  return (
    <PageDoc id="about">
      <Seo page="about" jsonLd={aboutJsonLd} />
      <Sections>
        <Sec id="hero" label="Hero" noDuplicate>
          <section className="page-hero">
            <div className="container">
              <T k="eyebrow" className="eyebrow">About Us</T>
              <h1><T k="title">Too Many Tools?</T>{" "}<T k="titleHighlight" className="gradient-text">Run Your Business in One Place.</T></h1>
              <R k="text" className="section-subtitle" style={{ margin: "0 auto 22px" }}>As a business, you shouldn&apos;t have to juggle multiple tools. Kibo360 frees you from all the software mess and brings it all to one place. Manage operations, customer relationships, content, and other specialised processes with one platform.</R>
              <Btn k="cta" className="btn btn-primary btn-lg" action="demo">Build a Better Way to Work</Btn>
            </div>
          </section>
        </Sec>

        <Sec id="story" label="About Kibo360">
          <section>
            <div className="container" style={{ maxWidth: 860 }}>
              <T k="title" as="h2" style={{ marginBottom: 18 }}>About Kibo360</T>
              <R k="p1" style={{ marginBottom: 18, maxWidth: "none", fontSize: "1.02rem" }}>Kibo360 is a business software platform that brings different business functions together in one place. Manage core business functions and specialised processes with greater efficiency.</R>
              <R k="p2" style={{ marginBottom: 18, maxWidth: "none", fontSize: "1.02rem" }}>With solutions like ERP, CRM, HMS, LIS, CMS, and more, you can organise information, serve customers, and handle industry-specific work through one growing platform. Whether you are running a business, managing a team, serving customers, or overseeing specialised operations, Kibo360 helps you bring your work together and stay in control.</R>
              <R k="p3" style={{ maxWidth: "none", fontSize: "1.02rem" }}>And as your business grows, Kibo360 grows with you, with new solutions and capabilities built around the changing needs of modern businesses.</R>
            </div>
          </section>
        </Sec>

        <Sec id="why" label="Why we built Kibo360">
          <section className="tight">
            <div className="container">
              <SectionHeading title="Why We Built Kibo360" subtitle="Kibo360 is built with a bigger vision than a fixed set of business applications. We are creating a platform that brings together solutions for different industries, business functions, and evolving needs." />
              <div className="container" style={{ maxWidth: 860, marginBottom: 30 }}>
                <R k="p1" style={{ marginBottom: 14, maxWidth: "none", textAlign: "center" }}>Today, Kibo360 supports areas such as HMS, CMS, LIS, ERP, and CRM. Our vision is to grow as businesses grow, with expanding solutions, addressing new challenges, and helping more businesses work efficiently.</R>
                <R k="p2" style={{ maxWidth: "none", textAlign: "center" }}>Our focus is to keep expanding what businesses can do with Kibo360, giving them access to more useful technology without having to look for a new solution every time their needs change.</R>
              </div>
              <div className="grid grid-3">
                <List k="pillars" items={valuePillars}>{(v) => <FeatureCard icon={v.icon} title={v.title} text={v.text} />}</List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="approach" label="Strategic pillars">
          <section>
            <div className="container">
              <SectionHeading eyebrow="Our Approach" title="Four strategic pillars. One connected platform." />
              <div className="grid grid-2">
                <List k="matrix" items={capabilityMatrix} getId={(m) => m.pillar}>
                  {(m) => (
                    <article className="matrix-card">
                      <T k="pillar" as="h3">{m.pillar}</T>
                      <R k="text" style={{ fontSize: "0.92rem" }}>{m.text}</R>
                      <div className="matrix-caps"><List k="caps" items={m.capabilities}>{(c) => <T k="text">{c}</T>}</List></div>
                      <p className="matrix-impact"><Icon name="trending-up" size={16} /> <T k="impact">{m.impact}</T></p>
                    </article>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="certifications" label="Certifications">
          <section className="tight">
            <div className="container">
              <SectionHeading eyebrow="Certifications" title="Certified. Compliant. Trusted." subtitle="Our processes and products are independently certified, so you can build on Kibo360 with confidence." />
              <div className="grid grid-3">
                <List k="certs" items={certs}>
                  {(c) => (
                    <div className="feature-card cert-flag">
                      <span className="icon-badge" aria-hidden="true"><Ico name={c.icon} size={24} /></span>
                      <T k="title" as="h3">{c.title}</T>
                      <R k="text" html={c.html} />
                    </div>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="sectors" label="Who we serve">
          <section className="tight">
            <div className="container">
              <SectionHeading eyebrow="Who we serve" title="Different Businesses. Different Needs. One Growing Vision." subtitle="No two businesses operate exactly the same way. Their teams, processes, challenges, and priorities can all be different." />
              <div className="grid grid-5">
                <List k="sectors" items={targetSectors}>
                  {(s) => (
                    <div className="sector-tile">
                      <span className="s-icon" aria-hidden="true"><Ico name={s.icon} size={30} /></span>
                      <T k="name">{s.name}</T>
                    </div>
                  )}
                </List>
              </div>
              <R k="text" className="section-subtitle" style={{ margin: "26px auto 18px", textAlign: "center" }}>Kibo360 is being built with that reality in mind. Our growing range of solutions supports different industries and business functions, from everyday business management to specialised operations.</R>
              <p style={{ textAlign: "center", margin: "0 auto" }}><Btn k="cta" to="/products" className="btn btn-outline">Find Your Solution</Btn></p>
            </div>
          </section>
        </Sec>

        <Sec id="roadmap" label="Looking ahead">
          <section>
            <div className="container">
              <SectionHeading eyebrow="Looking Ahead" title="Building the intelligent hospital of tomorrow." />
              <div className="grid grid-4">
                <List k="items" items={roadmap.slice(0, 4)} getId={(r) => r.title}>
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

        <Sec id="cta" label="Final call to action">
          <CTABanner
            title="Ready to Make Software One Less Thing to Worry About?"
            text={`Talk to the ${company.legalName} team about your digital transformation.`}
            primary={{ label: "Let's Make Your Business Easier Together" }}
          />
        </Sec>
      </Sections>
    </PageDoc>
  );
}
