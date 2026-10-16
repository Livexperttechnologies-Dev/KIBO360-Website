import { lazy, Suspense } from "react";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Products from "./pages/Products.jsx";
import ProductHMS from "./pages/ProductHMS.jsx";
import ProductCMS from "./pages/ProductCMS.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import Terms from "./pages/Terms.jsx";
import ThankYou from "./pages/ThankYou.jsx";
import DynamicPage, { BuiltinPage, LegacyAddress } from "./pages/DynamicPage.jsx";
import { BUILTIN_REDIRECTS } from "./cms/pageMeta.js";
import { pageBoot } from "./lib/pageBoot.js";
import RouteError from "./components/RouteError.jsx";

// (a main page's original address forwards to its new one once it is moved in Super Admin)
const at = (id, page) => <BuiltinPage id={id}>{page}</BuiltinPage>;

// Super Admin is a separate lazily-loaded bundle - visitors never download it.
const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));
const adminLoading = <div style={{ padding: 40, fontFamily: "system-ui" }}>Loading admin…</div>;
// A link from the public site (menu, button) would otherwise open the admin in
// the same page, where header/footer scripts that already ran keep running -
// so that case reloads into a clean page. (After the reload the public site
// has not rendered, so this can never loop.)
function AdminShell() {
  if (typeof window !== "undefined" && pageBoot.publicRendered) {
    window.location.reload();
    return adminLoading;
  }
  return (
    <Suspense fallback={adminLoading}>
      <AdminApp />
    </Suspense>
  );
}

// Shared by the browser entry (main.jsx) and the server renderer
// (entry-server.jsx) so both always agree on the route table.
const routes = [
  { path: "/admin/*", element: <AdminShell />, errorElement: <RouteError /> },
  {
    path: "/",
    element: <App />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: "products", element: at("products", <Products />) },
      { path: "products/hospitalmanagementsoftware", element: at("hms", <ProductHMS />) },
      { path: "products/clinicalmanagementsoftware", element: at("cms", <ProductCMS />) },
      { path: "about", element: at("about", <About />) },
      { path: "contact", element: at("contact", <Contact />) },
      { path: "privacy-policy", element: at("privacy", <PrivacyPolicy />) },
      { path: "terms", element: at("terms", <Terms />) },
      { path: "thank-you", element: at("thankyou", <ThankYou />) },
      // Old / short URLs keep working (the server answers these with a 301)
      ...BUILTIN_REDIRECTS.map((r) => ({ path: r.from.slice(1), element: <LegacyAddress from={r.from} /> })),
      // CMS landing pages, CMS redirects, and a real 404 for everything else
      { path: "*", element: <DynamicPage /> },
    ],
  },
];

export default routes;
