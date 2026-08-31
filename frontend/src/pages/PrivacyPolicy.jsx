import Seo from "../components/Seo.jsx";
import { legalMeta, company } from "../data/siteData.js";

// Page copy comes verbatim from "Privacy Policy.docx"
export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <Seo
        title="Privacy Policy"
        description="How Kibo360 and Livexpert Technologies collect, use and protect your information on kibo360.in and its products and services."
        path="/privacy-policy"
      />
      <div className="container">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: {legalMeta.effectiveDate}</p>

        <div className="legal-body">
          <p>
            At Kibo360, we take your privacy seriously. This Privacy Policy explains
            what information we collect, why we collect it, how we use it, and how we
            protect it when you visit our website or use our products and services.
          </p>
          <p>
            Kibo360 is operated by Livexpert Technologies. By using our website,
            submitting an enquiry, creating an account, or using our services, you
            agree to the practices described in this Privacy Policy.
          </p>

          <h2>1. Information We Collect</h2>
          <p>Depending on how you use Kibo360, we may collect the following types of information.</p>
          <p><strong>Information You Provide</strong></p>
          <p>
            When you contact us, request a demo, create an account, subscribe to a
            service, or interact with us in other ways, you may provide information
            such as:
          </p>
          <ul>
            <li>Name</li>
            <li>Organisation or business name</li>
            <li>Job title or role</li>
            <li>Email address</li>
            <li>Phone number</li>
            <li>Business address</li>
            <li>Account and login details</li>
            <li>Information submitted through enquiry or demo forms</li>
            <li>Any other information you choose to provide</li>
          </ul>
          <p><strong>Information We Collect Automatically</strong></p>
          <p>
            When you visit our website or use our services, we may automatically
            collect information such as:
          </p>
          <ul>
            <li>IP address</li>
            <li>Browser and device details</li>
            <li>Operating system</li>
            <li>Pages you visit</li>
            <li>Date and time of access</li>
            <li>Website or source that referred you to us</li>
            <li>How you use and interact with our website or services</li>
            <li>Technical and diagnostic information</li>
          </ul>
          <p><strong>Cookies and Similar Technologies</strong></p>
          <p>
            We may use cookies and similar technologies to make our website work
            properly, remember your preferences, understand how people use our
            website, and improve our services.
          </p>
          <p>
            You can manage or disable cookies through your browser settings. Please
            note that some parts of our website may not work properly if certain
            cookies are disabled.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>We may use the information we collect to:</p>
          <ul>
            <li>Provide, operate, and maintain our website and services</li>
            <li>Respond to your questions and requests</li>
            <li>Schedule and provide product demos</li>
            <li>Create and manage user accounts</li>
            <li>Provide customer and technical support</li>
            <li>Process transactions and manage subscriptions</li>
            <li>Improve our products, services, and user experience</li>
            <li>Contact you about our products, services, updates, or support</li>
            <li>Identify and prevent security issues, fraud, or misuse</li>
            <li>Meet our legal and regulatory obligations</li>
            <li>Protect our rights, users, systems, and property</li>
          </ul>
          <p>
            We use personal information only for appropriate and lawful purposes and
            as permitted by applicable law.
          </p>

          <h2>3. Healthcare and Business Data</h2>
          <p>
            Some Kibo360 products may be used by hospitals, laboratories, businesses,
            and other organisations to manage sensitive business or healthcare-related
            information.
          </p>
          <p>
            If a customer uses Kibo360 to process information about its customers,
            patients, employees, or other individuals, that customer is responsible
            for making sure it has the necessary permission and legal basis to provide
            that information to Kibo360.
          </p>
          <p>
            Kibo360 processes this information as needed to provide the agreed
            services and in line with the applicable agreement, customer instructions,
            and law.
          </p>

          <h2>4. How We Share Information</h2>
          <p>We do not sell your personal information.</p>
          <p>
            We may share information when necessary to provide and operate our
            services, including with:
          </p>
          <ul>
            <li>Service providers and technology partners that support our services</li>
            <li>Hosting, infrastructure, security, analytics, communication, payment, and support providers</li>
            <li>Professional advisers when reasonably necessary</li>
            <li>Government authorities or regulators when required by law</li>
            <li>Other parties when you have given us appropriate permission or asked us to share the information</li>
          </ul>
          <p>
            When third parties process information on our behalf, we take reasonable
            steps to make sure they handle it appropriately and protect it from
            unauthorised use or disclosure.
          </p>

          <h2>5. Data Security</h2>
          <p>
            We use reasonable technical and organisational measures to protect your
            information from unauthorised access, use, alteration, disclosure, or
            loss.
          </p>
          <p>
            The security measures we use may vary depending on the service and type of
            information involved.
          </p>
          <p>
            While we work to protect your information, no method of storing or
            transmitting information is completely secure. For this reason, we cannot
            guarantee absolute security.
          </p>

          <h2>6. Data Retention</h2>
          <p>
            We keep personal information for as long as reasonably necessary to
            provide our services, fulfil the purposes for which it was collected, meet
            our legal and contractual obligations, resolve disputes, and enforce our
            agreements.
          </p>
          <p>
            How long we keep information depends on the type of information and the
            service involved.
          </p>
          <p>
            For customer data, retention and deletion may also be covered by the
            applicable customer agreement.
          </p>

          <h2>7. Your Rights and Choices</h2>
          <p>Depending on the laws that apply to you, you may have the right to:</p>
          <ul>
            <li>Ask for a copy of the personal information we hold about you</li>
            <li>Ask us to correct inaccurate information</li>
            <li>Ask us to delete your information where permitted by law</li>
            <li>Withdraw your consent where we rely on consent to process your information</li>
            <li>Ask how your personal information is being used</li>
            <li>Raise a complaint about how we handle your information</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us using the details
            below. We may need to verify your identity before processing your request.
          </p>
          <p>Some requests may be limited by applicable laws, contracts, or other requirements.</p>

          <h2>8. Communications</h2>
          <p>
            If you contact us, request a demo, or provide your contact details, we may
            use that information to respond to you and share relevant information
            about our services.
          </p>
          <p>
            Where required by law, we will ask for your consent before sending
            marketing communications.
          </p>
          <p>
            You can stop receiving promotional communications at any time by using the
            unsubscribe option in the message or by contacting us.
          </p>

          <h2>9. Third-Party Links</h2>
          <p>Our website may include links to third-party websites, applications, or services.</p>
          <p>
            We are not responsible for how these third parties collect, use, or
            protect your information. We recommend reading their privacy policies
            before providing them with personal information.
          </p>

          <h2>10. Children's Privacy</h2>
          <p>
            Our website and business services are intended for businesses and
            professional users and are not directed at children.
          </p>
          <p>
            We do not knowingly collect personal information from children, except
            where permitted and necessary under applicable law.
          </p>

          <h2>11. International Data Transfers</h2>
          <p>
            Depending on the services you use and where our service providers are
            located, your information may be stored or processed outside your state or
            country.
          </p>
          <p>
            Where required by law, we take appropriate steps to protect your
            information when it is transferred across borders.
          </p>

          <h2>12. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes to
            our services, technology, legal requirements, or privacy practices.
          </p>
          <p>
            When we make changes, we will update the &ldquo;Last Updated&rdquo; date
            on this page. Where required by law, we will also provide additional
            notice.
          </p>
          <p>We recommend checking this page from time to time for the latest version.</p>

          <h2>13. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or want to exercise your
            privacy rights, please contact us using the contact details below.
          </p>
          <p>
            {legalMeta.entity}, {company.address} ·{" "}
            <a href={`mailto:${company.email}`}>{company.email}</a> · {company.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
