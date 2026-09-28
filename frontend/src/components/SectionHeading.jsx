import { T, R } from "../cms/primitives.jsx";

/** Section heading. Editable keys: <k>.eyebrow, <k>.title, <k>.subtitle */
export default function SectionHeading({ k = "heading", eyebrow, title, subtitle, center = true }) {
  return (
    <div className={`section-heading ${center ? "center" : ""}`}>
      {eyebrow && <T k={`${k}.eyebrow`} className="eyebrow">{eyebrow}</T>}
      <T k={`${k}.title`} as="h2" className="gradient-text">{title}</T>
      {subtitle && <R k={`${k}.subtitle`} className="section-subtitle">{subtitle}</R>}
    </div>
  );
}
