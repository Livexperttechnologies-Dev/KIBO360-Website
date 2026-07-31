# KIBO360.in — Platform Website Plan

> **Status:** Master specification for the kibo360.in marketing/platform website.
> **Sources:** `360 Final Deck.pdf` (43 pages) and `Kibo 360 broucher.pdf` (2 pages) in this folder.
> **Built by:** Livexpert Technologies (info@livexperttechnologies.com)

---

## 1. What we are building

A **SaaS platform website** for **KIBO360** — "One Platform. Every Business." — where each
product (HMS, CMS, and future products) gets its own marketing page today and its own
**subdomain application** later (e.g. `hms.kibo360.in`, `cms.kibo360.in`).

The Home page presents KIBO360 as a **connected digital ecosystem** (idea taken from
**page 2 of `360 Final Deck.pdf`** — "About KIBO360, Where possibilities come together"):
a central KIBO360 hub connected to Operations, Customer Relationships, Finance, Inventory
Management, Healthcare Solutions, Industry-Specific Applications, Teams & Collaboration,
and Insights & Analytics.

### Pages (7 total — this phase)

| # | Page                 | Route            | Content source                            |
|---|----------------------|------------------|-------------------------------------------|
| 1 | Home                 | `/`              | Deck p.2 (ecosystem) + brochure           |
| 2 | HIS / HMS product    | `/products/hms`  | Deck p.1–43 (full HMS content)            |
| 3 | CMS product          | `/products/cms`  | Adapted from HMS content for clinics      |
| 4 | Contact Us           | `/contact`       | Deck p.43 (address/phone/email) + form    |
| 5 | About Us             | `/about`         | Deck p.2 + brochure p.2                   |
| 6 | Privacy Policy       | `/privacy-policy`| Standard legal (drafted)                  |
| 7 | Terms & Conditions   | `/terms`         | Standard legal (drafted)                  |

> **Naming note:** The user calls page 2 "HIS" (Hospital Information System). The deck
> brands the product **"Hospital Management Software (HMS)"**. We use HMS as the product
> name everywhere and also redirect `/his` → `/products/hms` so both names work.

---

## 2. Tech stack & local ports

| Layer     | Tech                                            | Port     |
|-----------|-------------------------------------------------|----------|
| Frontend  | React 18 + Vite + React Router 6 (JavaScript)   | **3001** |
| Backend   | Node.js + Express 4 (contact/demo API)          | **5001** |

- Ports are **pinned with `strictPort`** (frontend) and fixed `PORT=5001` (backend), so
  they never jump to another port and never clash with the user's other local projects.
- Vite dev server **proxies `/api/*` → `http://localhost:5001`**, so the frontend calls
  `/api/...` with no CORS pain. CORS is additionally enabled on the backend as a fallback.
- No database needed yet — the backend appends form submissions to
  `backend/data/submissions.json` (created automatically). Easy to swap for MongoDB/SQL later.

### Folder structure

```
Kibo 360/
├── 360 Final Deck.pdf              # source material (unchanged)
├── Kibo 360 broucher.pdf           # source material (unchanged)
├── KIBO360-WEBSITE-PLAN.md         # this file
├── frontend/                       # React app  → http://localhost:3001
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js              # port 3001 strict + /api proxy
│   └── src/
│       ├── main.jsx                # router setup, scroll restoration
│       ├── App.jsx                 # layout shell (Navbar + Outlet + Footer)
│       ├── styles/global.css       # design tokens + all component styles
│       ├── data/siteData.js        # ALL page content lives here (single source)
│       ├── components/
│       │   ├── Navbar.jsx          # sticky, products dropdown, mobile menu
│       │   ├── Footer.jsx          # dark footer (deck p.43 style)
│       │   ├── SectionHeading.jsx  # eyebrow + gradient title + subtitle
│       │   ├── StatCard.jsx        # big number + label (deck stat tiles)
│       │   ├── FeatureCard.jsx     # icon + title + description card
│       │   ├── CTABanner.jsx       # gradient call-to-action strip
│       │   └── ContactForm.jsx     # posts to /api/contact
│       └── pages/
│           ├── Home.jsx
│           ├── ProductHMS.jsx
│           ├── ProductCMS.jsx
│           ├── About.jsx
│           ├── Contact.jsx
│           ├── PrivacyPolicy.jsx
│           └── Terms.jsx
└── backend/                        # Express API → http://localhost:5001
    ├── package.json
    ├── server.js                   # routes, validation, JSON persistence
    └── data/submissions.json       # saved contact/demo submissions (auto-created)
```

