import Icon from "./Icon.jsx";
import { T, R, Btn, Img } from "../cms/primitives.jsx";
import { useCompany } from "../cms/content.jsx";

/**
 * Final call-to-action card. Editable keys: eyebrow, title, text, primary,
 * secondary (inside the section's scope).
 */
export default function CTABanner({ title, text, primary, secondaryLabel }) {
  const company = useCompany();
  return (
    <section className="cta-banner">
      <div className="container">
        <div className="cta-card">
          <Img k="mark" src="/favicon.png" alt="" aria-hidden="true" className="cta-mark" width="324" height="324" loading="lazy" />
          <div className="cta-inner">
            <div className="cta-copy">
              <T k="eyebrow" className="cta-eyebrow">Get Started</T>
              <T k="title" as="h2">{title || "Connecting Care. Empowering Life."}</T>
              <R k="text">{text || "See KIBO360 in action - book a personalized demo for your organization."}</R>
            </div>
            <div className="cta-actions">
              <Btn k="primary" className="btn btn-light btn-lg" to={primary?.to} action={primary?.to ? "link" : "demo"}>
                {primary?.label || "Book a Demo"}
              </Btn>
              {secondaryLabel ? (
                <Btn k="secondary" className="btn btn-call-dark btn-lg" action="demo" icon={<><Icon name="phone" size={17} />{" "}</>}>
                  {secondaryLabel}
                </Btn>
              ) : (
                <Btn k="secondary" className="btn btn-call-dark btn-lg" action="tel" href={`tel:${company.phone.replace(/[^+\d]/g, "")}`} icon={<><Icon name="phone" size={17} />{" "}</>}>
                  {`Call ${company.phone}`}
                </Btn>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
