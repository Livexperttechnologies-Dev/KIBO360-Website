// ---------------------------------------------------------------------------
// Attribution + analytics.
// - First-touch (localStorage) and last-touch (sessionStorage) UTM / click
//   ids / referrer / landing page, attached to every form submission.
// - Analytics tags (GA4, GTM, Clarity, Meta Pixel, LinkedIn) are loaded only
//   after consent when consent is required (default - DPDP-friendly).
// ---------------------------------------------------------------------------

const FT = "kibo-first-touch";
const LT = "kibo-last-touch";
const CONSENT = "kibo-consent";
const UTM_KEYS = ["source", "medium", "campaign", "term", "content"];

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

export function captureAttribution() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const utm = {};
  for (const k of UTM_KEYS) { const v = url.searchParams.get(`utm_${k}`); if (v) utm[k] = v.slice(0, 150); }
  const gclid = url.searchParams.get("gclid") || "";
  const fbclid = url.searchParams.get("fbclid") || "";
  const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer.slice(0, 500) : "";
  const touch = { utm, gclid: gclid.slice(0, 200), fbclid: fbclid.slice(0, 200), referrer: ref, landingPage: url.pathname, at: new Date().toISOString() };
  const hasSignal = Object.keys(utm).length || gclid || fbclid || ref;
  safe(() => { if (!localStorage.getItem(FT)) localStorage.setItem(FT, JSON.stringify(touch)); });
  safe(() => { if (hasSignal || !sessionStorage.getItem(LT)) sessionStorage.setItem(LT, JSON.stringify(touch)); });
}

export function getAttribution(channel = "website") {
  if (typeof window === "undefined") return {};
  const first = safe(() => JSON.parse(localStorage.getItem(FT) || "null"));
  const last = safe(() => JSON.parse(sessionStorage.getItem(LT) || "null")) || {};
  return {
    page: window.location.pathname,
    referrer: last.referrer || "",
    landingPage: last.landingPage || "",
    utm: last.utm || {},
    gclid: last.gclid || "",
    fbclid: last.fbclid || "",
    firstTouch: first ? { utm: first.utm || {}, referrer: first.referrer || "", landingPage: first.landingPage || "", at: first.at || "" } : null,
    channel,
  };
}

// --------------------------------------------------------------- consent
export const getConsent = () => safe(() => JSON.parse(localStorage.getItem(CONSENT) || "null"));
export function setConsent(analytics) {
  safe(() => localStorage.setItem(CONSENT, JSON.stringify({ analytics: !!analytics, at: new Date().toISOString() })));
  window.dispatchEvent(new CustomEvent("kibo-consent"));
}

// ------------------------------------------------------------- analytics
const loaded = new Set();
function addScript(id, src, inline) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  if (src) { s.src = src; s.async = true; }
  if (inline) s.text = inline;
  document.head.appendChild(s);
}
const idOk = (v, re) => typeof v === "string" && re.test(v);

export function loadAnalytics(a) {
  if (typeof window === "undefined" || !a) return;
  if (idOk(a.ga4, /^G-[A-Z0-9]{4,16}$/) && !loaded.has("ga4")) {
    loaded.add("ga4");
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
    window.gtag("js", new Date());
    window.gtag("config", a.ga4, { anonymize_ip: true });
    addScript("kibo-ga4", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(a.ga4)}`);
  }
  if (idOk(a.gtm, /^GTM-[A-Z0-9]{4,12}$/) && !loaded.has("gtm")) {
    loaded.add("gtm");
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    addScript("kibo-gtm", `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(a.gtm)}`);
  }
  if (idOk(a.clarity, /^[a-z0-9]{6,16}$/) && !loaded.has("clarity")) {
    loaded.add("clarity");
    window.clarity = window.clarity || function clarity() { (window.clarity.q = window.clarity.q || []).push(arguments); }; // eslint-disable-line prefer-rest-params
    addScript("kibo-clarity", `https://www.clarity.ms/tag/${encodeURIComponent(a.clarity)}`);
  }
  if (idOk(a.metaPixel, /^\d{8,20}$/) && !loaded.has("fb")) {
    loaded.add("fb");
    const f = (window.fbq = function fbq() { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); }); // eslint-disable-line prefer-rest-params
    if (!window._fbq) window._fbq = f;
    f.push = f; f.loaded = true; f.version = "2.0"; f.queue = [];
    window.fbq("init", a.metaPixel);
    window.fbq("track", "PageView");
    addScript("kibo-fb", "https://connect.facebook.net/en_US/fbevents.js");
  }
  if (idOk(a.linkedinPartner, /^\d{4,12}$/) && !loaded.has("li")) {
    loaded.add("li");
    window._linkedin_partner_id = a.linkedinPartner;
    window._linkedin_data_partner_ids = [a.linkedinPartner];
    addScript("kibo-li", "https://snap.licdn.com/li.lms-analytics/insight.min.js");
  }
}

/** SPA navigation page views (GA4 enhanced measurement handles history itself). */
export function trackPageView() {
  if (typeof window === "undefined") return;
  if (window.fbq && loaded.has("fb")) window.fbq("track", "PageView");
}

/** Conversion event after a successful form submission. */
export function trackLead(formId) {
  if (typeof window === "undefined") return;
  if (window.gtag && loaded.has("ga4")) window.gtag("event", "generate_lead", { form_id: formId });
  if (window.dataLayer && loaded.has("gtm")) window.dataLayer.push({ event: "kibo_form_submit", form_id: formId });
  if (window.fbq && loaded.has("fb")) window.fbq("track", "Lead", { content_name: formId });
}

export const hasAnalytics = (a) => !!a && ["ga4", "gtm", "clarity", "metaPixel", "linkedinPartner"].some((k) => a[k]);
