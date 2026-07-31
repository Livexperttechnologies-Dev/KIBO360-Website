export default function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <span className="stat-value gradient-text">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
