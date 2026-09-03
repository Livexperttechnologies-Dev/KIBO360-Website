import { Navigate } from "react-router-dom";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Admin from "./pages/Admin.jsx";
import Products from "./pages/Products.jsx";
import ProductHMS from "./pages/ProductHMS.jsx";
import ProductCMS from "./pages/ProductCMS.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import Terms from "./pages/Terms.jsx";

// Shared by the browser entry (main.jsx) and the prerender entry
// (entry-server.jsx) so both always agree on the route table.
const routes = [
  // Admin console: standalone, outside the public site layout (never prerendered)
  { path: "/admin", element: <Admin /> },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "products", element: <Products /> },
      { path: "products/hms", element: <ProductHMS /> },
      { path: "products/cms", element: <ProductCMS /> },
      // HIS is another name for HMS - keep both URLs working.
      { path: "his", element: <Navigate to="/products/hms" replace /> },
      { path: "hms", element: <Navigate to="/products/hms" replace /> },
      { path: "cms", element: <Navigate to="/products/cms" replace /> },
      { path: "about", element: <About /> },
      { path: "contact", element: <Contact /> },
      { path: "privacy-policy", element: <PrivacyPolicy /> },
      { path: "terms", element: <Terms /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export default routes;
