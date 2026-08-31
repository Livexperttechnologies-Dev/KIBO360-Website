import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useDemoModal } from "./DemoModalContext.jsx";
import { company } from "../data/siteData.js";

/**
 * Final call-to-action card.
 * Optional overrides (used by Home): `primary` = { label, to } renders a link
 * instead of the default Book-a-Demo modal button; `secondaryLabel` renders a
 * modal-opening button instead of the default phone-call link.
 */
export default function CTABanner({ title, text, primary, secondaryLabel }) {
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
              {primary?.to ? (
                <Link to={primary.to} className="btn btn-light btn-lg">{primary.label}</Link>
              ) : (
                <button type="button" className="btn btn-light btn-lg" onClick={openDemo}>
                  {primary?.label || "Book a Demo"}
                </button>
              )}
              {secondaryLabel ? (
                <button type="button" className="btn btn-call-dark btn-lg" onClick={openDemo}>
                  <Icon name="phone" size={17} /> {secondaryLabel}
                </button>
              ) : (
                <a
                  href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}
                  className="btn btn-call-dark btn-lg"
                >
                  <Icon name="phone" size={17} /> Call {company.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
