import { T, R, Img, Btn, Video, List, Ico } from "./primitives.jsx";
import SectionHeading from "../components/SectionHeading.jsx";
import FeatureCard from "../components/FeatureCard.jsx";
import StatCard from "../components/StatCard.jsx";
import FaqSection from "../components/FaqSection.jsx";
import CTABanner from "../components/CTABanner.jsx";
import FormRenderer from "../components/FormRenderer.jsx";

// ---------------------------------------------------------------------------
// Block library: section templates admins can add to any page (or use to
// build new landing pages). Built from the same primitives + CSS as the rest
// of the site, so new sections look native and are fully click-to-edit.
// ---------------------------------------------------------------------------

const PH = "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80";
const bgClass = (b) => ({ soft: "blk-bg-soft", dark: "band-dark", brand: "blk-bg-brand" }[b?.bg] || "");

function Hero({ block }) {
  return (
    <section className={`page-hero ${bgClass(block)}`} id={block.anchor || undefined}>
      <div className="container">
        <T k="eyebrow" as="span" className="eyebrow">New</T>
        <h1><T k="title">A clear headline that says what you offer</T> <T k="highlight" className="gradient-text">in one line.</T></h1>
        <R k="text" className="section-subtitle" style={{ margin: "0 auto 22px" }}>Explain the value in a sentence or two. Who is it for, and what changes for them?</R>
        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <Btn k="primary" className="btn btn-primary btn-lg" action="demo">Book a Free Demo</Btn>
          <Btn k="secondary" className="btn btn-outline btn-lg" to="/products">Explore Products</Btn>
        </div>
      </div>
    </section>
  );
}

const RICH_DEFAULT = '<h2>Section heading</h2><p>Write anything here - paragraphs, <strong>bold text</strong>, <a href="/contact">links</a>, bullet lists and sub-headings.</p><ul><li>First point</li><li>Second point</li></ul>';
function RichText({ block }) {
  return (
    <section className={`tight ${bgClass(block)}`} id={block.anchor || undefined}>
      <div className="container legal-body" style={{ maxWidth: 860 }}>
        <R k="body" as="div" mode="block" html={RICH_DEFAULT} />
      </div>
    </section>
  );
}

function Split({ block }) {
  const reverse = block.align === "left";
  return (
    <section className={bgClass(block)} id={block.anchor || undefined}>
      <div className={`container split ${reverse ? "reverse" : ""}`}>
        <div>
          <T k="eyebrow" as="span" className="eyebrow">Highlight</T>
          <T k="title" as="h2">Tell the story behind this feature</T>
          <R k="text" style={{ margin: "14px 0 24px" }}>Describe how it works and why it matters. Keep it focused on outcomes your customers care about.</R>
          <Btn k="cta" className="btn btn-primary" action="demo">Book a Demo</Btn>
        </div>
        <div className="split-visual">
          <div className="img-wrapper">
            <Img k="image" src={PH} alt="Describe this image" className="main-img" loading="lazy" width="900" height="675" />
          </div>
        </div>
      </div>
    </section>
  );
}

const CARDS = [
  { id: "one", icon: "sparkle", title: "First benefit", text: "A short sentence about this benefit." },
  { id: "two", icon: "shield", title: "Second benefit", text: "A short sentence about this benefit." },
  { id: "three", icon: "trending-up", title: "Third benefit", text: "A short sentence about this benefit." },
];
function Cards({ block }) {
  const cols = block.columns || "3";
  return (
    <section className={bgClass(block)} id={block.anchor || undefined}>
      <div className="container">
        <SectionHeading eyebrow="Features" title="Why teams choose us" subtitle="Add a short introduction to this group of cards." />
        <div className={`grid grid-${cols}`}>
          <List k="cards" items={CARDS}>{(c) => <FeatureCard icon={c.icon} title={c.title} text={c.text} />}</List>
        </div>
      </div>
    </section>
  );
}

