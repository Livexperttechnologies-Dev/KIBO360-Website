import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router-dom/server";
import routes from "./routes.jsx";

// Build-time prerendering entry: renders one public route to an HTML string.
// The Seo component stashes its props on globalThis.__SEO__ during server
// render so the prerender script can write matching <head> tags.
export async function render(url) {
  globalThis.__SEO__ = null;
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(`https://kibo360.in${url}`));
  if (context instanceof Response) {
    throw new Error(`Unexpected redirect while prerendering ${url}`);
  }
  const router = createStaticRouter(handler.dataRoutes, context);
  const html = renderToString(<StaticRouterProvider router={router} context={context} />);
  return { html, seo: globalThis.__SEO__ };
}
