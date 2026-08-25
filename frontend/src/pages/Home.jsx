import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import StatCard from "../components/StatCard.jsx";
import CTABanner from "../components/CTABanner.jsx";
import Icon from "../components/Icon.jsx";
import { useDemoModal } from "../components/DemoModalContext.jsx";
import {
  company, ecosystemNodes, valuePillars, aboutNarrative, platformBadges,
  products, upcomingProducts, capabilityMatrix, platformStats, targetSectors,
  integrations, securityGroups, testimonials, images,
} from "../data/siteData.js";

const indiaReady = [
  { title: "ABDM & ABHA Ready", text: "Create and link ABHA health IDs and connect to the Ayushman Bharat Digital Mission." },
  { title: "NABH-Aligned", text: "Clinical documentation and audit trails that support NABH accreditation readiness." },
  { title: "GST-Compliant Billing", text: "Tax-ready invoicing with GST built into every bill and pharmacy sale." },
  { title: "DPDP Act 2023", text: "Patient data handling aligned with India's Digital Personal Data Protection Act." },
];

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "KIBO360 Products",
  itemListElement: products
    .filter((p) => p.route)
    .map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SoftwareApplication",
        name: `KIBO360 ${p.name}`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        url: `https://kibo360.in${p.route}`,
        description: p.blurb,
      },
    })),
};

function EcosystemOrbit() {
  const step = 360 / ecosystemNodes.length;
  return (
    <div>
      {/* Animated ecosystem wheel: chips pop in one by one, then revolve
          around the KIBO360 logo. Hover pauses; reduced-motion disables. */}
      <div className="orbit" aria-hidden="true">
        <div className="orbit-ring" />
        <div className="orbit-ring inner" />
        <div className="orbit-rotator">
          {ecosystemNodes.map((node, i) => (
            <div
              key={node}
              className="orbit-node"
              style={{ "--a": `${step * i - 90}deg` }}
            >
              <div className="orbit-chip" style={{ "--d": `${0.3 + i * 0.13}s` }}>
                {node}
              </div>
            </div>
          ))}
        </div>
        <div className="orbit-center">
          <img src="/kibo360-logo.png" alt="KIBO360" className="orbit-logo" width="331" height="135" />
        </div>
      </div>
      <div className="orbit-fallback">
        {ecosystemNodes.map((node) => <span key={node}>{node}</span>)}
      </div>
    </div>
  );
}

export default function Home() {
  const [marqueePaused, setMarqueePaused] = useState(false);
  const { openDemo } = useDemoModal();

  // Product scroller arrow controls
  const scrollerRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);
  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows]);
  const scrollByCard = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector(".product-card");
    const step = (card ? card.getBoundingClientRect().width : 280) + 18;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <>
      <Seo
        title="KIBO360 - Hospital & Clinic Management Software on One Platform"
        description="KIBO360 is an AI-powered, cloud-native healthcare ERP by Livexpert Technologies. Run your hospital or clinic on one intelligent database - HMS, CMS, diagnostics, pharmacy, billing, finance and HR."
        path="/"
        jsonLd={homeJsonLd}
      />
      {/* 1 - Hero (deck p.2 idea: the connected ecosystem) */}
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="hero-badges">
              <div><span className="hero-badge"><Icon name="rocket" size={14} /> A Platform Built By Livexpert Technologies</span></div>
              <div><span className="hero-badge soft"><Icon name="cpu" size={14} /> AI Powered</span>
              <span className="hero-badge soft"><Icon name="cloud" size={14} /> Cloud Native</span>
              <span className="hero-badge soft"><Icon name="lock" size={14} /> Secure &amp; Compliant</span>
            </div></div>
            <h1>
              One Platform.{" "}
              <span className="gradient-text">Endless Possibilities.</span>
            </h1>
            <p className="hero-text">
              Run your entire hospital or clinic on one intelligent database. KIBO360
              unifies patient care, diagnostics, pharmacy, finance and HR - so your
              teams stop juggling disconnected software and start delivering better
              care, faster.
            </p>
            <div className="hero-actions">
              <Link to="/products" className="btn btn-primary btn-lg">Explore Products</Link>
              <button type="button" className="btn btn-outline btn-lg" onClick={openDemo}>
                Book a Free Demo
              </button>
            </div>
            <p className="hero-note">
             One intelligent platform. Multiple solutions.
