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
// over without repainting; empty shells (e.g. /admin) render from scratch.
if (container.hasChildNodes()) {
  ReactDOM.hydrateRoot(container, app);
} else {
  ReactDOM.createRoot(container).render(app);
}