### How to run (two terminals)

```bash
# Terminal 1 — backend  (http://localhost:5001)
cd backend
npm install
npm start

# Terminal 2 — frontend (http://localhost:3001)
cd frontend
npm install
npm run dev
```

---

## 3. Brand & design system (taken from the deck)

**Logo:** the official KIBO360 brand PNGs (from livexperttechnologies.com), self-hosted in
`frontend/public/` and auto-trimmed of padding to 330×136 (transparent background):
- `kibo360-logo.png` (color) — used in the navbar and the Home ecosystem-orbit center (light backgrounds).
- `kibo360-logo-white.png` (white wordmark) — used in the dark footer.
Both include the "ONE PLATFORM. EVERY BUSINESS." tagline. To update the logo later,
replace those two files (keep the same names) — no code change needed.

**Color tokens** (`:root` CSS variables — from the Livexpert reference landing page):

| Token         | Value                   | Usage                                    |
|---------------|-------------------------|------------------------------------------|
| `--primary`   | `#6C22D6`               | Deep violet — links, radials, borders    |
| `--secondary` | `#E03E8F`               | Vibrant pink — checkmarks, accents       |
| `--accent`    | `#FF7555`               | Coral — highlights, dark-bg titles       |
| `--ink`       | `#1A0C43`               | Dark navy headings (LIVEXPERT navy)      |
| `--body`      | `#4A5568`               | Gray body text                           |
| `--bg`        | `#FAF9FE`               | Clean light background                   |
| `--line`      | `rgba(26,12,67,0.08)`   | Borders                                  |
| `--dark`      | `#1A0C43` → `#150935`   | Dark gradient (security card, CTA, footer)|

- **Brand gradient:** `linear-gradient(135deg, #6C22D6 0%, #E03E8F 50%, #FF7555 100%)`
  — buttons, active tabs, stat numbers, logo accents, SVG chart strokes.
- **Glassmorphism:** cards use `rgba(255,255,255,0.85)` + `backdrop-filter: blur(12px)`
  + violet-tinted border; ambient radial glows (violet top-right, coral mid-left).
- **Typography:** `Plus Jakarta Sans` everywhere (300–800 weights), tight letter-spacing
  on headings.
- **Icons:** custom hand-built inline-SVG icon set (`components/Icon.jsx`, ~40 line icons,
  24px grid, `stroke=currentColor`) — **no emoji anywhere on the site**. Icons inherit
  color from their container (violet in tinted badges, white on gradient tiles).
- **Buttons:** 28px-radius pills with violet glow shadows; accent CTA uses the
  pink→coral gradient; dark sections use white outline buttons.
- **Reference features adopted:** floating glass dashboard with SVG sparkline + radial
  occupancy chart (HMS hero), auto-rotating 4-tab showcase with progress bars (HMS),
  image sections with glass chart overlays (HMS only), dark navy security card with
  coral cert titles, workflow pipeline with gradient step numbers.

---

## 4. Page-by-page content spec

### 4.1 Home (`/`) — "platform for SaaS softwares" (deck p.2 idea)

1. **Hero** — badge "AI Powered · Cloud Native · Secure"; H1 "One Platform. **Endless
   Possibilities.**"; sub: "KIBO360 is an AI-powered, cloud-native ERP ecosystem that
   unifies patient care, diagnostics, finance and human resources into a single,
   intelligent database." CTAs: **Explore Products** (→ /products/hms) and **Book a Demo**
   (→ /contact). Right side: ecosystem hub visual — KIBO360 logo circle with 8 orbiting
   module chips (Operations, Customer Relationships, Finance, Inventory Management,
   Healthcare Solutions, Industry-Specific Applications, Teams & Collaboration,
   Insights & Analytics) — the deck p.2 diagram rebuilt in CSS.
