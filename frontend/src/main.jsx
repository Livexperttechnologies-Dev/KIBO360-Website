import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import routes from "./routes.jsx";
import { ContentProvider } from "./cms/content.jsx";
import { API_BASE } from "./lib/apiBase.js";
import "./styles/global.css";

const container = document.getElementById("root");
const params = new URLSearchParams(window.location.search);

/** Content the server / prerender embedded with the HTML. */
function bootData() {
  try {
    const el = document.getElementById("kibo-data");
    return el ? JSON.parse(el.textContent || "{}") : {};
  } catch { return {}; }
}

function mount(initial, { hydrate }) {
  const router = createBrowserRouter(routes);
  const app = (
    <React.StrictMode>
      <ContentProvider initial={initial}>
        <RouterProvider router={router} />
      </ContentProvider>
    </React.StrictMode>
  );
  if (hydrate) ReactDOM.hydrateRoot(container, app);
  else { container.replaceChildren(); ReactDOM.createRoot(container).render(app); }
}

async function start() {
  const boot = bootData();
  const isAdmin = window.location.pathname === "/admin" || window.location.pathname.startsWith("/admin/");

  // 1) Inside the Super Admin visual editor (same-origin iframe only).
  if (!isAdmin && params.get("kibo_editor") === "1" && window.parent !== window) {
    mount({ mode: "edit", docs: {}, version: "edit", mediaBase: API_BASE }, { hydrate: false });
    return;
  }

  // 2) Secure preview link: drafts, read-only, never indexed.
  let token = params.get("kibo_preview");
  if (token) { try { sessionStorage.setItem("kibo-preview-token", token); } catch { /* ignore */ } }
  else { try { token = sessionStorage.getItem("kibo-preview-token"); } catch { token = null; } }
  if (!isAdmin && token && /^[a-f0-9]{64}$/.test(token)) {
    try {
      const r = await fetch(`${API_BASE}/api/preview/${token}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok && d.ok) {
        mount({ mode: "preview", docs: d.docs, version: d.version, mediaBase: API_BASE, previewInfo: { label: d.label, expiresAt: d.expiresAt } }, { hydrate: false });
        return;
      }
    } catch { /* fall through to the live site */ }
    try { sessionStorage.removeItem("kibo-preview-token"); } catch { /* ignore */ }
  }

  // 3) Live site. Hydrate server/prerendered HTML when it matches this URL.
  const initial = { mode: "live", docs: boot.docs || {}, version: boot.version || 0, mediaBase: boot.mediaBase || API_BASE };
  const route = container.getAttribute("data-prerendered-route");
  const matches = route && (window.location.pathname === route || window.location.pathname === `${route}/`);
  mount(initial, { hydrate: container.hasChildNodes() && matches });
}

start();
