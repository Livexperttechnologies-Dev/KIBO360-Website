import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useCms, useContentSync, useSite } from "../cms/content.jsx";
import { sanitizeHtml } from "../cms/sanitize.js";
import { Btn } from "../cms/primitives.jsx";
import { captureAttribution, getConsent, setConsent, loadAnalytics, trackPageView, hasAnalytics } from "../cms/tracking.js";
import { activeSnippets, hasGatedSnippets, snippetKey, syncSnippets } from "../cms/customCode.js";

/** The visitor's cookie choice: undefined = not read yet, null = not decided. */
function useConsent() {
  const [consent, setLocalConsent] = useState(undefined);
  useEffect(() => {
    const read = () => setLocalConsent(getConsent());
    read();
    window.addEventListener("kibo-consent", read);
    return () => window.removeEventListener("kibo-consent", read);
  }, []);
  return consent;
}

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
  const { settings, code } = useSite();
  const { pathname } = useLocation();
  const consent = useConsent();
  const a = settings.analytics;
  const c = settings.cookies;
  const wantsAnalytics = hasAnalytics(a);
  // header/footer scripts marked "needs cookie consent" count as tracking too
  const needConsent = (wantsAnalytics || hasGatedSnippets(code, mode)) && a.requireConsent !== false;

  useEffect(() => { captureAttribution(); }, []);
  useEffect(() => {
    if (mode !== "live" || !wantsAnalytics || consent === undefined) return;
    if (!needConsent || consent?.analytics) loadAnalytics(a);
  }, [mode, wantsAnalytics, needConsent, consent, a]);
  useEffect(() => { if (mode === "live") trackPageView(); }, [pathname, mode]);

  // Previews show the banner too (they show what visitors will see); they
  // never load the analytics tags themselves.
  const show = (mode === "live" || mode === "preview") && consent === null && (needConsent || c.enabled);
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

/**
 * Header & footer scripts from Super Admin. Runs on the live site (and on
 * preview links for snippets marked so) - never in the visual editor, and
 * never in Super Admin (it is not part of the admin app at all).
 */
export function CustomCode() {
  const { code, settings } = useSite();
  const { mode } = useCms();
  const sync = useContentSync();
  const { pathname } = useLocation();
  const consent = useConsent();
  const consentOk = settings.analytics?.requireConsent === false || consent?.analytics === true;
  // Start once the cookie choice has been read (so list order holds) and the
  // content is known to be current - code removed or switched off since this
  // page was built must never run. Unreachable API: the page's own copy runs.
  const ready = consent !== undefined && (mode !== "live" || sync === "fresh" || sync === "offline");
  const list = ready ? activeSnippets(code, { mode, pathname, consentOk }) : null;
  const signature = list ? list.map(snippetKey).join("|") : null;
  useEffect(() => {
    if (list) syncSnippets(list);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  useEffect(() => () => { syncSnippets([]); }, []);
  return null;
}
