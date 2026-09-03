import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import routes from "./routes.jsx";
import "./styles/global.css";

const router = createBrowserRouter(routes);
const container = document.getElementById("root");
const app = (
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

// Prerendered pages ship with real HTML in #root - hydrate it so React takes
// over without repainting. If a host's SPA fallback served the WRONG page's
// prerendered file (data-prerendered-route differs from the URL), or the
// shell is empty, render from scratch instead of mis-hydrating.
const prerenderedRoute = container.getAttribute("data-prerendered-route");
const matchesRoute =
  prerenderedRoute &&
  (window.location.pathname === prerenderedRoute ||
    window.location.pathname === `${prerenderedRoute}/`);
if (container.hasChildNodes() && matchesRoute) {
  ReactDOM.hydrateRoot(container, app);
} else {
  container.replaceChildren();
  ReactDOM.createRoot(container).render(app);
}
