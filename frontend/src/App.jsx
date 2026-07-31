import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import BackToTop from "./components/BackToTop.jsx";

export default function App() {
  const { pathname } = useLocation();

  // Scroll to top on every route change.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Subtle scroll-reveal: sections fade in as they enter the viewport.
  useEffect(() => {
    const sections = document.querySelectorAll("main section, .module-block");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    sections.forEach((s) => {
      s.classList.add("fade-section");
      observer.observe(s);
    });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div className="site">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="ambient-glow glow-1" aria-hidden="true" />
      <div className="ambient-glow glow-2" aria-hidden="true" />
      <Navbar />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}
