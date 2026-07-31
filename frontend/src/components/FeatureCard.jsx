import Icon from "./Icon.jsx";

export default function FeatureCard({ icon, title, text }) {
  return (
    <div className="feature-card">
      {icon && (
        <span className="icon-badge" aria-hidden="true">
          <Icon name={icon} size={24} />
        </span>
      )}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </div>
  );
}
