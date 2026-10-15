import { useContext, useEffect, useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Seo, { HeadCollectorContext } from "../components/Seo.jsx";
import { useCms, PageDoc, PageInstance } from "../cms/content.jsx";
import { Sections } from "../cms/sections.jsx";
import { matchRedirect } from "../cms/seo.js";
import { customPageMeta, pageById, pagePath, PAGES, resolvePath } from "../cms/pageMeta.js";
import Home from "./Home.jsx";
import Products from "./Products.jsx";
import ProductHMS from "./ProductHMS.jsx";
import ProductCMS from "./ProductCMS.jsx";
import About from "./About.jsx";
import Contact from "./Contact.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import Terms from "./Terms.jsx";
import ThankYou from "./ThankYou.jsx";

// Built-in page designs a copy can use (meta.template = the original's id).
const TEMPLATES = { home: Home, products: Products, hms: ProductHMS, cms: ProductCMS, about: About, contact: Contact, privacy: PrivacyPolicy, terms: Terms, thankyou: ThankYou };

const norm = (p) => (p.replace(/\/+$/, "") || "/").toLowerCase();

/** Send the visitor to `to` (a permanent redirect when rendered on the server). */
function Forward({ to }) {
  const { search, hash } = useLocation();
  const collector = useContext(HeadCollectorContext);
  if (collector) { collector.redirect = { to, type: 301 }; return null; }
  return <Navigate to={`${to}${search}${hash}`} replace />;
}

/**
 * A built-in page at its original address. When the page has been given a new
 * address in Super Admin, its old one forwards there.
 */
export function BuiltinPage({ id, children }) {
  const { docs } = useCms();
  const to = pagePath(id, docs);
  return to !== pageById(id).path ? <Forward to={to} /> : children;
}

/**
 * An old short URL (/hms, /cms …): forwards to its page's current address -
 * or shows the page itself if it was moved onto this very address.
 */
export function LegacyAddress({ from }) {
  const { docs } = useCms();
  const to = resolvePath(from, docs);
  return to === from ? <DynamicPage /> : <Forward to={to} />;
}

/** Pages created in Super Admin: block-built landing pages, or copies of a built-in page. */
function CustomPage({ docId, doc }) {
  const id = docId.slice(5);
  const template = doc.meta.template;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const meta = useMemo(() => customPageMeta(docId, doc), [docId, doc.meta.slug, doc.meta.label, template]);
  const Design = TEMPLATES[template];
  if (Design) {
    return (
      <PageInstance docId={docId} meta={meta}>
        <Design />
      </PageInstance>
    );
  }
  return (
    <PageDoc id={id}>
      <Seo page={meta} />
      <Sections />
    </PageDoc>
  );
}

function ClientRedirect({ to }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return null;
}

export function NotFound() {
  const collector = useContext(HeadCollectorContext);
  if (collector) collector.status = 404;
  return (
    <>
      <Seo page={{ id: "not-found", path: "/404", title: "Page not found", description: "The page you were looking for doesn't exist.", noindex: true }} />
      <section className="page-hero">
        <div className="container" style={{ maxWidth: 680, textAlign: "center" }}>
          <span className="eyebrow">Error 404</span>
          <h1>We couldn&apos;t find <span className="gradient-text">that page.</span></h1>
          <p className="section-subtitle" style={{ margin: "0 auto 26px" }}>
            It may have moved, or the link may be mistyped. Here are some good places to start:
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/" className="btn btn-primary btn-lg">Go to Home</Link>
            <Link to="/products" className="btn btn-outline btn-lg">Explore Products</Link>
            <Link to="/contact" className="btn btn-outline btn-lg">Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}

export default function DynamicPage() {
  const { pathname } = useLocation();
  const { docs, mode } = useCms();
  const collector = useContext(HeadCollectorContext);
  const path = norm(pathname);
  // a built-in page moved to this address in Super Admin
  const moved = PAGES.find((p) => p.id !== "home" && p.path !== path && pagePath(p.id, docs) === path);
  if (moved) { const Page = TEMPLATES[moved.id]; return <Page key={moved.id} />; }
  const entry = Object.entries(docs).find(([id, d]) => id.startsWith("page:c-") && d?.meta?.slug === path);
  if (entry) return <CustomPage key={entry[0]} docId={entry[0]} doc={entry[1]} />;

  const r = matchRedirect(docs, pathname);
  if (r && mode === "live") {
    if (collector) { collector.redirect = r; return null; }
    if (r.type === 410) return <NotFound />;
    return <ClientRedirect to={r.to} />;
  }
  return <NotFound />;
}
