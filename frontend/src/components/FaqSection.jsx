import SectionHeading from "./SectionHeading.jsx";
import { T, R, List } from "../cms/primitives.jsx";
import { useCms } from "../cms/content.jsx";
import { itemIds } from "../cms/content.jsx";
import { htmlToText } from "../cms/sanitize.js";

const faqId = (f) => f.id || f.q;

/** Accessible FAQ accordion built on native <details>/<summary>. */
export default function FaqSection({ faqs, title = "Frequently asked questions." }) {
  const { mode } = useCms();
  return (
    <section className="tight" id="faq">
      <div className="container" style={{ maxWidth: 860 }}>
        <SectionHeading eyebrow="FAQ" title={title} />
        <div className="faq-list">
          <List k="items" items={faqs} getId={faqId}>
            {(f) => (
              <details className="faq-item" open={mode === "edit" || undefined}>
                <T k="q" as="summary">{f.q}</T>
                <R k="a">{f.a}</R>
              </details>
            )}
          </List>
        </div>
      </div>
    </section>
  );
}

/**
 * FAQPage JSON-LD built from the EFFECTIVE (edited, reordered, visible)
 * questions - Google requires FAQ markup to match what's on the page.
 * listKey is "<sectionId>.items", e.g. "faq.items".
 */
export function useFaqJsonLd(docId, listKey, faqs) {
  const { docs } = useCms();
  const doc = docs[docId] || {};
  // A hidden FAQ section must not keep publishing FAQPage schema.
  if (doc.layout?.hidden?.[listKey.split(".")[0]]) return null;
  const list = doc.lists?.[listKey];
  const ids = itemIds(faqs, faqId);
  const base = new Map(ids.map((id, i) => [id, faqs[i]]));
  const dups = list?.dups || {};
  const order = [...(list?.order || []).filter((id) => base.has(dups[id] || id)), ...ids.filter((id) => !(list?.order || []).includes(id))];
  const text = (id, f, def) => {
    const v = doc.fields?.[`${listKey}.${id}.${f}`];
    return v == null ? def : typeof v === "string" ? v : htmlToText(v.html);
  };
  const items = order.filter((id) => !list?.hidden?.[id]).map((id) => {
    const src = base.get(dups[id] || id);
    return { q: text(id, "q", src.q), a: text(id, "a", src.a) };
  });
  return faqJsonLd(items);
}

export function faqJsonLd(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