const STATS = [{ id: "a", value: "98%", label: "Billing Accuracy" }, { id: "b", value: "14K+", label: "Patients Processed" }, { id: "c", value: "24×7", label: "Support" }, { id: "d", value: "60%", label: "Less Waiting Time" }];
function Stats({ block }) {
  return (
    <section className={block.bg === "none" || block.bg === "soft" ? bgClass(block) : "band-dark"} id={block.anchor || undefined}>
      <div className="container">
        <SectionHeading title="Numbers that matter" subtitle="Results from real deployments." />
        <div className="grid grid-4">
          <List k="stats" items={STATS}>{(s) => <StatCard value={s.value} label={s.label} />}</List>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { id: "q1", q: "What is this question about?", a: "Answer it clearly in two or three sentences." },
  { id: "q2", q: "Another common question?", a: "Short, specific answers help customers and search engines." },
];
function Faq() { return <FaqSection faqs={FAQS} title="Frequently asked questions." />; }

function Cta() {
  return <CTABanner title="Ready to get started?" text="Book a personalized demo with our team." />;
}

function ImageBlock({ block }) {
  return (
    <section className={`tight ${bgClass(block)}`} id={block.anchor || undefined}>
      <div className="container">
        <figure style={{ margin: 0 }}>
          <Img k="image" src={PH} alt="Describe this image" loading="lazy" width="1600" height="900" style={{ width: "100%", height: "auto", borderRadius: 20, display: "block" }} sizes="(max-width: 1200px) 100vw, 1200px" />
          <T k="caption" as="figcaption" className="muted" style={{ textAlign: "center", marginTop: 10, display: "block" }}>Optional caption</T>
        </figure>
      </div>
    </section>
  );
}

function VideoBlock({ block }) {
  return (
    <section className={`tight ${bgClass(block)}`} id={block.anchor || undefined}>
      <div className="container" style={{ maxWidth: 960 }}>
        <SectionHeading eyebrow="Watch" title="See it in action" />
        <Video k="video" video={null} />
      </div>
    </section>
  );
}

const CHIPS = ["First item", "Second item", "Third item", "Fourth item"];
function Chips({ block }) {
  return (
    <section className={`tight ${bgClass(block)}`} id={block.anchor || undefined}>
      <div className="container">
        <SectionHeading eyebrow="Integrations" title="Works with the tools you use" />
        <div className="chip-row">
          <List k="chips" items={CHIPS}>{(c) => <T k="label" className="chip">{c}</T>}</List>
        </div>
      </div>
    </section>
  );
}

function FormBlock({ block }) {
  return (
    <section className={bgClass(block)} id={block.anchor || undefined}>
      <div className="container" style={{ maxWidth: 760 }}>
        <SectionHeading eyebrow="Get in touch" title="Tell us about your requirements" subtitle="We respond within one business day." />
        <FormRenderer formId={block.formId || "demo"} />
      </div>
    </section>
  );
}

function Spacer() { return <div aria-hidden="true" style={{ height: 48 }} />; }

const LOGOS = [{ id: "l1", name: "Partner 1" }, { id: "l2", name: "Partner 2" }, { id: "l3", name: "Partner 3" }, { id: "l4", name: "Partner 4" }];
function Logos({ block }) {
  return (
    <section className={`tight ${bgClass(block)}`} id={block.anchor || undefined}>
      <div className="container">
        <T k="title" as="p" className="section-subtitle" style={{ textAlign: "center", margin: "0 auto 20px" }}>Trusted by leading healthcare organisations</T>
        <div className="logo-row">
          <List k="logos" items={LOGOS}>{(l) => <Img k="logo" src="/favicon.png" alt={l.name} width="140" height="56" loading="lazy" className="logo-row-item" />}</List>
        </div>
      </div>
    </section>
  );
}

export const BLOCKS = {
  hero: { label: "Hero banner", Component: Hero, description: "Big headline, intro and two buttons" },
  richText: { label: "Rich text", Component: RichText, description: "Paragraphs, headings, lists and links" },
  split: { label: "Image + text", Component: Split, description: "Text beside a picture", options: ["align"] },
  cards: { label: "Feature cards", Component: Cards, description: "Grid of icon cards", options: ["columns"] },
  stats: { label: "Stats band", Component: Stats, description: "Big numbers" },
  faq: { label: "FAQ", Component: Faq, description: "Questions & answers (accordion)" },
  cta: { label: "Call to action", Component: Cta, description: "Gradient banner with buttons" },
  image: { label: "Image", Component: ImageBlock, description: "Full-width picture with caption" },
  video: { label: "Video", Component: VideoBlock, description: "YouTube, Vimeo or uploaded video" },
  chips: { label: "Tags / chips", Component: Chips, description: "Row of labels" },
  form: { label: "Form", Component: FormBlock, description: "Any form from the Form Builder", options: ["formId"] },
  logos: { label: "Logo row", Component: Logos, description: "Partner / client logos" },
  spacer: { label: "Spacer", Component: Spacer, description: "Extra vertical space" },
};
