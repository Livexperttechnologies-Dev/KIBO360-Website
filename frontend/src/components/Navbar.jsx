import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useDemoModal } from "./DemoModalContext.jsx";
import { products } from "../data/siteData.js";

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="KIBO360 - One Platform. Every Business.">
      <img
        src="/kibo360-logo.png"
        alt="KIBO360 - One Platform. Every Business."
        className="logo-img"
        width="330"
        height="136"
      />
    </Link>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { openDemo } = useDemoModal();
  const liveProducts = products.filter((p) => p.route);

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />

        <button
          className="nav-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? "close" : "menu"} size={26} strokeWidth={2} />
        </button>

        <nav className={`nav-links ${open ? "open" : ""}`}>
          <NavLink to="/" end onClick={close}>Home</NavLink>

          <div className="nav-dropdown">
            <button type="button" className="nav-dropdown-label">
              Products <Icon name="chevron-down" size={15} className="caret" />
            </button>
            <div className="nav-dropdown-menu">
              {liveProducts.map((p) => (
                <NavLink key={p.slug} to={p.route} onClick={close}>
                  <strong>{p.short}</strong> - {p.name}
                </NavLink>
              ))}
              <NavLink to="/products" onClick={close} className="nav-all-products">
                View All Products →
              </NavLink>
            </div>
          </div>

          {/* Mobile: dropdown hover doesn't exist, show product links directly */}
          <div className="nav-mobile-products">
            {liveProducts.map((p) => (
              <NavLink key={p.slug} to={p.route} onClick={close}>{p.name}</NavLink>
            ))}
            <NavLink to="/products" onClick={close}>View All Products</NavLink>
          </div>

          <NavLink to="/about" onClick={close}>About Us</NavLink>
          <NavLink to="/contact" onClick={close}>Contact Us</NavLink>
          <button
            type="button"
            className="btn btn-primary nav-cta"
            onClick={() => { close(); openDemo(); }}
          >
            Book a Demo
          </button>
        </nav>
      </div>
    </header>
  );
}
