// ---------------------------------------------------------------------------
// Site-wide defaults = exactly what the website shows today. Published CMS
// data (docs.site / docs.seo) is merged OVER these, section by section, so an
// empty CMS renders the current site unchanged.
// ---------------------------------------------------------------------------

export const DEFAULT_COMPANY = {
  name: "KIBO360",
  legalName: "Livexpert Technologies",
  tagline: "One Platform. Every Business.",
  phone: "+91-800 800 5672",
  whatsapp: "918008005672",
  email: "support@kibo360.in",
  address: "Bhutani Cyber Park, Block C, Sector 62, Noida - 201305, India",
  website: "www.kibo360.in",
  hours: "Monday – Saturday, 9:30 AM – 6:30 PM IST · 24×7 support for customers",
};

export const DEFAULT_SITE = {
  header: {
    logo: { t: "img", src: "/kibo360-logo.png", alt: "KIBO360 - One Platform. Every Business.", width: 330, height: 136 },
    cta: { t: "btn", label: "Book a Demo", action: "demo" },
    showCta: true,
  },
  menus: {
    header: [
      { id: "home", label: "Home", href: "/" },
      {
        id: "products", label: "Products", href: "/products",
        children: [
          { id: "hms", label: "HMS - Hospital Management Software", href: "/products/hospitalmanagementsoftware" },
          { id: "cms", label: "CMS - Clinic Management Software", href: "/products/clinicalmanagementsoftware" },
          { id: "all", label: "View All Products", href: "/products" },
        ],
      },
      { id: "about", label: "About Us", href: "/about" },
      { id: "contact", label: "Contact Us", href: "/contact" },
    ],
    footerColumns: [
      {
        title: "Products",
        items: [
          { id: "hms", label: "Hospital Management Software", href: "/products/hospitalmanagementsoftware" },
          { id: "cms", label: "Clinic Management Software", href: "/products/clinicalmanagementsoftware" },
          { id: "inv", label: "Inventory - coming soon", href: "" },
          { id: "fin", label: "Finance - coming soon", href: "" },
          { id: "lis", label: "LIS - coming soon", href: "" },
          { id: "crm", label: "CRM - coming soon", href: "" },
          { id: "all", label: "View All Products", href: "/products" },
        ],
      },
      {
        title: "Company",
        items: [
          { id: "about", label: "About Us", href: "/about" },
          { id: "contact", label: "Contact Us", href: "/contact" },
          { id: "privacy", label: "Privacy Policy", href: "/privacy-policy" },
          { id: "terms", label: "Terms of Use", href: "/terms" },
        ],
      },
    ],
  },
  footer: {
    logo: { t: "img", src: "/kibo360-logo-white.png", alt: "KIBO360 - One Platform. Every Business.", width: 330, height: 136 },
    motto: "\"One Platform Every Business\"",
    powered: "Powered by Livexpert Technologies",
    copyright: "© {year} Livexpert Technologies. All rights reserved.",
    certs: ["ISO 9001:2015 Certified", "CMMI Level 3"],
    showContact: true,
    showSocial: true,
  },
  banners: [],
  settings: {
    company: DEFAULT_COMPANY,
    branding: {
      logo: { t: "img", src: "/kibo360-logo.png", alt: "KIBO360", width: 330, height: 136 },
      logoWhite: { t: "img", src: "/kibo360-logo-white.png", alt: "KIBO360", width: 330, height: 136 },
      favicon: { t: "img", src: "/favicon.png", alt: "KIBO360" },
    },
    social: { linkedin: "", facebook: "", instagram: "", x: "", youtube: "" },
    analytics: { ga4: "", gtm: "", clarity: "", metaPixel: "", linkedinPartner: "", requireConsent: true },
    verification: { google: "", bing: "", yandex: "", pinterest: "", facebook: "" },
    cookies: {
      enabled: false,
      html: "We use cookies to understand how our website is used and to improve your experience.",
      acceptLabel: "Accept",
      rejectLabel: "Decline",
      policyUrl: "/privacy-policy",
    },
  },
};

export const DEFAULT_SEO = {
  global: {
    siteName: "KIBO360",
    titleTemplate: "%s | KIBO360",
    defaultDescription: "KIBO360 offers industry specific business platform that brings HMS, CMS, ERP, CRM and more together in one connected solution built around the needs of your business.",
    keywords: "KIBO360, KIBO360 HMS, KIBO360 CMS, KIBO360 ERP, KIBO360 CRM, KIBO HMS, KIBO CMS, KIBO ERP, KIBO CRM",
    twitterHandle: "",
    locale: "en_IN",
    siteUrl: "https://kibo360.in",
    defaultOgImage: { t: "img", src: "/kibo360-logo.png", alt: "KIBO360", width: 331, height: 135 },
  },
  robots: { mode: "auto", custom: "", disallow: [], blockAiTraining: false, crawlDelay: 0 },
  redirects: [],
  sitemap: { enabled: true, exclude: [], includeImages: true },
  llms: { enabled: true, mode: "auto", custom: "" },
  indexNow: { enabled: false, key: "" },
  schema: {
    organization: {
      enabled: true,
      type: "Organization",
      name: "KIBO360",
      legalName: "Livexpert Technologies",
      description: "KIBO360 offers industry specific business platform that brings HMS, CMS, ERP, CRM and more together in one connected solution built around the needs of your business.",
      foundingDate: "",
      sameAs: [],
    },
    website: { enabled: true },
    localBusiness: { enabled: false, streetAddress: "Bhutani Cyber Park, Block C, Sector 62", locality: "Noida", region: "Uttar Pradesh", postalCode: "201305", country: "IN", latitude: null, longitude: null, openingHours: "Mo-Sa 09:30-18:30" },
  },
};

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
/** Merge CMS data over defaults: objects merge, empty strings keep the default. */
export function mergeDefaults(def, over) {
  if (!isObj(def)) return over === undefined || over === "" || over === null ? def : over;
  if (!isObj(over)) return def;
  const out = { ...def };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined || v === null) continue;
    if (isObj(def[k]) && isObj(v) && !v.t) out[k] = mergeDefaults(def[k], v);
    else if (v === "" && typeof def[k] === "string" && def[k] !== "") continue;
    else out[k] = v;
  }
  return out;
}
