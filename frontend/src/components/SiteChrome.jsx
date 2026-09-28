import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCms, useSite } from "../cms/content.jsx";
import { sanitizeHtml } from "../cms/sanitize.js";
import { Btn } from "../cms/primitives.jsx";
import { captureAttribution, getConsent, setConsent, loadAnalytics, trackPageView, hasAnalytics } from "../cms/tracking.js";

/** Announcement bars managed in Super Admin -> Banners. */
export function AnnouncementBar() {
  const { banners } = useSite();
  const { mode } = useCms();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(() => new Set());
  // Banners with a start/end time depend on "now", which differs between the
  // build/server render and the visitor - so they appear after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    try { setDismissed(new Set(JSON.parse(sessionStorage.getItem("kibo-banners-closed") || "[]"))); } catch { /* ignore */ }
  }, []);
  const now = mounted ? Date.now() : 0;
  const active = banners.filter((b) =>
    b.enabled && b.html &&
    (!(b.startAt || b.endAt) || mounted) &&
    (!b.startAt || Date.parse(b.startAt) <= now) && (!b.endAt || Date.parse(b.endAt) > now) &&
    ((b.pages ?? ["*"]).includes("*") || b.pages.includes(pathname)) &&
    !dismissed.has(b.id)
  );
  if (!active.length) return null;
  const b = active[0];
  const close = () => {
    const next = new Set(dismissed); next.add(b.id); setDismissed(next);
    try { sessionStorage.setItem("kibo-banners-closed", JSON.stringify([...next])); } catch { /* ignore */ }
  };
  return (
    <div className={`announce announce-${b.style || "brand"}`} role="region" aria-label="Announcement" {...(mode === "edit" ? { "data-kibo-region": "banner" } : {})}>
      <div className="container announce-inner">
        <span className="announce-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(b.html, { mode: "inline" }) }} />
        {b.link?.label && <Btn className="announce-link" action={b.link.action} href={b.link.href} newTab={b.link.newTab}>{b.link.label}</Btn>}
        {b.dismissible !== false && <button type="button" className="announce-close" aria-label="Dismiss announcement" onClick={close}>×</button>}
      </div>
    </div>
  );
}

/**
 * Cookie consent + analytics loader. When consent is required (default),
 * no tracking script loads until the visitor accepts.
 */
export function ConsentAndAnalytics() {
  const { mode } = useCms();
  const { settings } = useSite();
  const { pathname } = useLocation();
  const [consent, setLocalConsent] = useState(undefined); // undefined = not read yet
  const a = settings.analytics;
  const c = settings.cookies;
  const wantsAnalytics = hasAnalytics(a);
  const needConsent = wantsAnalytics && a.requireConsent !== false;

  useEffect(() => { captureAttribution(); }, []);
  useEffect(() => {
    const read = () => setLocalConsent(getConsent());
    read();
    window.addEventListener("kibo-consent", read);
    return () => window.removeEventListener("kibo-consent", read);
  }, []);
  useEffect(() => {
    if (mode !== "live" || !wantsAnalytics || consent === undefined) return;
    if (!needConsent || consent?.analytics) loadAnalytics(a);
  }, [mode, wantsAnalytics, needConsent, consent, a]);
  useEffect(() => { if (mode === "live") trackPageView(); }, [pathname, mode]);

  const show = mode === "live" && consent === null && (needConsent || c.enabled);
  if (!show) return null;
  return (
    <div className="cookie-bar" role="dialog" aria-live="polite" aria-label="Cookie consent">
      <p dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.html || "We use cookies to improve your experience.", { mode: "inline" }) }} />
      <div className="cookie-actions">
        {c.policyUrl && <a href={c.policyUrl} className="cookie-policy">Privacy policy</a>}
        <button type="button" className="btn btn-outline" onClick={() => setConsent(false)}>{c.rejectLabel || "Decline"}</button>
        <button type="button" className="btn btn-primary" onClick={() => setConsent(true)}>{c.acceptLabel || "Accept"}</button>
      </div>
    </div>
  );
}
