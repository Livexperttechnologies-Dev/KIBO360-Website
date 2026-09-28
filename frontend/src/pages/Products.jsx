import Seo from "../components/Seo.jsx";
import Breadcrumbs from "../components/Breadcrumbs.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import CTABanner from "../components/CTABanner.jsx";
import { PageDoc } from "../cms/content.jsx";
import { T, R, Btn, List, Ico, Sec } from "../cms/primitives.jsx";
import { Sections } from "../cms/sections.jsx";
import { products, upcomingProducts } from "../data/siteData.js";

const liveProducts = products.filter((p) => p.route);

const productsJsonLd = {
  "@context": "https://schema.org",
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
};

export default function Products() {
  return (
    <PageDoc id="products">
      <Seo page="products" jsonLd={productsJsonLd} />
      <Sections>
        <Sec id="breadcrumbs" label="Breadcrumbs" noDuplicate>
          <div className="container"><Breadcrumbs page="products" /></div>
        </Sec>

        <Sec id="hero" label="Hero" noDuplicate>
          <section className="page-hero" style={{ borderBottom: "none", paddingTop: 28 }}>
            <div className="container">
              <T k="eyebrow" className="eyebrow">Our Products</T>
              <h1><T k="title">One platform.</T> <T k="titleHighlight" className="gradient-text">A growing family of products.</T></h1>
              <R k="text" className="section-subtitle" style={{ margin: "0 auto" }}>Every KIBO360 product runs on its own subdomain but shares the same intelligent database - start with one, add more as you grow, and never migrate your data.</R>
            </div>
          </section>
        </Sec>

        <Sec id="live" label="Available now">
          <section className="tight">
            <div className="container">
              <SectionHeading eyebrow="Available Now" title="Live and running in facilities today." center={false} />
              <div className="grid grid-2">
                <List k="products" items={liveProducts} getId={(p) => p.slug}>
                  {(p) => (
                    <article className="product-card">
                      <div className="product-top">
                        <T k="short" className="product-avatar">{p.short}</T>
                        <T k="status" className="product-status">{p.status}</T>
                      </div>
                      <T k="name" as="h3">{p.name}</T>
                      <R k="blurb" className="blurb">{p.blurb}</R>
                      <div className="product-highlights"><List k="highlights" items={p.highlights}>{(h) => <T k="text">{h}</T>}</List></div>
                      <p className="product-sub"><T k="subLabel">Runs at</T> <T k="subdomain" as="code">{p.subdomain}</T></p>
                      <div className="product-actions">
                        <Btn k="learn" to={p.route} className="btn btn-primary">Learn More</Btn>
                        <Btn k="demo" className="btn btn-outline" action="demo">Get a Demo</Btn>
                      </div>
                    </article>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="soon" label="Coming soon">
          <section className="tight">
            <div className="container">
              <SectionHeading eyebrow="On the Roadmap" title="Coming soon to the platform." subtitle="Each launches as a standalone product on its own subdomain - and clicks straight into HMS and CMS when you need the full suite." center={false} />
              <div className="grid grid-4">
                <List k="products" items={upcomingProducts} getId={(p) => p.slug}>
                  {(p) => (
                    <article className="product-card soon">
                      <div className="product-top">
                        <span className="product-avatar soon-avatar" aria-hidden="true"><Ico name={p.icon} size={24} /></span>
                        <T k="status" className="product-status soon">Coming Soon</T>
                      </div>
                      <T k="name" as="h3">{p.name}</T>
                      <R k="blurb" className="blurb">{p.blurb}</R>
                      <p className="product-sub"><T k="subLabel">Will run at</T> <T k="subdomain" as="code">{p.subdomain}</T></p>
                      <div className="product-actions">
                        <Btn k="access" className="btn btn-outline" action="demo">Get Early Access</Btn>
                      </div>
                    </article>
                  )}
                </List>
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="note" label="Shared platform note">
          <section className="tight">
            <div className="container">
              <div className="platform-note">
                <span className="platform-note-icon" aria-hidden="true"><Ico name="network" size={22} /></span>
                <R k="text" html="<strong>One intelligent database underneath everything.</strong> Start with a single product and switch on the next one without any data migration - patients, billing and records carry over instantly. One Platform. Every Business." />
              </div>
            </div>
          </section>
        </Sec>

        <Sec id="cta" label="Final call to action">
          <CTABanner title="Not sure which product fits?" text="Tell us about your facility - we'll walk you through the right starting point." />
        </Sec>
      </Sections>
    </PageDoc>
  );
}
