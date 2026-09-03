// ---------------------------------------------------------------------------
// KIBO360 site content - single source of truth.
// All copy extracted from "360 Final Deck.pdf" and "Kibo 360 broucher.pdf".
// Pages only render this data; edit here to change site text.
// ---------------------------------------------------------------------------

export const company = {
  name: "KIBO360",
  tagline: "One Platform. Every Business.",
  motto: "Connecting Care. Empowering Life.",
  poweredBy: "Livexpert Technologies",
  website: "www.kibo360.in",
  address: "Bhutani Cyber Park, Block C, Sector 62, Noida - 201305, India",
  phone: "+91-800 800 5672",
  email: "support@kibo360.in", // public support inbox - make sure this mailbox exists!
};

// Deck p.2 - ecosystem hub around KIBO360
export const ecosystemNodes = [
  "Operations",
  "Customer Relationships",
  "Finance",
  "Inventory Management",
  "Healthcare Solutions",
  "Industry-Specific Applications",
  "Teams & Collaboration",
  "Insights & Analytics",
];

// Deck p.2 - bottom value pillars
export const valuePillars = [
  { icon: "network", title: "Connected Ecosystem", text: "Unify teams, processes and information." },
  { icon: "workflow", title: "Smarter Workflows", text: "Simplify operations and boost productivity." },
  { icon: "target", title: "Better Decisions", text: "Real-time insights for strategic outcomes." },
  { icon: "heart", title: "Customer Centric", text: "Stronger relationships, better experiences." },
  { icon: "shield", title: "Secure & Reliable", text: "Enterprise-grade security you can trust." },
  { icon: "trending-up", title: "Scalable Growth", text: "Built to grow with your business and industry." },
];

// Deck p.2 - about narrative
export const aboutNarrative = [
  "At Livexpert Technologies, we believe every great organization is powered by people, purpose, and the ability to work as one.",
  "KIBO360 is our vision of a connected digital ecosystem, where technology brings together teams, processes, and information to create smarter, simpler, and more meaningful ways of working.",
  "Designed for modern organizations, KIBO360 seamlessly connects operations, customer relationships, finance, inventory, healthcare solutions, and industry-specific applications into one unified experience. From everyday tasks to strategic decisions, every workflow is built to move effortlessly - giving people the freedom to focus on what truly matters.",
  "Whether you're growing a business, transforming an industry, or preparing for what's next, KIBO360 grows with you - bringing clarity, connection, and confidence to every step of your journey.",
];

// Brochure badges
export const platformBadges = [
  { icon: "cloud", title: "Cloud Native", text: "Scalable, reliable and accessible anywhere." },
  { icon: "cpu", title: "AI Powered", text: "Intelligent automation for better outcomes." },
  { icon: "lock", title: "Secure & Compliant", text: "Bank-grade security with role-based access control." },
  { icon: "layers", title: "Modular & Scalable", text: "Deploy what you need today, scale effortlessly tomorrow." },
  { icon: "smartphone", title: "Mobile Ready", text: "Access critical information on the go." },
  { icon: "link", title: "API Ready", text: "Easy integration with third-party systems." },
];

// Products catalogue (SaaS platform grid on Home)
export const products = [
  {
    slug: "hms",
    short: "HMS",
    name: "Hospital Management Software",
    status: "Live",
    subdomain: "hms.kibo360.in",
    route: "/products/hospitalmanagementsoftware",
    blurb:
      "End-to-end hospital operations - OPD/IPD, EMR/EHR, diagnostics, pharmacy, finance ERP, HR & payroll, and AI analytics on one intelligent database.",
    highlights: ["Patient Access & OPD/IPD", "EMR / EHR", "Diagnostics & Pharmacy", "Finance, HR & Revenue Cycle"],
  },
  {
    slug: "cms",
    short: "CMS",
    name: "Clinic Management Software",
    status: "Live",
    subdomain: "cms.kibo360.in",
    route: "/products/clinicalmanagementsoftware",
    blurb:
      "Everything a modern clinic needs - appointments, queue & token, doctor EMR, e-prescriptions, billing and follow-ups - ready in days, not months.",
    highlights: ["Appointments & Queue", "Doctor EMR & e-Rx", "Billing & GST Invoicing", "WhatsApp/SMS Reminders"],
  },
  {
    slug: "coming-soon",
    short: "+",
    name: "More Products Coming Soon",
    status: "Roadmap",
    subdomain: "*.kibo360.in",
    route: null,
    blurb:
      "Inventory, Finance ERP, LIS and CRM are on the way - every new product plugs into the same KIBO360 ecosystem and shared intelligent database.",
    highlights: ["Inventory", "Finance", "LIS", "CRM"],
  },
];

