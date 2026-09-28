import { lazy, Suspense, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import BackToTop from "./components/BackToTop.jsx";
import FloatingWidgets from "./components/FloatingWidgets.jsx";
import { DemoModalProvider } from "./components/DemoModalContext.jsx";
import { AnnouncementBar, ConsentAndAnalytics } from "./components/SiteChrome.jsx";
import { useCms } from "./cms/content.jsx";

// The editing layer only loads inside the Super Admin editor iframe.
const EditorBridge = lazy(() => import("./cms/EditorBridge.jsx"));

export default function App() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { mode, previewInfo } = useCms();
  const editing = mode === "edit";

  // Scroll to top on every route change.
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [pathname]);

  // Links inside CMS rich text are plain <a> tags: route internal ones
  // through the SPA instead of a full page reload.
  useEffect(() => {
    if (editing) return undefined;
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/admin") || url.pathname.startsWith("/uploads") || url.pathname.startsWith("/api")) return;
      if (url.pathname === window.location.pathname && url.hash) return; // in-page anchor
      e.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate, editing]);

  // Subtle scroll-reveal: sections fade in as they enter the viewport.
  // (Skipped in the editor - everything must be visible to be edited.)
  useEffect(() => {
    if (editing) return undefined;
    // Note: .module-chapter is deliberately NOT included - a transform
    // transition on those sticky cards breaks their pinning in Blink.
    const sections = document.querySelectorAll("main section");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      // threshold 0 + a small bottom inset: a fractional threshold can never
      // fire for sections taller than (viewport / threshold) - on phones the
      // stacked modules section is ~13000px tall, so 8% could never be
      // visible at once and the section stayed hidden forever.
      { threshold: 0, rootMargin: "0px 0px -60px 0px" }
    );
    sections.forEach((s) => {
      s.classList.add("fade-section");
      observer.observe(s);
    });
    return () => observer.disconnect();
  }, [pathname, editing]);

  return (
    <DemoModalProvider>
      <div className="site">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {mode === "preview" && (
          <div className="preview-ribbon" role="status">
            <strong>Preview</strong> - you are viewing unpublished changes{previewInfo?.label ? ` (${previewInfo.label})` : ""}. This version is not live.
          </div>
        )}
        <AnnouncementBar />
        <div className="ambient-glow glow-1" aria-hidden="true" />
        <div className="ambient-glow glow-2" aria-hidden="true" />
        <Navbar />
        <main id="main-content">
          <Outlet />
        </main>
        <Footer />
        {!editing && <BackToTop />}
        {!editing && <FloatingWidgets />}
        <ConsentAndAnalytics />
        {editing && (
          <Suspense fallback={null}>
            <EditorBridge />
          </Suspense>
        )}
      </div>
    </DemoModalProvider>
  );
}
