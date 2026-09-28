import { Link } from "react-router-dom";
import { pageById } from "../cms/pageMeta.js";
import { breadcrumbsFor } from "../cms/seo.js";
import { useCms } from "../cms/content.jsx";

/**
 * Breadcrumb trail. Pass `page` (registry id) to use the SEO-managed labels,
 * or `items: [{ label, to }]` - the last item is the current page.
 */
export default function Breadcrumbs({ page, items: given }) {
  const { docs } = useCms();
  let items = given;
  if (page) {
    const meta = pageById(page);
    items = breadcrumbsFor(meta, docs[`page:${page}`]?.seo || {}).map((c) => ({ label: c.label, to: c.path }));
  }
  if (!items?.length) return null;
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>
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