Secure, scalable, and built for the future ready. {/*Every product runs on its own subdomain - <code>hms.kibo360.in</code>,{" "}
              <code>cms.kibo360.in</code> - on one shared platform.*/}
            </p>
          </div>
          <EcosystemOrbit />
        </div>
      </section>

      {/* 2 - Trust strip (brochure badges, compact glass bar) */}
      <section className="tight">
        <div className="container">
          <div className="trust-bar">
            {platformBadges.map((b) => (
              <div key={b.title} className="trust-item">
                <span className="trust-icon" aria-hidden="true">
                  <Icon name={b.icon} size={19} />
                </span>
                <div>
                  <strong>{b.title}</strong>
                  <span>{b.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 - About blurb with image (deck p.2) */}
      <section>
        <div className="container split">
          <div>
            <span className="eyebrow">About KIBO360</span>
            <h2>Where possibilities come together.</h2>
            <p style={{ margin: "14px 0 12px" }}>{aboutNarrative[0]}</p>
            <p style={{ marginBottom: 24 }}>{aboutNarrative[1]}</p>
            <Link to="/about" className="btn btn-outline">Our Story</Link>
          </div>
          <div className="split-visual">
            <div className="img-wrapper">
              <img
                src={images.careTeam}
                alt="Care team reviewing a patient's records together"
                className="main-img"
                loading="lazy"
                width="900"
                height="675"
              />
              <div className="img-overlay right">
                <div className="overlay-header">
                  <span>Connecting Care. Empowering Life.</span>
                  <span className="pill green">Live</span>
                </div>
                <div className="overlay-item">One patient record across OPD, IPD, lab &amp; pharmacy</div>
                <div className="overlay-item">Real-time visibility for every department</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 - Six value pillars (deck p.2 bottom row) */}
      <section className="tight">
        <div className="container">
          <SectionHeading
            eyebrow="Why KIBO360"
            title="Six principles behind the platform."
          />
          <div className="grid grid-3">
            {valuePillars.map((v, i) => (
              <div key={v.title} className="pillar-card">
                <div className="pillar-top">
                  <span className="icon-badge" aria-hidden="true">
                    <Icon name={v.icon} size={24} />
                  </span>
                  <span className="pillar-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 - Products catalogue */}
      <section id="products">
        <div className="container">
          <SectionHeading
            eyebrow="Our Products"
            title="One platform. A growing family of products."
            subtitle="Pick the product that fits your organization today - every KIBO360 product shares the same intelligent database, so you can add more as you grow."
          />
          {/* Horizontal scroller: live products + coming-soon cards */}
          <div className="scroller-controls">
            <button
              type="button"
              className="scroller-arrow"
              aria-label="Previous products"
              disabled={!canPrev}
              onClick={() => scrollByCard(-1)}
            >
              <Icon name="chevron-left" size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className="scroller-arrow"
              aria-label="Next products"
              disabled={!canNext}
              onClick={() => scrollByCard(1)}
            >
              <Icon name="chevron-right" size={18} strokeWidth={2.2} />
            </button>
          </div>
          <div className="product-scroller compact" role="list" ref={scrollerRef} onScroll={updateArrows}>
            {products.filter((p) => p.route).map((p) => (
              <article key={p.slug} className="product-card" role="listitem">
                <div className="product-top">
                  <span className="product-avatar">{p.short}</span>
                  <span className="product-status">{p.status}</span>
                </div>
                <h3>{p.name}</h3>
                <p className="blurb">{p.blurb}</p>
                <div className="product-highlights">
                  {p.highlights.map((h) => <span key={h}>{h}</span>)}
                </div>
                <p className="product-sub">
                  Runs at <code>{p.subdomain}</code>
                </p>
                <div className="product-actions">
                  <Link to={p.route} className="btn btn-primary">Learn More</Link>
                  <button type="button" className="btn btn-outline" onClick={openDemo}>
                    Get a Demo
                  </button>
                </div>
              </article>
            ))}
            {upcomingProducts.map((p) => (
              <article key={p.slug} className="product-card soon" role="listitem">
                <div className="product-top">
                  <span className="product-avatar soon-avatar" aria-hidden="true">
                    <Icon name={p.icon} size={24} />
                  </span>
                  <span className="product-status soon">Coming Soon</span>
                </div>
                <h3>{p.name}</h3>
                <p className="blurb">{p.blurb}</p>
                <p className="product-sub">
                  Will run at <code>{p.subdomain}</code>
                </p>
                <div className="product-actions">
                  <button type="button" className="btn btn-outline" onClick={openDemo}>
                    Get Early Access
                  </button>
                </div>
              </article>
            ))}
          </div>
          <p className="scroller-hint">Scroll sideways to see all products — or <Link to="/products">view the full catalog</Link>.</p>
        </div>
      </section>

      {/* 6 - Capability matrix (brochure p.2) */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="Capability & Business Impact"
            title="Four strategic pillars. Measurable impact."
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

      {/* 6b - Built for Indian healthcare (image + compliance) */}
      <section>
        <div className="container split reverse">
          <div>
            <span className="eyebrow orange">Built for India</span>
            <h2>Ready for how Indian healthcare actually runs.</h2>
            <p style={{ margin: "14px 0 20px" }}>
              From ABHA health IDs to GST invoicing and NABH-aligned records, KIBO360
              is built around the standards, schemes and workflows Indian hospitals and
              clinics deal with every day.
            </p>
            <div className="grid grid-2" style={{ gap: 14 }}>
              {indiaReady.map((f) => (
                <div key={f.title} className="feature-card" style={{ padding: "18px 18px" }}>
                  <h3 style={{ fontSize: "1rem" }}>{f.title}</h3>
                  <p style={{ fontSize: "0.85rem" }}>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="split-visual">
            <div className="img-wrapper">
              <img
                src={images.doctorTablet}
                alt="Doctor using KIBO360 on a tablet during a consultation"
                className="main-img"
                loading="lazy"
                width="900"
                height="675"
              />
              <div className="img-overlay">
                <div className="overlay-header">
                  <span>ABHA Verified</span>
                  <span className="pill green">ABDM</span>
                </div>
                <div className="overlay-item-flex"><span>GST Invoice</span> <strong>Auto-generated</strong></div>
                <div className="overlay-item-flex"><span>NABH Documentation</span> <strong>Ready</strong></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7 - Stats band */}
      <section className="band-dark">
        <div className="container">
          <SectionHeading
            title="Proven at scale."
            subtitle="Numbers from KIBO360 deployments."
          />
          <div className="grid grid-5">
            {platformStats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        </div>
      </section>

      {/* 8 - Target sectors (photo tiles) */}
      <section>
        <div className="container">
          <SectionHeading eyebrow="Who it's for" title="Built for every care setting." />
          <div className="grid grid-5 sector-photos">
            {targetSectors.map((s) => (
              <figure key={s.name} className="sector-photo">
                {/* alt is empty: the visible figcaption below carries the name */}
                <img src={s.img} alt="" loading="lazy" width="700" height="875" />
                <figcaption>
                  <span className="sector-photo-icon" aria-hidden="true">
                    <Icon name={s.icon} size={17} />
                  </span>
                  {s.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 9 - Integrations (auto-scrolling marquee) */}
      <section className="tight">
        <div className="container">
          <SectionHeading
            eyebrow="Integrations"
            title="Connects with everything you already use."
          />
        </div>
        <div
          className={`marquee ${marqueePaused ? "paused" : ""}`}
          aria-label="KIBO360 integrations"
        >
          <div className="marquee-track">
            {[...integrations, ...integrations].map((item, idx) => (
              <span key={`${item}-${idx}`} className="chip" aria-hidden={idx >= integrations.length}>
                {item}
              </span>
            ))}
          </div>
        </div>
        {/* Accessible pause control (WCAG 2.2.2) for the auto-scrolling strip */}
        <div className="container" style={{ textAlign: "center" }}>
          <button
            type="button"
            className="marquee-pause"
            aria-pressed={marqueePaused}
            onClick={() => setMarqueePaused((p) => !p)}
          >
            {marqueePaused ? "▶ Play animation" : "❚❚ Pause animation"}
          </button>
        </div>
      </section>

      {/* 10 - Security & Compliance (defense-in-depth hub) */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="Security & Compliance"
            title="Built to protect. Designed to comply."
            subtitle="Defense in depth for patient data — Indian compliance standards on the outside, bank-grade controls at the core."
          />
          <div className="security-hub">
            <div className="security-hub-col left">
              {securityGroups.slice(0, 2).map((g) => (
                <article key={g.key} className="sec-group">
                  <div className="sec-group-head">
                    <span className={`sec-group-icon ${g.tone}`} aria-hidden="true">
                      <Icon name={g.icon} size={18} />
                    </span>
                    <h3>{g.label}</h3>
                  </div>
                  <ul>
                    {g.items.map((item) => (
                      <li key={item}><Icon name="check" size={13} strokeWidth={2.4} /> {item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="security-core">
              <div className="core-visual" aria-hidden="true">
                <span className="core-ring" />
                <span className="core-ring r2" />
                <span className="core-ring r3" />
                <div className="core-emblem">
                  <Icon name="shield" size={44} strokeWidth={1.5} />
                </div>
              </div>
              <p className="core-title">Secure by Design</p>
              <p className="core-sub">Bank-grade protection at the core of every module</p>
            </div>

            <div className="security-hub-col right">
              {securityGroups.slice(2).map((g) => (
                <article key={g.key} className="sec-group">
                  <div className="sec-group-head">
                    <span className={`sec-group-icon ${g.tone}`} aria-hidden="true">
                      <Icon name={g.icon} size={18} />
                    </span>
                    <h3>{g.label}</h3>
                  </div>
                  <ul>
                    {g.items.map((item) => (
                      <li key={item}><Icon name="check" size={13} strokeWidth={2.4} /> {item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 10b - Testimonials (placeholder quotes - replace with real customers) */}
      <section>
        <div className="container">
          <SectionHeading
            eyebrow="What Teams Say"
            title="Trusted by care teams and administrators."
            subtitle="From front desk to finance, KIBO360 changes how the whole organization works."
          />
          <div className="test-grid">
            {testimonials.map((t) => (
              <figure key={t.role} className="test-card">
                <span className="quote-mark" aria-hidden="true">“</span>
                <blockquote>{t.quote}</blockquote>
                <figcaption className="test-user">
                  {t.img ? (
                    <img
                      src={t.img}
                      alt=""
                      className="test-avatar"
                      loading="lazy"
                      width="96"
                      height="96"
                    />
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

      {/* 11 - CTA */}
      <CTABanner
        title={company.motto}
        text="See how KIBO360 unifies your entire organization - book a personalized demo."
      />
    </>
  );
}
