import { T, R, Ico } from "../cms/primitives.jsx";

/** Icon card. Editable keys (inside its list-item scope): icon, title, text */
export default function FeatureCard({ icon, title, text, ...rest }) {
  return (
    <div className="feature-card" {...rest}>
      {icon && (
        <span className="icon-badge" aria-hidden="true">
          <Ico name={icon} size={24} />
        </span>
      )}
      <T k="title" as="h3">{title}</T>
      {text && <R k="text">{text}</R>}
    </div>
  );
}
