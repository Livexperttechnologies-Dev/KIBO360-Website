import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import Icon from "../components/Icon.jsx";
import { company } from "../data/siteData.js";

// Landing page after any successful form submission (issue: users should be
// redirected to /thank-you instead of seeing an inline message).
export default function ThankYou() {
  return (
    <>
      <Seo
        title="Thank You"
        description="Thanks for contacting KIBO360 - our team will get back to you within one business day."
        path="/thank-you"
        noindex
      />
      <section className="page-hero">
        <div className="container" style={{ maxWidth: 680, textAlign: "center" }}>
          <span className="form-success-icon" style={{ margin: "0 auto 18px" }}>
            <Icon name="check" size={34} strokeWidth={2.4} />
          </span>
          <h1>
            Thank You! <span className="gradient-text">We've Received Your Message.</span>
          </h1>
          <p className="section-subtitle" style={{ margin: "0 auto 26px" }}>
            Our team will get back to you within one business day. If it's urgent,
            call us on <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>{company.phone}</a> or
            email <a href={`mailto:${company.email}`}>{company.email}</a>.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/" className="btn btn-primary btn-lg">Back to Home</Link>
            <Link to="/products" className="btn btn-outline btn-lg">Explore Our Products</Link>
          </div>
        </div>
      </section>
    </>
  );
}
