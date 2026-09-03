import SectionHeading from "./SectionHeading.jsx";

/** Accessible FAQ accordion built on native <details>/<summary>. */
export default function FaqSection({ faqs, title = "Frequently asked questions." }) {
  return (
    <section className="tight" id="faq">
      <div className="container" style={{ maxWidth: 860 }}>
        <SectionHeading eyebrow="FAQ" title={title} />
        <div className="faq-list">
          {faqs.map((f) => (
            <details key={f.q} className="faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Build FAQPage JSON-LD from the same data (for the Seo component). */
export function faqJsonLd(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
