import { T } from "../cms/primitives.jsx";

export default function StatCard({ value, label, ...rest }) {
  return (
    <div className="stat-card" {...rest}>
      <T k="value" className="stat-value gradient-text">{value}</T>
      <T k="label" className="stat-label">{label}</T>
    </div>
  );
}