// Upcoming standalone products (shown on /products and in the footer)
export const upcomingProducts = [
  {
    slug: "inventory",
    name: "Inventory",
    icon: "box",
    subdomain: "inventory.kibo360.in",
    blurb:
      "Standalone inventory & stores management - stock, batch and expiry tracking, reorder automation, vendors and asset registers for any healthcare facility.",
  },
  {
    slug: "finance",
    name: "Finance",
    icon: "banknote",
    subdomain: "finance.kibo360.in",
    blurb:
      "Full finance & accounts ERP - general ledger, AP/AR, cash & bank, GST compliance, cost centers and live financial statements.",
  },
  {
    slug: "lis",
    name: "LIS",
    icon: "flask",
    subdomain: "lis.kibo360.in",
    blurb:
      "Laboratory Information System for diagnostic labs and chains - sample lifecycle, instrument integration, NABH / ISO 15189-ready QC and reporting.",
  },
  {
    slug: "crm",
    name: "CRM",
    icon: "heart",
    subdomain: "crm.kibo360.in",
    blurb:
      "Healthcare CRM - enquiries and lead pipelines, patient follow-up journeys, WhatsApp/SMS campaigns and feedback that grows your ratings.",
  },
];

// Brochure p.2 - capability & business impact matrix
export const capabilityMatrix = [
  {
    pillar: "Clinical Excellence",
    text: "Deliver superior care with seamless clinical workflows.",
    capabilities: ["Patient Portals", "Queue & Token Management", "EMR / EHR", "Nursing", "OT & ICU Management", "Discharge Management"],
    impact: "Reduces patient wait times, minimizes manual charting, and accelerates discharge.",
  },
  {
    pillar: "Diagnostics & Ancillary",
    text: "Optimize diagnostics and pharmacy operations.",
    capabilities: ["LIS", "Radiology", "Pharmacy Inventory", "Sample Tracking", "Batch Management"],
    impact: "Prevents stockouts, automates sample workflows, and ensures fast, accurate report delivery.",
  },
  {
    pillar: "Enterprise Operations",
    text: "Streamline enterprise functions and drive financial control.",
    capabilities: ["General Ledger (GL)", "AP, AR & Cash Management", "GST Compliance", "Procurement (RFQ, PO)", "HR & Payroll", "Asset Tracking (AMC)"],
    impact: "Eliminates revenue leakage, automates vendor management, and centralizes multi-location accounting.",
  },
  {
    pillar: "Cognitive Intelligence",
    text: "Turn data into decisions with AI-driven insights.",
    capabilities: ["Voice-to-Text AI", "Predictive Analytics", "Executive Dashboards", "PACS / SMS / API Integrations"],
    impact: "Enables hands-free clinical notes, provides real-time KPI visibility, and alerts on bottlenecks.",
  },
];

// Platform proof-points (numbers from the deck)
export const platformStats = [
  { value: "14K+", label: "Patients Processed" },
  { value: "₹25 Cr+", label: "Annual Billing Managed" },
  { value: "98%", label: "Billing Accuracy" },
  { value: "300+", label: "Active Vendors" },
  { value: "99%", label: "Patient Satisfaction" },
];

