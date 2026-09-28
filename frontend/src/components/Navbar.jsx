import { Fragment, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useCms, useSite, SiteDoc } from "../cms/content.jsx";
import { Btn, useMediaUrl } from "../cms/primitives.jsx";

const isInternal = (href) => typeof href === "string" && href.startsWith("/") && !href.startsWith("//");

function MenuLink({ item, onClick, className, children }) {
  if (!item.href) return <span className={className}>{children || item.label}</span>;
  if (isInternal(item.href) && !item.newTab) {
    return <NavLink to={item.href} end={item.href === "/"} onClick={onClick} className={className}>{children || item.label}</NavLink>;
  }
  return <a href={item.href} className={className} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noopener noreferrer" : undefined} onClick={onClick}>{children || item.label}</a>;
}

export default function Navbar() {
  const [open, setOpen] = useState(false);          // mobile menu
  const [prodOpen, setProdOpen] = useState(null);   // desktop dropdown id
  const [mobOpen, setMobOpen] = useState(null);     // mobile group id
  const { mode } = useCms();
  const { header, menus } = useSite();
  const media = useMediaUrl();
  const items = menus.header.filter((m) => !m.hidden);
  const close = () => {
    setOpen(false); setProdOpen(null); setMobOpen(null);
    // A just-clicked link keeps :focus-within matched on the dropdown, which
    // would hold the menu open over the next page - drop focus explicitly.
    requestAnimationFrame(() => document.activeElement?.blur?.());
  };
  const logo = header.logo;

  return (
    <header className="navbar" {...(mode === "edit" ? { "data-kibo-region": "header" } : {})}>
      <div className="container navbar-inner">
        <Link to="/" className="logo" aria-label={logo.alt || "KIBO360"}>
          <img src={media(logo.src)} alt={logo.alt || "KIBO360"} className="logo-img" width={logo.width || 330} height={logo.height || 136} />
        </Link>

        <button
          className="nav-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => { setOpen(!open); setMobOpen(null); }}
        >
          <Icon name={open ? "close" : "menu"} size={26} strokeWidth={2} />
        </button>

        <nav className={`nav-links ${open ? "open" : ""}`}>
          {items.map((item) => {
            const kids = (item.children || []).filter((c) => !c.hidden);
            if (!kids.length) return <MenuLink key={item.id} item={item} onClick={close} />;
            return (
              <Fragment key={item.id}>
                {/* Desktop: the parent navigates; hovering shows the dropdown. */}
                <div
                  className={`nav-dropdown ${prodOpen === item.id ? "open" : ""}`}
                  onMouseEnter={() => setProdOpen(item.id)}
                  onMouseLeave={() => setProdOpen(null)}
                >
                  <MenuLink item={item} onClick={close} className="nav-dropdown-label">
                    {item.label} <Icon name="chevron-down" size={15} className="caret" />
                  </MenuLink>
                  <div className="nav-dropdown-menu">
                    {kids.map((c, i) => {
                      const viewAll = i === kids.length - 1 && /\ball\b/i.test(c.label);
                      return (
                        <MenuLink key={c.id} item={c} onClick={close} className={viewAll ? "nav-all-products" : undefined}>
                          {/^[A-Z]{2,5} - /.test(c.label) ? <><strong>{c.label.split(" - ")[0]}</strong> - {c.label.split(" - ").slice(1).join(" - ")}</> : viewAll ? `${c.label} →` : c.label}
                        </MenuLink>
                      );
                    })}
                  </div>
                </div>
                {/* Mobile: children grouped under a collapsible item */}
                <div className="nav-mobile-products">
                  <button
                    type="button"
                    className={`nav-mob-group ${mobOpen === item.id ? "open" : ""}`}
                    aria-expanded={mobOpen === item.id}
                    onClick={() => setMobOpen((o) => (o === item.id ? null : item.id))}
                  >
                    {item.label} <Icon name="chevron-down" size={15} className="caret" />
                  </button>
                  {mobOpen === item.id && (
                    <div className="nav-mob-sub">
                      {kids.map((c) => <MenuLink key={c.id} item={c} onClick={close} />)}
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
          {header.showCta !== false && (
            <SiteDoc prefix="header">
              <Btn k="cta" className="btn btn-primary nav-cta" action={header.cta?.action || "demo"} href={header.cta?.href} newTab={header.cta?.newTab} look={header.cta?.style} onClick={close}>
                {header.cta?.label || "Book a Demo"}
              </Btn>
            </SiteDoc>
          )}
        </nav>
      </div>
    </header>
  );
}
