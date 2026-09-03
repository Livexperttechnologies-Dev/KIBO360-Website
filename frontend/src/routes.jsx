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
import ThankYou from "./pages/ThankYou.jsx";

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
      { path: "products/hospitalmanagementsoftware", element: <ProductHMS /> },
      { path: "products/clinicalmanagementsoftware", element: <ProductCMS /> },
      // Old / short URLs keep working via redirects
      { path: "products/hms", element: <Navigate to="/products/hospitalmanagementsoftware" replace /> },
      { path: "products/cms", element: <Navigate to="/products/clinicalmanagementsoftware" replace /> },
      { path: "his", element: <Navigate to="/products/hospitalmanagementsoftware" replace /> },
      { path: "hms", element: <Navigate to="/products/hospitalmanagementsoftware" replace /> },
      { path: "cms", element: <Navigate to="/products/clinicalmanagementsoftware" replace /> },
      { path: "about", element: <About /> },
      { path: "contact", element: <Contact /> },
      { path: "privacy-policy", element: <PrivacyPolicy /> },
      { path: "terms", element: <Terms /> },
      { path: "thank-you", element: <ThankYou /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export default routes;
