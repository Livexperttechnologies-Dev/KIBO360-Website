import { Link } from "react-router-dom";

/** items: [{ label, to }] - last item is the current page (no link). */
export default function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => (
          <li key={item.label}>
            {i < items.length - 1 && item.to ? (
              <>
                <Link to={item.to}>{item.label}</Link>
                <span className="crumb-sep" aria-hidden="true">›</span>
              </>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
