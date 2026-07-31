import Seo from "../components/Seo.jsx";
import { legalMeta, company } from "../data/siteData.js";

export default function Terms() {
  return (
    <div className="legal-page">
      <Seo
        title="Terms & Conditions"
        description="Terms and conditions for using kibo360.in, the website of the KIBO360 healthcare platform by Livexpert Technologies."
        path="/terms"
      />
      <div className="container">
        <h1>Terms &amp; Conditions</h1>
        <p className="legal-updated">
          Effective date: {legalMeta.effectiveDate} · Applies to {legalMeta.site} and its subdomains
        </p>
        <p className="legal-draft-note">
          Draft for review — please have these terms reviewed by legal counsel before
          production launch.
        </p>

        <div className="legal-body">
          <h2>1. Acceptance of terms</h2>
          <p>
            By accessing {legalMeta.site} (the "Website"), operated by {legalMeta.entity}{" "}
            ("we", "us", "our"), you agree to these Terms &amp; Conditions. If you do
            not agree, please do not use the Website.
          </p>

          <h2>2. About the Website</h2>
          <p>
            The Website provides information about the KIBO360 platform and its
            products, including Hospital Management Software (HMS) and Clinic
            Management Software (CMS). Product applications offered on subdomains
            (e.g., hms.{legalMeta.site}, cms.{legalMeta.site}) are licensed to customer
            organizations under separate subscription and service agreements; those
            agreements govern product use, not these Website terms.
          </p>

          <h2>3. Intellectual property</h2>
          <p>
            KIBO360, the KIBO360 logo, "One Platform. Every Business." and all content
            on this Website — text, graphics, designs, product descriptions and
            software — are the property of {legalMeta.entity} or its licensors and are
            protected by applicable intellectual-property laws. You may not reproduce,
            modify or distribute Website content without prior written consent.
          </p>

          <h2>4. Acceptable use</h2>
          <ul>
            <li>Do not misuse the Website, attempt unauthorized access, or disrupt its operation.</li>
            <li>Do not use the Website to transmit unlawful, harmful or misleading material.</li>
            <li>Do not scrape, copy or republish content for commercial purposes without consent.</li>
          </ul>

          <h2>5. Information accuracy</h2>
          <p>
            Product statistics, features and screenshots shown on the Website are
            illustrative and may vary by deployment, configuration and version. We may
            change, update or discontinue any content or feature at any time without
            notice.
          </p>

          <h2>6. Enquiries and demo requests</h2>
          <p>
            Submitting an enquiry does not create any contractual relationship.
            Commercial terms for any KIBO360 product are established only through a
            signed agreement between {legalMeta.entity} and the customer organization.
          </p>

          <h2>7. Disclaimer of warranties</h2>
          <p>
            The Website is provided on an "as is" and "as available" basis without
            warranties of any kind, express or implied, including fitness for a
            particular purpose or uninterrupted availability.
          </p>

          <h2>8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, {legalMeta.entity} shall not be
            liable for any indirect, incidental or consequential damages arising from
            the use of, or inability to use, this Website.
          </p>

          <h2>9. Indemnity</h2>
          <p>
            You agree to indemnify {legalMeta.entity} against claims arising from your
            breach of these terms or misuse of the Website.
          </p>

          <h2>10. Termination</h2>
          <p>
            We may restrict or terminate access to the Website for conduct that
            violates these terms or applicable law.
          </p>

          <h2>11. Governing law and jurisdiction</h2>
          <p>
            These terms are governed by the laws of India. Courts at Gautam Buddha
            Nagar (Noida), Uttar Pradesh shall have exclusive jurisdiction over any
            disputes.
          </p>

          <h2>12. Contact</h2>
          <p>
            {legalMeta.entity}, {company.address} ·{" "}
            <a href={`mailto:${company.email}`}>{company.email}</a> · {company.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