// Brochure - target sectors
// img: photo tiles used on the Home "who it's for" section
export const targetSectors = [
  { icon: "hospital", name: "Hospitals", img: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=700&q=80" },
  { icon: "buildings", name: "Multi-Specialty Groups", img: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=700&q=80" },
  { icon: "flask", name: "Diagnostic Chains", img: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=700&q=80" },
  { icon: "cap", name: "Medical Colleges", img: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=700&q=80" },
  { icon: "stethoscope", name: "Clinics", img: "https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&w=700&q=80" },
];

// Deck p.39 - integrations (India-first)
export const integrations = [
  "ABDM / ABHA", "PACS", "LIS", "HL7 / FHIR", "Payment Gateway", "UPI",
  "SMS", "WhatsApp", "Email", "TPA / Insurance APIs", "Medical Devices", "Analytics Engine",
];

// Security & compliance - terms used in the Indian health industry
export const securityFeatures = [
  "ABDM & ABHA Ready", "DPDP Act 2023 Aligned", "NABH-Aligned Workflows", "Role-Based Access",
  "AES-256 Encryption", "Two-Factor Authentication", "Audit Logs", "Backups & Disaster Recovery",
];

// Same data grouped for the Home "security hub" layout
export const securityGroups = [
  {
    key: "certifications",
    label: "Certifications",
    icon: "award",
    tone: "violet",
    items: ["ABHA Certified", "ISO 9001:2015 Quality Management Systems", "CMMI Level 3"],
  },
  {
    key: "access",
    label: "Access Control",
    icon: "users",
    tone: "pink",
    items: ["Role-Based Access", "Two-Factor Authentication"],
  },
  {
    key: "data",
    label: "Data Protection",
    icon: "lock",
    tone: "coral",
    items: ["AES-256 Encryption", "Audit Logs"],
  },
  {
    key: "resilience",
    label: "Resilience",
    icon: "cloud",
    tone: "navy",
    items: ["Backups & Disaster Recovery", "Cloud-Native Uptime"],
  },
];

// Deck p.42 - roadmap
export const roadmap = [
  { step: "01", title: "AI Agents", text: "Intelligent agents automating healthcare workflows." },
  { step: "02", title: "Predictive Healthcare", text: "AI-driven insights for early detection and better outcomes." },
  { step: "03", title: "Voice EMR", text: "Voice-enabled documentation for faster and smarter records." },
  { step: "04", title: "Digital Twins", text: "Virtual replicas for real-time simulation and decision support." },
  { step: "05", title: "Remote Monitoring", text: "Connected care beyond hospitals with real-time monitoring." },
  { step: "06", title: "Generative AI", text: "AI that creates smarter content, insights and solutions." },
  { step: "07", title: "IoT Integration", text: "Seamless device connectivity for smarter healthcare ecosystems." },
  { step: "08", title: "Smart Hospitals", text: "Intelligent hospitals delivering better care and patient experience." },
];

// ---------------------------------------------------------------------------
// HMS page content (deck p.1–43)
// ---------------------------------------------------------------------------

export const hms = {
  heroBadges: ["AI Powered", "Secure", "Cloud Based"],
  heroTitle: "Hospital Management Software (HMS)",
  heroSub: "Transforming Healthcare with Intelligent Hospital Operations",
  heroText:
    "KIBO360 HMS is an AI-powered, cloud-native platform that unifies healthcare operations and enterprise functions for smarter, faster and better outcomes.",
  dashboardStats: [
    { label: "OPD - Today's Visits", value: "1,243", delta: "↑ 12.5%" },
    { label: "IPD - Admitted", value: "326", delta: "↑ 8.2%" },
    { label: "Pharmacy - Total Orders", value: "1,682", delta: "↑ 15.3%" },
    { label: "Laboratory - Tests Today", value: "2,451", delta: "↑ 10.4%" },
  ],

  challenges: [
    { icon: "file-text", name: "Manual Records", text: "Files go missing; hours are lost searching." },
    { icon: "banknote", name: "Billing Delays", text: "Slow invoicing that stalls cash flow." },
    { icon: "clock", name: "Long Waiting Time", text: "Queues frustrate patients before care begins." },
    { icon: "box", name: "Inventory Loss", text: "Expired stock and shrinkage nobody catches." },
    { icon: "megaphone", name: "Poor Communication", text: "Departments working blind to each other." },
    { icon: "folders", name: "Paper-Based Workflow", text: "Processes that can't scale or be audited." },
  ],
  // pct drives the "damage meter" bar widths
  challengeStats: [
    { value: "30%", pct: 30, label: "Operational Inefficiency" },
    { value: "25%", pct: 25, label: "Revenue Leakage" },
    { value: "40%", pct: 40, label: "Patient Dissatisfaction" },
    { value: "50%+", pct: 52, label: "Time Spent on Manual Tasks" },
  ],

  solutionWheel: [
    "Patient Access", "Clinical Operations", "Diagnostics & Pharmacy",
    "Revenue & Reporting", "Finance & Billing", "TPA (Insurance)",
    "Ambulance Management", "AI & Analytics", "Mobile Applications",
  ],

  modules: [
    {
      id: "patient-access",
      icon: "users",
      title: "Patient Access",
      tagline: "Seamless Patient Journey. Better Experience. Better Care.",
      features: [
        "Patient Registration", "Appointment Scheduling", "Queue Management",
        "Patient Portal", "Online Registration", "Token Management",
        "OPD / IPD Registration", "Front Office Management", "Patient Search",
        "Emergency Registration", "Insurance Verification",
      ],
      workflow: ["Registration", "Appointment Scheduling", "Insurance Verification", "Check-in", "Documentation", "Patient Approval"],
      stats: [
        { value: "80%", label: "Faster Registration" },
        { value: "95%", label: "Appointment Accuracy" },
        { value: "60%", label: "Reduced Waiting Time" },
        { value: "2 Min", label: "Per Patient Time" },
      ],
      extra: {
        heading: "Patient Portal",
        items: ["View Appointments", "Medical History", "Reports & Documents", "Prescriptions", "Online Payments", "Teleconsultation", "Health Reminders"],
      },
    },
    {
      id: "hospital-operations",
      icon: "hospital",
      title: "Hospital Operations",
      tagline: "Intelligent Hospital Workflows. Better Care. Better Outcomes.",
      features: [
        "EMR / EHR - Patient Timeline", "Clinical Notes", "Vitals & Observations",
        "Lab & Radiology Results", "Prescriptions", "Allergies & History",
        "Ward Management", "ICU Management", "Nursing Station", "Operation Theatre",
        "Care Plans", "Nursing Assessment", "Discharge Summary",
      ],
      workflow: ["Admission", "Ward / ICU", "Care Plan", "Nursing Assessment", "OT (if needed)", "Discharge Summary"],
      stats: [
        { value: "76%", label: "Bed Occupancy Visibility" },
        { value: "100%", label: "Digital Clinical Notes" },
        { value: "24×7", label: "Nursing Station Access" },
        { value: "1-Click", label: "Discharge Summaries" },
      ],
      extra: null,
    },
    {
      id: "diagnostics-pharmacy",
      icon: "flask",
      title: "Diagnostics & Pharmacy",
      tagline: "Accurate. Integrated. Efficient.",
      features: [
        "Automated Sample Management", "Instrument Integration", "Customizable Workflow Automation",
        "Real-Time Data Analytics", "NABH / ISO 15189-Ready Workflows", "EHR Integration",
        "Medicine Management", "Stock & Batch Tracking", "Prescription Analytics",
        "Expiry Alerts", "Reorder & Vendor Management", "Purchase Management",
      ],
      workflow: ["Order", "Sample Collection", "Processing", "Verification", "Report Delivery", "Pharmacy Dispense"],
      stats: [
        { value: "99%", label: "Pharmacy Inventory Accuracy" },
        { value: "25%", label: "Cost Savings" },
        { value: "30%", label: "Reduction in Expiry Loss" },
        { value: "98%", label: "Stock Availability" },
      ],
      extra: {
        heading: "Inventory Impact",
        items: ["45% inventory accuracy improvement", "₹2.4M+ cost savings achieved", "24 hrs average reorder time", "Full batch & asset tracking"],
      },
    },
    {
      id: "finance-erp",
      icon: "banknote",
      title: "Finance & Accounts (ERP)",
      tagline: "Gain Complete Financial Control with Real-Time Insights.",
      features: [
        "General Ledger", "Accounts Payable", "Accounts Receivable", "Cash & Bank",
        "GST Management", "Cost Centers", "Financial Statements", "Budgeting",
      ],
      workflow: ["General Ledger", "Accounts Payable", "Accounts Receivable", "Cash & Bank Reconciliation"],
      stats: [
        { value: "100%", label: "Accurate & Reliable" },
        { value: "GST", label: "Compliance Ready" },
        { value: "Live", label: "Financial Statements" },
        { value: "Multi", label: "Cost Centers" },
      ],
      extra: null,
    },
    {
      id: "hr-payroll",
      icon: "calendar",
      title: "HR & Payroll",
      tagline: "Smart HR & Seamless Payroll Management.",
      features: [
        "Employee Management & Lifecycle", "Biometric Attendance", "Real-Time Attendance Tracking",
        "Shift Planning & Duty Roster", "Leave Request & Approval Workflow", "Holiday Calendar",
        "Automated Payroll Processing", "PF, ESI, PT & Tax Calculations", "Payslip Generation", "Bank Transfer Integration",
      ],
      workflow: ["Attendance", "Shifts & Roster", "Leave Approval", "Payroll Run", "Payslips", "Salary Credit"],
      stats: [
        { value: "325+", label: "Employees Managed" },
        { value: "96%", label: "Attendance This Month" },
        { value: "12", label: "Active Departments" },
        { value: "Auto", label: "PF / ESI / PT / Tax" },
      ],
      extra: null,
    },
    {
      id: "procurement",
      icon: "box",
      title: "Procurement & Purchase",
      tagline: "Smart Procurement for Faster, Cost-Effective Purchasing.",
      features: [
        "Purchase Requisition", "RFQ (Request for Quotation)", "Vendor Comparison",
        "Purchase Orders", "Goods Receipt", "Quality Check", "Vendor Management", "Payment Processing",
      ],
      workflow: ["Purchase Request", "Approval", "RFQ", "Vendor Selection", "Purchase Order", "Goods Receipt"],
      stats: [
        { value: "300+", label: "Active Vendors" },
        { value: "98%", label: "On-Time Delivery" },
        { value: "24 hrs", label: "Approval Time" },
        { value: "100%", label: "Digital Records" },
      ],
      extra: null,
    },
    {
      id: "asset-management",
      icon: "layers",
      title: "Asset Management",
      tagline: "Track, Maintain, and Maximize Every Asset.",
      features: [
        "Asset Registration & Onboarding", "Calibration Schedules", "Automated Depreciation",
        "Preventive Maintenance", "AMC Management",
      ],
      workflow: ["Register", "Calibrate", "Maintain", "Depreciate", "Renew AMC"],
      stats: [
        { value: "↑", label: "Improved Asset Utilization" },
        { value: "↓", label: "Reduced Downtime & Costs" },
        { value: "✓", label: "Compliance & Accuracy" },
        { value: "+", label: "Extended Asset Lifespan" },
      ],
      extra: null,
    },
    {
      id: "revenue-cycle",
      icon: "trending-up",
      title: "Revenue Cycle & Reporting",
      tagline: "Drive Revenue. Ensure Compliance. Make Smarter Decisions.",
      features: [
        "Patient Registration", "Insurance Verification", "Charge Capture", "Claims Submission",
        "Payment Collection", "Denial Management", "Revenue Reconciliation", "Reporting & Analytics",
      ],
      workflow: ["Charge Capture", "Claims Submission", "Payment Collection", "Denial Management", "Reconciliation", "Analytics"],
      stats: [
        { value: "₹25 Cr+", label: "Annual Billing" },
        { value: "98%", label: "Billing Accuracy" },
        { value: "35%", label: "Denial Reduction" },
        { value: "20%", label: "Faster Collections" },
      ],
      extra: {
        heading: "Revenue & Analytics Dashboard",
        items: ["Total revenue ₹25.4 Cr tracked live", "98% collection efficiency", "₹12,450 average transaction value", "31% return on investment"],
      },
    },
    {
      id: "ai-features",
      icon: "cpu",
      title: "AI Features",
      tagline: "Smarter Healthcare. Personalized for Every Patient.",
      features: [
        "AI-Powered Chatbot", "AI Insights", "Predictive Analytics", "Treatment Reminders",
        "Smart Care Routing", "Automated Follow-Up", "Faster Diagnosis Support", "Voice Assistance",
      ],
      workflow: ["Patient Query", "AI Chatbot", "Smart Routing", "Care Delivery", "Automated Follow-Up"],
      stats: [
        { value: "62%", label: "Faster Response" },
        { value: "70%", label: "Operational Efficiency" },
        { value: "92%", label: "Patient Satisfaction" },
        { value: "95%", label: "Prediction Accuracy" },
      ],
      extra: {
        heading: "AI in Action - Business Impact",
        items: ["40% faster diagnosis with AI-powered insights", "60% documentation time saved with voice assistance", "25% risk reduction via early identification", "28% increase in patient satisfaction"],
      },
    },
    {
      id: "ambulance",
      icon: "map-pin",
      title: "Ambulance Management",
      tagline: "Emergency Response, Tracked in Real Time.",
      features: [
        "Live GPS Tracking", "Ambulance Availability", "Driver & Vehicle Details",
        "Emergency Dispatch", "Trip Management", "Alerts & Notifications",
      ],
      workflow: ["Emergency Call", "Dispatch", "Live GPS En Route", "Patient Pickup", "Hospital Handover"],
      stats: [
        { value: "3.2K+", label: "Trips This Month" },
        { value: "97%", label: "On-Time Performance" },
        { value: "47%", label: "Fleet Utilization" },
        { value: "08 min", label: "Typical ETA" },
      ],
      extra: null,
    },
    {
      id: "mobile-app",
      icon: "smartphone",
      title: "Patient Mobile App",
      tagline: "Healthcare at Your Fingertips.",
      features: [
        "Appointment Booking", "Reports & Prescriptions", "Medical History", "Online Payments",
        "Notifications", "Chat", "E-Prescriptions", "Consultation Notes",
      ],
      workflow: ["Book Appointment", "Consult Doctor", "Get e-Prescription", "Pay Online", "Track Health"],
      stats: [
        { value: "iOS", label: "+ Android Ready" },
        { value: "Live", label: "Lab Report Access" },
        { value: "Secure", label: "Health Records" },
        { value: "24×7", label: "Booking & Support" },
      ],
      extra: null,
    },
  ],

  whyChoose: [
    "ABDM & ABHA Ready", "NABH-Aligned Workflows", "GST-Compliant Billing", "Modular Architecture",
    "Cloud Based", "AI Enabled", "Mobile Ready", "Multi-Hospital Support",
    "Real-Time Analytics", "24×7 Support",
  ],
};

// ---------------------------------------------------------------------------
// CMS page content (adapted from HMS material for clinic-scale practices)
// ---------------------------------------------------------------------------

export const cms = {
  heroBadges: ["AI Powered", "Secure", "Cloud Based"],
  heroTitle: "Clinic Management Software (CMS)",
  heroSub: "Everything a Modern Clinic Needs - from Appointment to Prescription to Payment",
  heroText:
    "KIBO360 CMS brings the same AI-powered platform that runs hospitals to single doctors, polyclinics and clinic chains - simple to start, powerful as you grow.",

  challenges: [
    { icon: "file-text", name: "Paper Prescriptions" },
    { icon: "clock", name: "Crowded Waiting Area" },
    { icon: "bell-off", name: "Missed Follow-Ups & No-Shows" },
    { icon: "banknote", name: "Manual Billing Errors" },
    { icon: "folders", name: "Scattered Patient Records" },
    { icon: "chart-down", name: "No Practice Insights" },
  ],

  modules: [
    { icon: "calendar", title: "Appointments & Queue", text: "Online booking, walk-ins, queue & token management with live status displays." },
    { icon: "stethoscope", title: "Doctor EMR & e-Prescriptions", text: "Patient timeline, vitals, clinical notes, allergies and printable e-prescriptions." },
    { icon: "receipt", title: "Billing & GST Invoicing", text: "Smart billing, GST-ready invoices, discounts, packages and daily collection reports." },
    { icon: "pill", title: "Pharmacy & Stock", text: "Dispensing, stock tracking, expiry alerts and purchase management for in-clinic pharmacy." },
    { icon: "users", title: "Patient Records & Portal", text: "Complete history, reports and documents - patients access everything from their portal." },
    { icon: "video", title: "Teleconsultation", text: "Video consults with online payments, e-prescriptions and digital consultation notes." },
    { icon: "message", title: "WhatsApp / SMS Reminders", text: "Automated appointment reminders and follow-ups that cut no-shows." },
    { icon: "bar-chart", title: "Reports & Analytics", text: "Revenue, visits, doctor performance and patient trends on a live dashboard." },
  ],

  workflow: ["Book / Walk-in", "Check-in & Token", "Consultation", "e-Prescription", "Billing & Payment", "Automated Follow-Up"],

  stats: [
    { value: "80%", label: "Faster Registration" },
    { value: "60%", label: "Less Waiting Time" },
    { value: "92%", label: "Patient Satisfaction" },
    { value: "2 Min", label: "Per Patient Time" },
  ],

  whyChoose: [
    "Made for single doctors, polyclinics & chains",
    "Live in days - no heavy setup",
    "Same KIBO360 platform as HMS - upgrade to full hospital suite without migration",
    "Works on desktop, tablet & mobile",
    "WhatsApp-first patient communication",
    "24×7 support",
  ],
};

// ---------------------------------------------------------------------------
// Testimonials - PLACEHOLDER quotes (no real names). Replace with real,
// permissioned customer quotes before production launch.
// ---------------------------------------------------------------------------

// Reviewer photos live in frontend/public/team/. `img` is optional -
// leave null to show an initials avatar instead.
// NOTE: quote wording is drafted - have each doctor confirm/replace their
// statement before production launch.
export const testimonials = [
  {
    name: "Dr. Jv Pranav Sharma",
    role: "General Surgeon",
    img: "/team/pranav-sharma.jpg",
    quote:
      "Admissions, ward notes and discharge summaries used to eat my evenings. With Kibo360 the whole surgical workflow is digital and audit-ready.",
  },
  {
    name: "Dr. Manya",
    role: "Dentist",
    img: "/team/manya.jpg",
    quote:
      "Reminders cut our no-shows dramatically, and patients love getting reports on their phone. It feels like a big-hospital system sized for my clinic.",
  },
  {
    name: "Dr. Aditya Pathani",
    role: "General Physician",
    img: "/team/aditya-pathani.jpg",
    quote:
      "My OPD runs on Kibo360 end to end - appointments, e-prescriptions and billing on one screen. Consultations are faster and my front desk finally breathes.",
  },
  {
    name: "Dr. Akshay Tekta",
    role: "Oral and Maxillofacial Surgeon",
    img: "/team/akshay-tekta.jpg",
    quote:
      "From OT scheduling to post-op follow-ups on WhatsApp, everything stays connected. My team spends its time with patients, not with paperwork.",
  },
];

// ---------------------------------------------------------------------------
// FAQs (also emitted as FAQPage structured data for SEO)
// ---------------------------------------------------------------------------

export const hmsFaqs = [
  {
    q: "What is KIBO360 Hospital Management Software (HMS)?",
    a: "KIBO360 HMS is an AI-powered, cloud-native hospital management platform that unifies OPD/IPD, EMR/EHR, diagnostics, pharmacy, billing, finance ERP, HR & payroll and analytics on a single intelligent database - one patient record and one billing engine across your whole hospital.",
  },
  {
    q: "Is HMS the same as HIS (Hospital Information System)?",
    a: "Yes. HIS and HMS refer to the same KIBO360 product. Whether your team calls it a hospital information system or hospital management software, it is one platform at hms.kibo360.in.",
  },
  {
    q: "Is KIBO360 HMS cloud-based?",
    a: "Yes - KIBO360 is cloud-native, so it is accessible from anywhere, scales with your organization and supports multi-hospital deployments with centralized, multi-location accounting.",
  },
  {
    q: "How long does implementation take?",
    a: "KIBO360 is modular: most hospitals go live with core modules (patient access, billing, pharmacy) in weeks, then switch on additional modules like LIS, HR & payroll or asset management as they grow - no re-implementation needed.",
  },
  {
    q: "Does it integrate with ABDM, lab instruments and existing systems?",
    a: "Yes. KIBO360 HMS is ABDM-ready (create and link ABHA health IDs) and integrates with PACS, LIS and lab instruments (bi-directional), HL7/FHIR systems, payment gateways and UPI, SMS/WhatsApp/email, TPA and insurance APIs, and medical devices.",
  },
  {
    q: "Is patient data secure and compliant with Indian regulations?",
    a: "KIBO360 aligns data handling with India's DPDP Act 2023 and supports NABH-aligned clinical documentation. Data is protected with AES-256 encryption, role-based access control, two-factor authentication, full audit logs, regular backups and disaster recovery. Lab workflows support ISO 15189 and NABH-ready quality standards.",
  },
];

export const cmsFaqs = [
  {
    q: "Who is KIBO360 Clinic Management Software for?",
    a: "CMS is built for single-doctor practices, polyclinics and clinic chains that want appointments, queue & token management, doctor EMR, e-prescriptions, billing and follow-ups without the complexity of a full hospital system.",
  },
  {
    q: "How quickly can my clinic go live?",
    a: "Most clinics are live in days, not months - there is no heavy setup. You can start with appointments and billing on day one and add pharmacy or teleconsultation later.",
  },
  {
    q: "Can I upgrade from CMS to the full HMS later?",
    a: "Yes - CMS runs on the same KIBO360 platform and database as HMS. When your clinic grows into a hospital, you upgrade in place: your patients, records and billing history come with you, with zero data migration.",
  },
  {
    q: "Does CMS send WhatsApp and SMS reminders?",
    a: "Yes. Automated appointment reminders, follow-up nudges and report-ready alerts go out over WhatsApp and SMS, which is one of the biggest drivers of reduced no-shows.",
  },
  {
    q: "Does CMS support GST billing, ABHA and Indian payment methods?",
    a: "Yes. CMS generates GST-compliant invoices, is ABDM-ready so you can create and link ABHA health IDs, and accepts UPI and card payments through integrated payment gateways.",
  },
  {
    q: "Is my clinic's data secure?",
    a: "Yes - the same bank-grade security as our hospital platform, aligned with India's DPDP Act 2023: encrypted data, role-based access, audit logs and automatic backups.",
  },
];

// ---------------------------------------------------------------------------
// Stock imagery (relevant healthcare photos, used across Home / CMS / HMS)
// ---------------------------------------------------------------------------

export const images = {
  careTeam: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80",
  hospitalOps: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80",
  adminAnalytics: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=900&q=80",
  ePrescription: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=900&q=80",
  patientPortal: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=900&q=80",
  doctorTablet: "https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&w=900&q=80",
};

// ---------------------------------------------------------------------------
// Legal pages (drafts - review by legal counsel before production)
// ---------------------------------------------------------------------------

export const legalMeta = {
  effectiveDate: "31 August 2026",
  entity: "Livexpert Technologies",
  site: "kibo360.in",
};
