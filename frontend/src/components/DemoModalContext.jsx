import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import ContactForm from "./ContactForm.jsx";
import Icon from "./Icon.jsx";

const DemoModalContext = createContext({ openDemo: () => {}, closeDemo: () => {} });
export const useDemoModal = () => useContext(DemoModalContext);

// Auto-popup fires at most once per browser session (and never again once
// the visitor has opened the form any way at all).
const AUTO_KEY = "kibo360-demo-shown";

export function DemoModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const cardRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const downOnOverlay = useRef(false);

  const openDemo = useCallback(() => {
    try { sessionStorage.setItem(AUTO_KEY, "1"); } catch { /* private mode */ }
    restoreFocusRef.current = document.activeElement;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    const el = restoreFocusRef.current;
    if (el && typeof el.focus === "function") el.focus();
  }, []);

  // Close the modal whenever the route changes (e.g. the form submits and
  // navigates to /thank-you) so it never lingers over the new page.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Real scroll lock: overflow on <body> does not propagate to the viewport
  // while <html> has overflow-x: clip, so lock the root element itself -
  // with scrollbar-width compensation to avoid a layout jump.
  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      const gutter = window.innerWidth - root.clientWidth;
      root.style.overflow = "hidden";
      if (gutter > 0) root.style.paddingRight = `${gutter}px`;
    } else {
      root.style.overflow = "";
      root.style.paddingRight = "";
    }
    return () => {
      root.style.overflow = "";
      root.style.paddingRight = "";
    };
  }, [open]);

  // Focus management: move focus into the dialog on open, trap Tab inside,
  // Esc closes (focus restore happens in close()).
  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab" || !cardRef.current) return;
      const focusables = cardRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Auto-open when the visitor scrolls deep enough:
  // Home -> the products section; other pages -> the 5th content section
  // (never the CTA banner - popping over a "Book a Demo" button is absurd).
  useEffect(() => {
    let shown = false;
    try { shown = !!sessionStorage.getItem(AUTO_KEY); } catch { shown = true; }
    if (shown) return;
    const sections = document.querySelectorAll("main section:not(.cta-banner)");
    const target =
      pathname === "/"
        ? document.getElementById("products")
        : sections[4] || null;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          let already = false;
          try { already = !!sessionStorage.getItem(AUTO_KEY); } catch { already = true; }
          if (!already) openDemo();
          observer.disconnect();
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [pathname, openDemo]);

  return (
    <DemoModalContext.Provider value={{ openDemo, closeDemo: close }}>
      {children}
      {open && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(e) => { downOnOverlay.current = e.target === e.currentTarget; }}
          onClick={(e) => {
            // Close only on a true backdrop click - not on a text-selection
            // drag that starts inside the form and releases on the backdrop.
            if (downOnOverlay.current && e.target === e.currentTarget) close();
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Book a free demo"
            ref={cardRef}
            tabIndex={-1}
          >
            <button type="button" className="modal-close" aria-label="Close" onClick={close}>
              <Icon name="close" size={18} strokeWidth={2.2} />
            </button>
            <div className="modal-head">
              <span className="eyebrow">Book a Free Demo</span>
              <h3>See KIBO360 on your own workflows.</h3>
              <p>Tell us a little about your facility - we respond within one business day.</p>
            </div>
            <ContactForm />
          </div>
        </div>
      )}
    </DemoModalContext.Provider>
  );
}