2. **Trust strip** — CLOUD NATIVE / AI POWERED / SECURE & COMPLIANT / MODULAR & SCALABLE /
   MOBILE READY (brochure badges with one-liners).
3. **About blurb** — "Where possibilities come together" paragraph from deck p.2
   (Livexpert vision, connected digital ecosystem).
4. **Six value pillars** (deck p.2 bottom row): Connected Ecosystem, Smarter Workflows,
   Better Decisions, Customer Centric, Secure & Reliable, Scalable Growth — each with its
   one-line description.
5. **Products** — the SaaS catalogue grid:
   - **HMS — Hospital Management Software** ("Live") → `/products/hms`, subdomain note
     `hms.kibo360.in`, blurb + 4 key modules.
   - **CMS — Clinic Management Software** ("Live") → `/products/cms`, subdomain note
     `cms.kibo360.in`, blurb + 4 key modules.
   - **Coming soon** card — LIMS, Diagnostics Chain Suite, Medical College ERP…
     ("New products plug into the same KIBO360 ecosystem").
6. **Platform capability matrix** (brochure p.2): Clinical Excellence, Diagnostics &
   Ancillary, Enterprise Operations, Cognitive Intelligence — pillar + capabilities + impact.
7. **Stats band** (deck numbers): 14K+ patients processed · ₹25 Cr+ annual billing
   managed · 98% billing accuracy · 300+ active vendors · 99% patient satisfaction.
8. **Target sectors** (brochure): Hospitals, Multi-Specialty Groups, Diagnostic Chains,
   Medical Colleges, Clinics.
9. **Integrations strip** (India-first): ABDM/ABHA, PACS, LIS, HL7/FHIR, Payment Gateway,
   UPI, SMS, WhatsApp, Email, TPA/Insurance APIs, Medical Devices, Analytics Engine.
10. **Security & compliance strip** — terms used in Indian healthcare (NOT HIPAA, which
    is US-only): ABDM & ABHA Ready, DPDP Act 2023 Aligned, NABH-Aligned Workflows,
    Role-Based Access, AES-256 Encryption, 2FA, Audit Logs, Backups & Disaster Recovery.
    Lab workflows: NABL / ISO 15189.
11. **CTA banner** — "Connecting Care. Empowering Life." + Book a Demo.

> **Compliance note:** HIPAA is a US regulation and is not mandated in India, so it is
> deliberately not used anywhere on the site. The HMS and CMS pages lead with the terms
> Indian hospitals and clinics actually use: **ABDM/ABHA, NABH, NABL, DPDP Act 2023, GST,
> UPI, HL7/FHIR**.

> **Page length:** Home, HMS and CMS are each curated to ~12–14 focused sections.
> Relevant healthcare imagery appears on all three pages (Home: 2, HMS: 5, CMS: 2), each
> paired with a glass data-overlay in the reference style.

### 4.2 HMS page (`/products/hms`, alias `/his`) — full deck content

1. **Hero** (deck p.1): "Hospital Management Software (HMS)" — "Transforming Healthcare
   with **Intelligent Hospital Operations**"; badges AI Powered / Secure / Cloud Based;
   CTA Book a Demo; dashboard-style stat mock (OPD 1,243 · IPD 326 · Pharmacy 1,682 ·
   Lab 2,451, Revenue ₹25.4 Cr, Bed occupancy 76%).
2. **Industry challenges** (p.3): 6 challenge chips (Manual Records, Billing Delays, Long
   Waiting Time, Inventory Loss, Poor Communication, Paper-Based Workflow) + 4 stat cards
   (30% operational inefficiency, 25% revenue leakage, 40% patient dissatisfaction,
   50%+ time on manual tasks).
3. **Solution overview** (p.4): 9-module wheel as a grid — Patient Access, Clinical
   Operations, Diagnostics & Pharmacy, Revenue & Reporting, Finance & Billing,
   TPA (Insurance), Ambulance Management, AI & Analytics, Mobile Applications.
