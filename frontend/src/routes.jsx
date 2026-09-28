import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
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
import DynamicPage from "./pages/DynamicPage.jsx";
import { BUILTIN_REDIRECTS } from "./cms/pageMeta.js";

// Super Admin is a separate lazily-loaded bundle - visitors never download it.
const AdminApp = lazy(() => import("./admin/AdminApp.jsx"));
const AdminShell = () => (
  <Suspense fallback={<div style={{ padding: 40, fontFamily: "system-ui" }}>Loading admin…</div>}>
    <AdminApp />
  </Suspense>
);

// Shared by the browser entry (main.jsx) and the server renderer
// (entry-server.jsx) so both always agree on the route table.
const routes = [
  { path: "/admin/*", element: <AdminShell /> },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "products", element: <Products /> },
      { path: "products/hospitalmanagementsoftware", element: <ProductHMS /> },
      { path: "products/clinicalmanagementsoftware", element: <ProductCMS /> },
      { path: "about", element: <About /> },
      { path: "contact", element: <Contact /> },
      { path: "privacy-policy", element: <PrivacyPolicy /> },
      { path: "terms", element: <Terms /> },
      { path: "thank-you", element: <ThankYou /> },
      // Old / short URLs keep working (the server answers these with a 301)
      ...BUILTIN_REDIRECTS.map((r) => ({ path: r.from.slice(1), element: <Navigate to={r.to} replace /> })),
      // CMS landing pages, CMS redirects, and a real 404 for everything else
      { path: "*", element: <DynamicPage /> },
    ],
  },
];

export default routes;
