import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";
import { useCms, useSite, SiteDoc } from "../cms/content.jsx";
import { useMediaUrl, T } from "../cms/primitives.jsx";

const SOCIAL = [
  ["linkedin", "LinkedIn", "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4V9Z"],
  ["facebook", "Facebook", "M14 8h3V4h-3c-2.8 0-4 1.7-4 4.4V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z"],
  ["instagram", "Instagram", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4ZM12 2c-2.7 0-3 0-4.1.1C4.4 2.2 2.2 4.4 2.1 7.9 2 9 2 9.3 2 12s0 3 .1 4.1c.1 3.5 2.3 5.7 5.8 5.8 1.1.1 1.4.1 4.1.1s3 0 4.1-.1c3.5-.1 5.7-2.3 5.8-5.8.1-1.1.1-1.4.1-4.1s0-3-.1-4.1c-.1-3.5-2.3-5.7-5.8-5.8C15 2 14.7 2 12 2Z"],
  ["x", "X", "M17.8 3h3.3l-7.2 8.3L22.4 21h-6.6l-5.2-6.8L4.6 21H1.3l7.7-8.8L1 3h6.8l4.7 6.2L17.8 3Zm-1.2 16h1.8L6.6 4.9H4.7L16.6 19Z"],
  ["youtube", "YouTube", "M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9L15.5 12l-5.8 3.1Z"],
];

function FooterLink({ item }) {
  if (!item.href) return <span className="footer-muted">{item.label}</span>;
  if (item.href.startsWith("/") && !item.href.startsWith("//") && !item.newTab) return <Link to={item.href}>{item.label}</Link>;
  return <a href={item.href} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noopener noreferrer" : undefined}>{item.label}</a>;
}

export default function Footer() {
  const { mode } = useCms();
  const { footer, menus, settings } = useSite();
  const media = useMediaUrl();
  const company = settings.company;
  const social = SOCIAL.filter(([k]) => settings.social?.[k]);
  const year = new Date().getFullYear();

  return (
    <footer className="footer" {...(mode === "edit" ? { "data-kibo-region": "footer" } : {})}>
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src={media(footer.logo.src)} alt={footer.logo.alt || "KIBO360"} className="footer-logo-img" width={footer.logo.width || 330} height={footer.logo.height || 136} />
          <SiteDoc prefix="footer">
            {footer.motto && <T k="motto" as="p" className="footer-motto">{footer.motto}</T>}
            {footer.powered && <T k="powered" as="p" className="footer-powered">{footer.powered}</T>}
          </SiteDoc>
          {footer.showSocial !== false && social.length > 0 && (
            <div className="footer-social">
              {social.map(([k, label, d]) => (
                <a key={k} href={settings.social[k]} target="_blank" rel="noopener noreferrer me" aria-label={label}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
                </a>
              ))}
            </div>
          )}
        </div>

        {menus.footerColumns.map((col) => (
          <div key={col.title}>
            <h4>{col.title}</h4>
            <ul>
              {col.items.filter((i) => !i.hidden).map((i) => <li key={i.id}><FooterLink item={i} /></li>)}
            </ul>
          </div>
        ))}

        {footer.showContact !== false && (
          <div>
            <h4>Contact</h4>
            <ul className="footer-contact">
              <li><Icon name="map-pin" size={15} /> {company.address}</li>
              <li><Icon name="phone" size={15} /> <a href={`tel:${company.phone.replace(/[^+\d]/g, "")}`}>{company.phone}</a></li>
              <li><Icon name="mail" size={15} /> <a href={`mailto:${company.email}`}>{company.email}</a></li>
            </ul>
          </div>
        )}
      </div>

      <div className="container footer-bottom">
        <span>{(footer.copyright || "").replace("{year}", String(year))}</span>
        {footer.certs?.length > 0 && (
          <span className="footer-certs">
            {footer.certs.map((c, i) => (
              <span key={c}><Icon name={i % 2 ? "target" : "award"} size={14} /> {c}</span>
            ))}
          </span>
        )}
      </div>
    </footer>
  );
}
