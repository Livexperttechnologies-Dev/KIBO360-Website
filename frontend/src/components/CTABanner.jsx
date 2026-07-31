import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { company } from "../data/siteData.js";

export default function CTABanner({ title, text }) {
  return (
    <section className="cta-banner">
      <div className="container cta-inner">
        <div>
          <h2>{title || company.motto}</h2>
          <p>{text || "See KIBO360 in action — book a personalized demo for your organization."}</p>
        </div>
        <div className="cta-actions">
          <Link to="/contact" className="btn btn-light">Book a Demo</Link>
          <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`} className="btn btn-call">
            <Icon name="phone" size={17} /> Call {company.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
