import { useContext, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Seo, { HeadCollectorContext } from "../components/Seo.jsx";
import { useCms, PageDoc } from "../cms/content.jsx";
import { Sections } from "../cms/sections.jsx";
import { matchRedirect } from "../cms/seo.js";

const norm = (p) => (p.replace(/\/+$/, "") || "/").toLowerCase();

/** Pages created in Super Admin (block-built landing pages). */
function CustomPage({ docId, doc }) {
  const id = docId.slice(5);
  const meta = { id, path: doc.meta.slug, label: doc.meta.label, title: doc.meta.label || doc.meta.slug, description: "" };
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
  const entry = Object.entries(docs).find(([id, d]) => id.startsWith("page:c-") && d?.meta?.slug === path);
  if (entry) return <CustomPage docId={entry[0]} doc={entry[1]} />;

  const r = matchRedirect(docs, pathname);
  if (r && mode === "live") {
    if (collector) { collector.redirect = r; return null; }
    if (r.type === 410) return <NotFound />;
    return <ClientRedirect to={r.to} />;
  }
  return <NotFound />;
}
