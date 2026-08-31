import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import CTABanner from "../components/CTABanner.jsx";
import Icon from "../components/Icon.jsx";
import { useDemoModal } from "../components/DemoModalContext.jsx";
import { products, upcomingProducts, company } from "../data/siteData.js";

const liveProducts = products.filter((p) => p.route);

const productsJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ItemList",
      name: "KIBO360 Products",
      itemListElement: liveProducts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "SoftwareApplication",
          name: `KIBO360 ${p.name}`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          url: `https://kibo360.in${p.route}`,
          description: p.blurb,
        },
      })),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://kibo360.in/" },
        { "@type": "ListItem", position: 2, name: "Products" },
      ],
    },
  ],
};

export default function Products() {
  const { openDemo } = useDemoModal();
  return (
    <>
      <Seo
        title="Products - Hospital, Clinic & Healthcare Software Suite"
        description="Explore the KIBO360 product family: Hospital Management Software (HMS) and Clinic Management Software (CMS) available today - Inventory, Finance ERP, LIS and CRM coming soon, all on one intelligent platform."
        path="/products"
        jsonLd={productsJsonLd}
      />
      <div className="container">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Products" },
          ]}
        />
      </div>

      <section className="page-hero" style={{ borderBottom: "none", paddingTop: 28 }}>
        <div className="container">
          <span className="eyebrow">Our Products</span>
          <h1>
            One platform. <span className="gradient-text">A growing family of products.</span>
          </h1>
          <p className="section-subtitle" style={{ margin: "0 auto" }}>
            Every KIBO360 product runs on its own subdomain but shares the same
            intelligent database - start with one, add more as you grow, and never
            migrate your data.
          </p>
        </div>
      </section>

      {/* Live products */}
      <section className="tight">
        <div className="container">
          <SectionHeading
            eyebrow="Available Now"
            title="Live and running in facilities today."
            center={false}
          />
          <div className="grid grid-2">
            {liveProducts.map((p) => (
              <article key={p.slug} className="product-card">
                <div className="product-top">
                  <span className="product-avatar">{p.short}</span>
                  <span className="product-status">{p.status}</span>
                </div>
                <h3>{p.name}</h3>
                <p className="blurb">{p.blurb}</p>
                <div className="product-highlights">
                  {p.highlights.map((h) => <span key={h}>{h}</span>)}
                </div>
                <p className="product-sub">
                  Runs at <code>{p.subdomain}</code>
                </p>
                <div className="product-actions">
                  <Link to={p.route} className="btn btn-primary">Learn More</Link>
                  <button type="button" className="btn btn-outline" onClick={openDemo}>
                    Get a Demo
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Coming soon */}
      <section className="tight">
        <div className="container">
          <SectionHeading
            eyebrow="On the Roadmap"
            title="Coming soon to the platform."
            subtitle="Each launches as a standalone product on its own subdomain - and clicks straight into HMS and CMS when you need the full suite."
            center={false}
          />
          <div className="grid grid-4">
            {upcomingProducts.map((p) => (
              <article key={p.slug} className="product-card soon">
                <div className="product-top">
                  <span className="product-avatar soon-avatar" aria-hidden="true">
                    <Icon name={p.icon} size={24} />
                  </span>
                  <span className="product-status soon">Coming Soon</span>
                </div>
                <h3>{p.name}</h3>
                <p className="blurb">{p.blurb}</p>
                <p className="product-sub">
                  Will run at <code>{p.subdomain}</code>
                </p>
                <div className="product-actions">
                  <button type="button" className="btn btn-outline" onClick={openDemo}>
                    Get Early Access
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Shared-platform note */}
      <section className="tight">
        <div className="container">
          <div className="platform-note">
            <span className="platform-note-icon" aria-hidden="true">
              <Icon name="network" size={22} />
            </span>
            <p>
              <strong>One intelligent database underneath everything.</strong>{" "}
              Start with a single product and switch on the next one without any
              data migration - patients, billing and records carry over instantly.
              {" "}{company.tagline}
            </p>
          </div>
        </div>
      </section>

      <CTABanner
        title="Not sure which product fits?"
        text="Tell us about your facility - we'll walk you through the right starting point."
      />
    </>
  );
}
