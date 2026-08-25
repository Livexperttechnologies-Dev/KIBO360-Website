import Icon from "./Icon.jsx";
import { useDemoModal } from "./DemoModalContext.jsx";
import { company } from "../data/siteData.js";

/**
 * Final call-to-action: a floating brand-gradient card on the light page
 * background, visually separate from the dark footer that follows it.
 */
export default function CTABanner({ title, text }) {
  const { openDemo } = useDemoModal();
  return (
    <section className="cta-banner">
      <div className="container">
        <div className="cta-card">
          <img
            src="/favicon.png"
            alt=""
            aria-hidden="true"
            className="cta-mark"
            width="324"
            height="324"
            loading="lazy"
          />
          <div className="cta-inner">
            <div className="cta-copy">
              <span className="cta-eyebrow">Get Started</span>
              <h2>{title || company.motto}</h2>
              <p>{text || "See KIBO360 in action — book a personalized demo for your organization."}</p>
            </div>
            <div className="cta-actions">
              <button type="button" className="btn btn-light btn-lg" onClick={openDemo}>
                Book a Demo
              </button>
              <a
                href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}
                className="btn btn-call-dark btn-lg"
              >
                <Icon name="phone" size={17} /> Call {company.phone}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
