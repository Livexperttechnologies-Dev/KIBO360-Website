import { renderToString } from "react-dom/server";
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router-dom/server";
import routes from "./routes.jsx";
import { ContentProvider } from "./cms/content.jsx";
import { HeadCollectorContext } from "./components/Seo.jsx";
import { renderHeadHtml, jsonForScript, buildSitemap, buildRobots, buildLlms, matchRedirect, siteEntries, effectiveRedirects, mergedSeo } from "./cms/seo.js";
import { PAGES, BUILTIN_PATHS } from "./cms/pageMeta.js";

/**
 * Server-side render one URL with the given content.
 * Used by the static prerender (build time) and by the Node site server
 * (request time). Returns { status, html, head, data, redirect }.
 */
export async function render(url, { docs = {}, version = 0, mediaBase = "", mode = "live", previewInfo = null, fresh = false } = {}) {
  const u = new URL(url, "https://kibo360.in");
  if (mode === "live") {
    const r = matchRedirect(docs, u.pathname);
    const isPage = BUILTIN_PATHS.includes(u.pathname.replace(/\/+$/, "") || "/") || Object.values(docs).some((d) => d?.meta?.slug === (u.pathname.replace(/\/+$/, "") || "/"));
    if (r && !isPage) return { status: r.type, redirect: r };
  }
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(u.href));
  if (context instanceof Response) {
    return { status: context.status, redirect: { to: context.headers.get("Location"), type: context.status } };
  }
  const router = createStaticRouter(handler.dataRoutes, context);
  const collector = { seo: null, status: 200, redirect: null };
  const html = renderToString(
    <HeadCollectorContext.Provider value={collector}>
      <ContentProvider initial={{ mode, docs, version, mediaBase, previewInfo }}>
        <StaticRouterProvider router={router} context={context} />
      </ContentProvider>
    </HeadCollectorContext.Provider>
  );
  if (collector.redirect) return { status: collector.redirect.type, redirect: collector.redirect };
  // fresh: rendered per request with the live content (Node site server), so
  // the browser need not wait for a version check before running scripts
  const data = jsonForScript(fresh ? { docs, version, mediaBase, fresh: true } : { docs, version, mediaBase });
  return { status: collector.status, html, head: collector.seo ? renderHeadHtml(collector.seo) : "", data, seo: collector.seo };
}

export { buildSitemap, buildRobots, buildLlms, siteEntries, effectiveRedirects, mergedSeo, PAGES, BUILTIN_PATHS };
