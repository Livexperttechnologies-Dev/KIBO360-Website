import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { company, products, upcomingProducts } from "../data/siteData.js";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img
            src="/kibo360-logo-white.png"
            alt="KIBO360 — One Platform. Every Business."
            className="footer-logo-img"
            width="330"
            height="136"
          />
          <p className="footer-motto">"{company.motto}"</p>
          <p className="footer-powered">Powered by {company.poweredBy}</p>
        </div>

        <div>
          <h4>Products</h4>
          <ul>
            {products.filter((p) => p.route).map((p) => (
              <li key={p.slug}>
                <Link to={p.route}>{p.name}</Link>
              </li>
            ))}
            {upcomingProducts.map((p) => (
              <li key={p.slug}>
                <span className="footer-muted">{p.name} — coming soon</span>
              </li>
            ))}
            <li><Link to="/products">View All Products</Link></li>
          </ul>
        </div>

        <div>
          <h4>Company</h4>
          <ul>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/contact">Contact Us</Link></li>
            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
            <li><Link to="/terms">Terms &amp; Conditions</Link></li>
          </ul>
        </div>

        <div>
          <h4>Contact</h4>
          <ul className="footer-contact">
            <li><Icon name="map-pin" size={15} /> {company.address}</li>
            <li><Icon name="phone" size={15} /> <a href="tel:+918008005672">{company.phone}</a></li>
            <li><Icon name="mail" size={15} /> <a href={`mailto:${company.email}`}>{company.email}</a></li>
            <li><Icon name="globe" size={15} /> {company.website}</li>
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} {company.poweredBy}. All rights reserved.</span>
        <span>
          <Link to="/privacy-policy">Privacy</Link> · <Link to="/terms">Terms</Link>
        </span>
      </div>
    </footer>
  );
}
