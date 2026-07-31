export default function SectionHeading({ eyebrow, title, subtitle, center = true }) {
  return (
    <div className={`section-heading ${center ? "center" : ""}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="gradient-text">{title}</h2>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </div>
  );
}
