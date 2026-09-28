// ---------------------------------------------------------------------------
// Built-in page registry (data only - no components, so the admin, SEO tools
// and server-side code can import it cheaply). The SEO values here are the
// DEFAULTS; anything set in Super Admin -> SEO overrides them per page.
// ---------------------------------------------------------------------------

export const SITE_URL = "https://kibo360.in";

export const PAGES = [
  {
    id: "home",
    path: "/",
    label: "Home",
    title: "KIBO360: One Platform Designed for Every Business",
    description: "KIBO360 offers industry specific business platform that brings HMS, CMS, ERP, CRM and more together in one connected solution built around the needs of your business.",
    keywords: "KIBO360, KIBO360 HMS, KIBO360 CMS, KIBO360 ERP, KIBO360 CRM, KIBO HMS, KIBO CMS, KIBO ERP, KIBO CRM",
    sitemap: { priority: 1.0, changefreq: "weekly" },
    focusKeyword: "business software platform",
  },
  {
    id: "products",
    path: "/products",
    label: "Products",
    title: "Products - Hospital, Clinic & Healthcare Software Suite",
    description: "Explore the KIBO360 product family: Hospital Management Software (HMS) and Clinic Management Software (CMS) available today - Inventory, Finance ERP, LIS and CRM coming soon, all on one intelligent platform.",
    breadcrumbs: [{ label: "Home", path: "/" }, { label: "Products" }],
    sitemap: { priority: 0.9, changefreq: "weekly" },
  },
  {
    id: "hms",
    path: "/products/hospitalmanagementsoftware",
    label: "Hospital Management Software (HMS)",
    title: "Hospital Management Software (HMS / HIS) - AI-Powered & Cloud-Native",
    description: "KIBO360 HMS unifies OPD/IPD, EMR/EHR, diagnostics, pharmacy, billing, finance ERP, HR & payroll and AI analytics on one intelligent database. 80% faster registration, 98% billing accuracy. Book a free demo.",
    breadcrumbs: [{ label: "Home", path: "/" }, { label: "Products", path: "/products" }, { label: "Hospital Management Software (HMS)" }],
    sitemap: { priority: 0.9, changefreq: "weekly" },
    focusKeyword: "hospital management software",
  },
  {
    id: "cms",
    path: "/products/clinicalmanagementsoftware",
    label: "Clinical Management System (CMS)",
    title: "Clinical Management System (CMS) - Clinical Management Software in India",
    description: "Kibo360 CMS brings patients, appointments, clinical records, billing and staff management together in one connected system - Clinical Management Software for clinics and modern practices in India. Book a demo.",
    breadcrumbs: [{ label: "Home", path: "/" }, { label: "Products", path: "/products" }, { label: "Clinical Management System (CMS)" }],
    sitemap: { priority: 0.9, changefreq: "weekly" },
    focusKeyword: "clinical management software",
  },
  {
    id: "about",
    path: "/about",
    label: "About Us",
    title: "About Us - The Team Behind the KIBO360 Platform",
    description: "KIBO360 by Livexpert Technologies is a connected digital ecosystem for hospitals, clinics, diagnostic chains and medical colleges - built on the belief that technology should bring teams, processes and information together.",
    breadcrumbs: [{ label: "Home", path: "/" }, { label: "About Us" }],
    sitemap: { priority: 0.6, changefreq: "monthly" },
  },
  {
    id: "contact",
    path: "/contact",
    label: "Contact Us",
    title: "Contact Us - Book a Free Demo of KIBO360 HMS or CMS",
    description: "Book a free demo of KIBO360 Hospital or Clinic Management Software. Call +91-800 800 5672, email support@kibo360.in, or send us a message - we respond within one business day.",
    breadcrumbs: [{ label: "Home", path: "/" }, { label: "Contact Us" }],
    sitemap: { priority: 0.8, changefreq: "monthly" },
  },
  {
    id: "privacy",
    path: "/privacy-policy",
    label: "Privacy Policy",
    title: "Privacy Policy",
    description: "How Kibo360 and Livexpert Technologies collect, use and protect your information on kibo360.in and its products and services.",
    breadcrumbs: [{ label: "Home", path: "/" }, { label: "Privacy Policy" }],
    sitemap: { priority: 0.3, changefreq: "yearly" },
  },
  {
    id: "terms",
    path: "/terms",
    label: "Terms of Use",
    title: "Terms of Use",
    description: "Terms of Use governing access to the Kibo360 website, software, applications, and related services provided by Livexpert Technologies.",
    breadcrumbs: [{ label: "Home", path: "/" }, { label: "Terms of Use" }],
    sitemap: { priority: 0.3, changefreq: "yearly" },
  },
  {
    id: "thankyou",
    path: "/thank-you",
    label: "Thank You",
    title: "Thank You",
    description: "Thanks for contacting KIBO360 - our team will get back to you within one business day.",
    noindex: true,
    sitemap: { include: false },
  },
];

export const pageById = (id) => PAGES.find((p) => p.id === id) || null;
export const pageByPath = (path) => PAGES.find((p) => p.path === path) || null;
export const BUILTIN_PATHS = PAGES.map((p) => p.path);

/** Legacy / short URLs that always redirect (in addition to CMS redirects). */
export const BUILTIN_REDIRECTS = [
  { from: "/products/hms", to: "/products/hospitalmanagementsoftware" },
  { from: "/products/cms", to: "/products/clinicalmanagementsoftware" },
  { from: "/his", to: "/products/hospitalmanagementsoftware" },
  { from: "/hms", to: "/products/hospitalmanagementsoftware" },
  { from: "/cms", to: "/products/clinicalmanagementsoftware" },
];
