import Seo from "../components/Seo.jsx";
import { legalMeta, company } from "../data/siteData.js";

// Page copy comes verbatim from "Terms of Use.docx"
export default function Terms() {
  return (
    <div className="legal-page">
      <Seo
        title="Terms of Use"
        description="Terms of Use governing access to the Kibo360 website, software, applications, and related services provided by Livexpert Technologies."
        path="/terms"
      />
      <div className="container">
        <h1>Terms of Use</h1>
        <p className="legal-updated">Last updated: {legalMeta.effectiveDate}</p>

        <div className="legal-body">
          <p>
            These Terms of Use govern your access to and use of the Kibo360 website,
            software, applications, and related services provided by Livexpert
            Technologies.
          </p>
          <p>
            By accessing or using Kibo360, you agree to these Terms. If you are using
            Kibo360 on behalf of an organisation, you confirm that you have the
            authority to accept these Terms on its behalf.
          </p>

          <h2>1. Our Services</h2>
          <p>
            Kibo360 provides business and specialised software solutions, which may
            include hospital management, laboratory management, customer relationship
            management, enterprise resource planning, content management, inventory
            management, and other solutions.
          </p>
          <p>
            The features, pricing, usage terms, support, and other conditions may vary
            by product and will be set out in the applicable agreement, quotation,
            subscription, or order form.
          </p>

          <h2>2. Your Account</h2>
          <p>
            You are responsible for providing accurate information and keeping your
            account credentials secure.
          </p>
          <p>
            You are also responsible for activity carried out through your account and
            must notify us if you suspect unauthorised access.
          </p>

          <h2>3. Acceptable Use</h2>
          <p>You agree to use Kibo360 only for lawful purposes.</p>
          <p>You must not:</p>
          <ul>
            <li>Access or attempt to access systems or accounts without authorisation</li>
            <li>Misuse, disrupt, or damage the services</li>
            <li>Upload malicious code or harmful content</li>
            <li>Copy, modify, reverse engineer, or redistribute the software without permission</li>
            <li>Use the services to violate applicable laws or another person's rights</li>
            <li>Circumvent security or access controls</li>
          </ul>
          <p>
            We may suspend or restrict access if we reasonably believe these Terms
            have been violated or continued use creates a security or legal risk.
          </p>

          <h2>4. Customer Data</h2>
          <p>
            You retain ownership of the data you provide through Kibo360. You are
            responsible for ensuring that you have the necessary rights and
            permissions to collect, use, and provide that data to Kibo360.
          </p>
          <p>
            We process customer data only as necessary to provide and support the
            applicable services and in accordance with our Privacy Policy and
            applicable agreements.
          </p>
          <p>
            For healthcare or other sensitive information, customers remain
            responsible for complying with applicable laws and obtaining any required
            permissions or consent.
          </p>

          <h2>5. Fees and Payments</h2>
          <p>
            Paid services are subject to the pricing, billing, renewal, cancellation,
            and payment terms agreed with you.
          </p>
          <p>
            Failure to make required payments may result in suspension or termination
            of the applicable service.
          </p>

          <h2>6. Intellectual Property</h2>
          <p>
            Kibo360 and its licensors own all rights to the Kibo360 software, website,
            technology, designs, content, trademarks, and branding.
          </p>
          <p>
            Your use of Kibo360 does not transfer ownership of any Kibo360
            intellectual property to you.
          </p>

          <h2>7. Service Availability</h2>
          <p>
            We aim to keep Kibo360 reliable and available, but we do not guarantee
            uninterrupted or error-free service.
          </p>
          <p>
            We may update, modify, or discontinue features from time to time as our
            products evolve.
          </p>

          <h2>8. Suspension and Termination</h2>
          <p>
            We may suspend or terminate access if you materially breach these Terms,
            fail to make required payments, create a security or legal risk, or where
            required by law.
          </p>
          <p>
            After termination, access to the applicable services will end in
            accordance with the relevant agreement and applicable data retention or
            deletion requirements.
          </p>

          <h2>9. Disclaimer and Liability</h2>
          <p>
            Kibo360 is provided on an &ldquo;as available&rdquo; basis to the extent
            permitted by law.
          </p>
          <p>
            We do not guarantee that the services will always meet every specific
            requirement or operate without interruption or errors.
          </p>
          <p>
            To the extent permitted by law, Kibo360 will not be liable for indirect or
            consequential losses arising from your use of or inability to use the
            services.
          </p>
          <p>Nothing in these Terms limits liability that cannot legally be limited.</p>

          <h2>10. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. The updated version will be
            published on this page with a revised &ldquo;Last Updated&rdquo; date.
          </p>
          <p>
            Your continued use of Kibo360 after the updated Terms take effect means
            you accept the revised Terms, where permitted by law.
          </p>

          <h2>11. Contact Us</h2>
          <p>For questions about these Terms, contact us at:</p>
          <p>
            {legalMeta.entity}, {company.address} ·{" "}
            <a href={`mailto:${company.email}`}>{company.email}</a> · {company.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
