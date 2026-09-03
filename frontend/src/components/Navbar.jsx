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
  const [open, setOpen] = useState(false);          // mobile menu
  const [prodOpen, setProdOpen] = useState(false);  // desktop dropdown
  const [mobProdOpen, setMobProdOpen] = useState(false); // mobile Products group
  const { openDemo } = useDemoModal();
  const liveProducts = products.filter((p) => p.route);
  const close = () => {
    setOpen(false); setProdOpen(false); setMobProdOpen(false);
    // A just-clicked link keeps :focus-within matched on the dropdown, which
    // would hold the menu open over the next page - drop focus explicitly.
    requestAnimationFrame(() => document.activeElement?.blur?.());
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />

        <button
          className="nav-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => { setOpen(!open); setMobProdOpen(false); }}
        >
          <Icon name={open ? "close" : "menu"} size={26} strokeWidth={2} />
        </button>

        <nav className={`nav-links ${open ? "open" : ""}`}>
          <NavLink to="/" end onClick={close}>Home</NavLink>

          {/* Desktop: "Products" navigates to the catalog; hovering shows the
              dropdown, and clicking any entry closes it. */}
          <div
            className={`nav-dropdown ${prodOpen ? "open" : ""}`}
            onMouseEnter={() => setProdOpen(true)}
            onMouseLeave={() => setProdOpen(false)}
          >
            <NavLink to="/products" className="nav-dropdown-label" onClick={close}>
              Products <Icon name="chevron-down" size={15} className="caret" />
            </NavLink>
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

          {/* Mobile: products grouped under a collapsible "Products" item */}
          <div className="nav-mobile-products">
            <button
              type="button"
              className={`nav-mob-group ${mobProdOpen ? "open" : ""}`}
              aria-expanded={mobProdOpen}
              onClick={() => setMobProdOpen((o) => !o)}
            >
              Products <Icon name="chevron-down" size={15} className="caret" />
            </button>
            {mobProdOpen && (
              <div className="nav-mob-sub">
                {liveProducts.map((p) => (
                  <NavLink key={p.slug} to={p.route} onClick={close}>{p.short} - {p.name}</NavLink>
                ))}
                <NavLink to="/products" onClick={close}>View All Products</NavLink>
              </div>
            )}
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
