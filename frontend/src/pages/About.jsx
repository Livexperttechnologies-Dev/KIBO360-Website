import Seo from "../components/Seo.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import FeatureCard from "../components/FeatureCard.jsx";
import CTABanner from "../components/CTABanner.jsx";
import Icon from "../components/Icon.jsx";
import { useDemoModal } from "../components/DemoModalContext.jsx";
import {
  company, valuePillars, capabilityMatrix, targetSectors, roadmap,
} from "../data/siteData.js";
import { Link } from "react-router-dom";

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About KIBO360",
  url: "https://kibo360.in/about",
  mainEntity: { "@id": "https://kibo360.in/#org" },
};

// Page copy comes verbatim from "About Us Page- Kibo360.docx"
export default function About() {
  const { openDemo } = useDemoModal();
  return (
    <>
      <Seo
        title="About Us — The Team Behind the KIBO360 Platform"
        description="KIBO360 by Livexpert Technologies is a connected digital ecosystem for hospitals, clinics, diagnostic chains and medical colleges — built on the belief that technology should bring teams, processes and information together."
        path="/about"
        jsonLd={aboutJsonLd}
      />
      {/* Fold 1 — hero */}
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">About Us</span>
          <h1>
            Too Many Tools?{" "}
            <span className="gradient-text">Run Your Business in One Place.</span>
          </h1>
          <p className="section-subtitle" style={{ margin: "0 auto 22px" }}>
            As a business, you shouldn&apos;t have to juggle multiple tools. Kibo360
            frees you from all the software mess and brings it all to one place.
            Manage operations, customer relationships, content, and other specialised
            processes with one platform.
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={openDemo}>
            Build a Better Way to Work
          </button>
        </div>
      </section>

      {/* Fold 2 — About Kibo360 */}
      <section>
        <div className="container" style={{ maxWidth: 860 }}>
          <h2 style={{ marginBottom: 18 }}>About Kibo360</h2>
          <p style={{ marginBottom: 18, maxWidth: "none", fontSize: "1.02rem" }}>
            Kibo360 is a business software platform that brings different business
            functions together in one place. Manage core business functions and
            specialised processes with greater efficiency.
          </p>
          <p style={{ marginBottom: 18, maxWidth: "none", fontSize: "1.02rem" }}>
            With solutions like ERP, CRM, HMS, LIS, CMS, and more, you can organise
            information, serve customers, and handle industry-specific work through
            one growing platform. Whether you are running a business, managing a
            team, serving customers, or overseeing specialised operations, Kibo360
            helps you bring your work together and stay in control.
          </p>
          <p style={{ maxWidth: "none", fontSize: "1.02rem" }}>
            And as your business grows, Kibo360 grows with you, with new solutions
            and capabilities built around the changing needs of modern businesses.
          </p>
        </div>
      </section>

      {/* Fold 3 — Why We Built Kibo360 (existing pillar cards kept) */}
      <section className="tight">
        <div className="container">
          <SectionHeading
            title="Why We Built Kibo360"
            subtitle="Kibo360 is built with a bigger vision than a fixed set of business applications. We are creating a platform that brings together solutions for different industries, business functions, and evolving needs."
          />
          <div className="container" style={{ maxWidth: 860, marginBottom: 30 }}>
            <p style={{ marginBottom: 14, maxWidth: "none", textAlign: "center" }}>
              Today, Kibo360 supports areas such as HMS, CMS, LIS, ERP, and CRM. Our
              vision is to grow as businesses grow, with expanding solutions,
              addressing new challenges, and helping more businesses work efficiently.
            </p>
            <p style={{ maxWidth: "none", textAlign: "center" }}>
              Our focus is to keep expanding what businesses can do with Kibo360,
              giving them access to more useful technology without having to look for
              a new solution every time their needs change.
            </p>
          </div>
          <div className="grid grid-3">
            {valuePillars.map((v) => (
              <FeatureCard key={v.title} icon={v.icon} title={v.title} text={v.text} />
            ))}
          </div>
        </div>
      </section>

      {/* Fold 4 (blank in doc) — strategic pillars kept as-is */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="Our Approach"
            title="Four strategic pillars. One connected platform."
          />
          <div className="grid grid-2">
            {capabilityMatrix.map((m) => (
              <article key={m.pillar} className="matrix-card">
                <h3>{m.pillar}</h3>
                <p style={{ fontSize: "0.92rem" }}>{m.text}</p>
                <div className="matrix-caps">
                  {m.capabilities.map((c) => <span key={c}>{c}</span>)}
                </div>
                <p className="matrix-impact"><Icon name="trending-up" size={16} /> {m.impact}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Fold 5 — industries */}
      <section className="tight">
        <div className="container">
          <SectionHeading
            eyebrow="Who we serve"
            title="Different Businesses. Different Needs. One Growing Vision."
            subtitle="No two businesses operate exactly the same way. Their teams, processes, challenges, and priorities can all be different."
          />
          <div className="grid grid-5">
            {targetSectors.map((s) => (
              <div key={s.name} className="sector-tile">
                <span className="s-icon" aria-hidden="true"><Icon name={s.icon} size={30} /></span>
                {s.name}
              </div>
            ))}
          </div>
          <p className="section-subtitle" style={{ margin: "26px auto 18px", textAlign: "center" }}>
            Kibo360 is being built with that reality in mind. Our growing range of
            solutions supports different industries and business functions, from
            everyday business management to specialised operations.
          </p>
          <p style={{ textAlign: "center", margin: "0 auto" }}>
            <Link to="/products" className="btn btn-outline">Find Your Solution</Link>
          </p>
        </div>
      </section>

      {/* Roadmap teaser (no matching fold — kept as-is) */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="Looking Ahead"
            title="Building the intelligent hospital of tomorrow."
          />
          <div className="grid grid-4">
            {roadmap.slice(0, 4).map((r) => (
              <article key={r.step} className="roadmap-card">
                <span className="roadmap-step">{r.step}</span>
                <h3>{r.title}</h3>
                <p>{r.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Fold 6 — final CTA */}
      <CTABanner
        title="Ready to Make Software One Less Thing to Worry About?"
        text={`Talk to the ${company.poweredBy} team about your digital transformation.`}
        primary={{ label: "Let's Make Your Business Easier Together" }}
      />
    </>
  );
}
