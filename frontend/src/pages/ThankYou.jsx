import Seo from "../components/Seo.jsx";
import Icon from "../components/Icon.jsx";
import { PageDoc, useCompany } from "../cms/content.jsx";
import { T, R, Btn, Sec } from "../cms/primitives.jsx";
import { Sections } from "../cms/sections.jsx";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Landing page after any successful form submission.
export default function ThankYou() {
  const c = useCompany();
  const tel = c.phone.replace(/[^+\d]/g, "");
  return (
    <PageDoc id="thankyou">
      <Seo page="thankyou" />
      <Sections>
        <Sec id="message" label="Thank-you message" noDuplicate>
          <section className="page-hero">
            <div className="container" style={{ maxWidth: 680, textAlign: "center" }}>
              <span className="form-success-icon" style={{ margin: "0 auto 18px" }}><Icon name="check" size={34} strokeWidth={2.4} /></span>
              <h1><T k="title">Thank You!</T> <T k="titleHighlight" className="gradient-text">We&apos;ve Received Your Message.</T></h1>
              <R
                k="text"
                className="section-subtitle"
                style={{ margin: "0 auto 26px" }}
                html={`Our team will get back to you within one business day. If it's urgent, call us on <a href="tel:${esc(tel)}">${esc(c.phone)}</a> or email <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>.`}
              />
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Btn k="home" to="/" className="btn btn-primary btn-lg">Back to Home</Btn>
                <Btn k="products" to="/products" className="btn btn-outline btn-lg">Explore Our Products</Btn>
              </div>
            </div>
          </section>
        </Sec>
      </Sections>
    </PageDoc>
  );
}