4. **Module deep-dives** (tabbed/sectioned, from p.5–38). Each = intro line + feature
   checklist + stat row:
   - **Patient Access** (p.5–8): 13 features (Patient Registration, Appointment
     Scheduling, Queue Management, Patient Portal, Online Registration, Token Management,
     OPD/IPD Registration, Front Office, Patient Search, Emergency Registration,
     Insurance Verification…); workflow Registration → Scheduling → Insurance
     Verification → Check-in → Documentation → Approval; stats 80% faster registration,
     95% appointment accuracy, 60% reduced waiting, 2 min per patient, 14K+ patients.
     Patient Portal list (View Appointments, Medical History, Reports & Documents,
     Prescriptions, Online Payments, Teleconsultation, Health Reminders).
   - **Hospital Operations** (p.9–12): EMR/EHR (Patient Timeline, Clinical Notes, Vitals,
     Lab & Radiology Results, Prescriptions, Allergies & History); IPD, Nursing & Clinical
     (Ward, ICU, Nursing Station, OT, Care Plans, Nursing Assessment, Discharge Summary).
   - **Diagnostics & Pharmacy** (p.13–16): Advanced LIS (Automated Sample Management,
     Instrument Integration, Workflow Automation, Real-Time Analytics, NABL/ISO/CAP
     compliance, EHR Integration); Pharmacy (Medicine Management, Stock Tracking,
     Prescription Analytics, Expiry Alerts — 99% inventory accuracy, 25% cost savings);
     Inventory (Stock/Expiry/Reorder/Vendor/Batch/Asset tracking — 45% accuracy gain,
     30% less expiry loss, ₹2.4M+ savings, 24hr reorder, 98% availability).
   - **Finance & Accounts ERP** (p.17–20): GL, AP, AR, Cash & Bank, GST Management, Cost
     Centers, Financial Statements, Budgeting; benefits row (Accurate & Reliable,
     Efficient Processes, Better Control, Compliance Ready).
   - **HR & Payroll** (p.21–23): Employee Management, Attendance (biometric), Shift
     Management, Leave Management, Payroll Processing (PF/ESI/PT/tax, payslips, bank
     transfer); HR dashboard numbers (325 employees, 96% attendance…).
   - **Procurement & Purchase** (p.24–27): Requisition, RFQ, Vendor Comparison, POs;
     fulfillment chain Request → Approval → RFQ → Vendor Selection → PO → Goods Receipt;
     vendor collaboration stats (300+ vendors, 98% on-time delivery, 24hr approval,
     100% digital records).
   - **Asset Management** (p.28–29): Registration, Calibration, Depreciation, Preventive
     Maintenance, AMC Management; benefits (utilization, less downtime, compliance,
     longer lifespan).
   - **Revenue Cycle & Reporting** (p.30–32): 8-step revenue cycle (Registration,
     Insurance Verification, Charge Capture, Claims Submission, Payment Collection,
     Denial Management, Reconciliation, Reporting); stats ₹25 Cr+ annual billing, 98%
     billing accuracy, 35% denial reduction, 20% faster collections; analytics dashboard
     (Total Revenue ₹25.4 Cr, 98% collection efficiency, ₹12,450 avg transaction, 31% ROI).
   - **AI Features** (p.33–35): AI Chatbot, AI Insights, Predictive Analytics, Treatment
     Reminders, Smart Care Routing, Automated Follow-Up (62% faster response, 70%
     operational efficiency, 92% patient satisfaction); AI in Action (40% faster
     diagnosis, 95% prediction accuracy, 85% engagement, 25% risk reduction, 30% order
     accuracy, 60% time saved) + business impact panel.
   - **Ambulance Management** (p.37): Live GPS, Availability, Driver Details, Emergency
     Dispatch, Trip Management, Alerts — 3.2K+ trips, 97% on-time, 47% fleet utilization.
   - **Patient Mobile App** (p.36, 38): Appointment Booking, Reports & Prescriptions,
     Medical History, Online Payments, Notifications, Chat, E-Prescriptions,
     Consultation Notes.
5. **Integrations** (p.39) and **Security & Compliance** (p.40) sections.
6. **Why choose KIBO360 HMS** (p.41): 10 green-check points.
7. **Future roadmap** (p.42): AI Agents, Predictive Healthcare, Voice EMR, Digital Twins,
   Remote Monitoring, Generative AI, IoT Integration, Smart Hospitals.
8. **CTA banner** + subdomain note (`hms.kibo360.in`).

### 4.3 CMS page (`/products/cms`) — Clinic Management Software

