import Seo from "../components/Seo.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import FeatureCard from "../components/FeatureCard.jsx";
import CTABanner from "../components/CTABanner.jsx";
import Icon from "../components/Icon.jsx";
import {
  company, aboutNarrative, valuePillars, capabilityMatrix, targetSectors, roadmap,
} from "../data/siteData.js";

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About KIBO360",
  url: "https://kibo360.in/about",
  mainEntity: { "@id": "https://kibo360.in/#org" },
};

export default function About() {
  return (
    <>
      <Seo
        title="About Us — The Team Behind the KIBO360 Healthcare Platform"
        description="KIBO360 by Livexpert Technologies is a connected digital ecosystem for hospitals, clinics, diagnostic chains and medical colleges — built on the belief that technology should bring teams, processes and information together."
        path="/about"
        jsonLd={aboutJsonLd}
      />
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">About Us</span>
          <h1>
            Where possibilities <span className="gradient-text">come together.</span>
          </h1>
          <p className="section-subtitle" style={{ margin: "0 auto" }}>
            {company.name} — {company.tagline} Powered by {company.poweredBy}.
          </p>
        </div>
      </section>

      {/* Narrative (deck p.2, full text) */}
      <section>
        <div className="container" style={{ maxWidth: 860 }}>
          {aboutNarrative.map((p) => (
            <p key={p.slice(0, 24)} style={{ marginBottom: 18, maxWidth: "none", fontSize: "1.02rem" }}>
              {p}
            </p>
          ))}
          <p style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1.3rem", marginTop: 26 }}>
            <span className="gradient-text">One Platform. Endless Possibilities.</span>
          </p>
        </div>
      </section>

      {/* Value pillars */}
      <section className="tight">
        <div className="container">
          <SectionHeading eyebrow="What we believe" title="Six principles behind everything we build." />
          <div className="grid grid-3">
            {valuePillars.map((v) => (
              <FeatureCard key={v.title} icon={v.icon} title={v.title} text={v.text} />
            ))}
          </div>
        </div>
      </section>

      {/* Strategic pillars */}
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

      {/* Sectors */}
      <section className="tight">
        <div className="container">
          <SectionHeading eyebrow="Who we serve" title="From single clinics to medical colleges." />
          <div className="grid grid-5">
            {targetSectors.map((s) => (
              <div key={s.name} className="sector-tile">
                <span className="s-icon" aria-hidden="true"><Icon name={s.icon} size={30} /></span>
                {s.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap teaser */}
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

      <CTABanner
        title={company.motto}
        text={`Talk to the ${company.poweredBy} team about your digital transformation.`}
      />
    </>
  );
}
