import Seo from "../components/Seo.jsx";
import { legalMeta, company } from "../data/siteData.js";

export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <Seo
        title="Privacy Policy"
        description="How KIBO360 and Livexpert Technologies collect, use and protect your information on kibo360.in and its product subdomains."
        path="/privacy-policy"
      />
      <div className="container">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">
          Effective date: {legalMeta.effectiveDate} · Applies to {legalMeta.site} and its subdomains
        </p>
        <p className="legal-draft-note">
          Draft for review — please have this policy reviewed by legal counsel before
          production launch.
        </p>

        <div className="legal-body">
          <p>
            This Privacy Policy describes how {legalMeta.entity} ("we", "us", "our")
            collects, uses and protects information when you visit {legalMeta.site},
            its product subdomains (such as hms.{legalMeta.site} and cms.{legalMeta.site}),
            or contact us about the KIBO360 platform.
          </p>

          <h2>1. Information we collect</h2>
          <ul>
            <li>
              <strong>Contact form data</strong> — name, email address, phone number,
              organization name, product interest and message, submitted voluntarily
              through our contact / demo request forms.
            </li>
            <li>
              <strong>Usage data</strong> — standard technical information such as
              browser type, device, pages visited and approximate location, used to
              improve the website.
            </li>
            <li>
              <strong>Communication records</strong> — emails and calls exchanged with
              our team when you enquire about our products.
            </li>
          </ul>

          <h2>2. How we use your information</h2>
          <ul>
            <li>To respond to enquiries and schedule product demonstrations.</li>
            <li>To send information you requested about KIBO360 products.</li>
            <li>To improve our website, products and services.</li>
            <li>To comply with legal obligations.</li>
          </ul>
          <p>We do not sell or rent your personal information to third parties.</p>

          <h2>3. Healthcare data</h2>
          <p>
            This marketing website does not collect patient or clinical data. Patient
            data processed inside KIBO360 products (HMS, CMS and others) is governed by
            separate product agreements and data processing terms signed with each
            customer organization, and is protected with encryption, role-based access
            control, audit logs and backup/disaster-recovery practices.
          </p>

          <h2>4. Cookies</h2>
          <p>
            The website may use essential cookies and similar technologies to remember
            preferences and understand site usage. You can control cookies through your
            browser settings.
          </p>

          <h2>5. Data storage and security</h2>
          <p>
            Information submitted through this website is stored on secured
            infrastructure with access limited to authorized personnel. We apply
            industry-standard safeguards including encryption in transit, access
            control and periodic backups.
          </p>

          <h2>6. Data retention</h2>
          <p>
            We retain enquiry data only as long as needed to serve your request and for
            reasonable business record-keeping, after which it is deleted or anonymized.
          </p>

          <h2>7. Your rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal
            information at any time by writing to{" "}
            <a href={`mailto:${company.email}`}>{company.email}</a>.
          </p>

          <h2>8. Third-party links</h2>
          <p>
            Our website may link to external sites. We are not responsible for the
            privacy practices of those sites and encourage you to read their policies.
          </p>

          <h2>9. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The latest version
            will always be available on this page with a revised effective date.
          </p>

          <h2>10. Grievance & contact</h2>
          <p>
            For privacy questions or grievances, contact: {legalMeta.entity},{" "}
            {company.address} · <a href={`mailto:${company.email}`}>{company.email}</a> ·{" "}
            {company.phone}. This policy is governed by the laws of India.
          </p>
        </div>
      </div>
    </div>
  );
}