No dedicated PDF exists, so content is **adapted from the HMS material for
clinic/OPD-scale practices** (clearly the same design language):

1. Hero: "Clinic Management Software (CMS)" — "Everything a modern clinic needs — from
   appointment to prescription to payment."
2. Challenges of running a clinic (crowded front desk, no-shows, paper prescriptions,
   manual billing).
3. Core modules: Appointments & Queue/Token, Doctor EMR & e-Prescriptions, Billing &
   GST Invoicing, Pharmacy & Stock, Patient Records & Portal, Teleconsultation,
   WhatsApp/SMS Reminders, Reports & Analytics.
4. Workflow: Book → Check-in → Consult → e-Prescribe → Bill → Follow-up.
5. Stats (drawn from platform numbers): 80% faster registration, 60% less waiting, 92%
   patient satisfaction, 2 min per patient.
6. Why CMS: made for single doctors, polyclinics & chains; grows into full HMS on the
   same KIBO360 platform (shared database — upgrade without migration).
7. Security + integrations strip (shared components), CTA + subdomain `cms.kibo360.in`.

### 4.4 Contact Us (`/contact`)

- Info cards (deck p.43): **Location** Bhutani Cyber Park, Block C, Sector 62,
  Noida – 201309, India · **Call** +91-800 800 5672 · **Email**
  info@livexperttechnologies.com · Website www.kibo360.in.
- **Form** (name, work email, phone, organization, product interest [HMS/CMS/Other],
  message) → `POST /api/contact` → saved to `backend/data/submissions.json`; success and
  error states shown inline.

### 4.5 About Us (`/about`)

- "Where possibilities come together" narrative (deck p.2, full text).
- Mission chips ("Connecting Care. Empowering Life.", "One Platform. Every Business.").
- The 4 strategic pillars matrix (brochure p.2).
- Six value pillars (shared with Home data).
- Target sectors; roadmap teaser; "Powered by Livexpert Technologies" block.

### 4.6 Privacy Policy (`/privacy-policy`)

Standard drafted policy for kibo360.in: data collected (contact-form data, usage data),
purpose, storage, no sale of data, healthcare-data note (product-level DPAs), cookies,
third-party links, security measures, retention, user rights, grievance contact
(info@livexperttechnologies.com, Noida address), governing law (India), update policy.
**Marked as a draft to be reviewed by legal counsel before production.**

### 4.7 Terms & Conditions (`/terms`)

Standard drafted terms: acceptance, definitions, website use, intellectual property
(KIBO360 & Livexpert marks), product subscriptions governed by separate agreements,
acceptable use, disclaimer of warranties, limitation of liability, indemnity,
termination, governing law & jurisdiction (Noida/Delhi NCR, India), contact.
**Marked as a draft to be reviewed by legal counsel before production.**

---

## 5. Backend API spec (port 5001)

| Method | Route            | Body                                                       | Result                          |
|--------|------------------|------------------------------------------------------------|---------------------------------|
| GET    | `/api/health`    | —                                                          | `{ ok: true, service, time }`   |
| POST   | `/api/contact`   | `{ name*, email*, phone, organization, product, message* }`| Validates, appends to JSON file |
| GET    | `/api/submissions`| —                                                         | List saved submissions (dev aid)|

- Validation: name/email/message required, email format checked; 400 with field errors.
- Every submission gets `id`, `receivedAt` (ISO timestamp).
- Future: swap JSON store for DB + email notification (nodemailer) without changing the API.

---

## 6. Subdomain strategy (future, documented now)

- `kibo360.in` / `www.kibo360.in` → this marketing site.
- `hms.kibo360.in` → HMS product application (login).
- `cms.kibo360.in` → CMS product application (login).
- Each new product = new marketing page here (`/products/<slug>`) + new subdomain app.
- Product pages already show a "runs at `<slug>.kibo360.in`" login button, so the pattern
  is visible from day one. DNS: add an A/CNAME record per subdomain pointing at the
  product deployment; the marketing site needs no change.

---

## 7. Content data model

All copy lives in `frontend/src/data/siteData.js` as plain objects (products, modules,
stats, integrations, security, sectors, contact info, legal text). Pages only render
that data — so updating text or adding a product never touches component code.
