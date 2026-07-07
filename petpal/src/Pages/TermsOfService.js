import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPageShell } from '../components/LegalPageShell';
import { BRAND } from '../config/brand';

export default function TermsOfService() {
  return (
    <LegalPageShell title="Terms of service" lastUpdated={new Date().toISOString().slice(0, 10)}>
      <section>
        <h2>1. Agreement</h2>
        <p>
          These Terms of Service (“<strong>Terms</strong>”) govern your access to and use of the PetPal web application
          and related services (the “<strong>Service</strong>”) operated by {BRAND.legalName}, {BRAND.address}
          (“<strong>we</strong>”, “<strong>us</strong>”). By creating an account or using the Service, you agree to
          these Terms and our{' '}
          <Link to="/privacy" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            Privacy policy
          </Link>{' '}
          and{' '}
          <Link to="/cookies" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            Cookie policy
          </Link>
          .
        </p>
        <p>
          If you do not agree, do not use the Service. We may modify these Terms; the “Last updated” date above will
          change, and continued use after changes constitutes acceptance where permitted by law.
        </p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          You must be able to enter into a binding contract under the laws of Cyprus (or your country of residence) and
          meet any minimum age required for consent to online services in your jurisdiction. You are responsible for the
          accuracy of information you provide.
        </p>
      </section>

      <section>
        <h2>3. Accounts and security</h2>
        <p>
          You are responsible for safeguarding your credentials and for activity under your account. Notify us promptly
          at{' '}
          <a href={`mailto:${BRAND.contactEmail}`} className="pp-link" style={{ display: 'inline', padding: 0 }}>
            {BRAND.contactEmail}
          </a>{' '}
          if you suspect unauthorised access. We may suspend or terminate accounts that violate these Terms or pose a
          security risk.
        </p>
      </section>

      <section>
        <h2>4. Licence to use the Service</h2>
        <p>
          We grant you a personal, non-exclusive, non-transferable, revocable licence to use the Service for your own
          non-commercial pet-care and related purposes, subject to these Terms. You may not reverse engineer, scrape
          (except as allowed by applicable law), resell, or misuse the Service or our infrastructure.
        </p>
      </section>

      <section>
        <h2>5. User content and conduct</h2>
        <p>
          You retain rights to content you submit, but you grant us a worldwide, non-exclusive licence to host, store,
          process, and display such content solely to operate and improve the Service. You must not upload unlawful,
          harmful, harassing, infringing, or misleading content. We may remove content or restrict features to comply
          with law or protect users.
        </p>
      </section>

      <section>
        <h2>6. Third-party services</h2>
        <p>
          The Service may integrate third parties (e.g. authentication, maps, hosting). Your use may be subject to their
          terms and privacy policies. We are not responsible for third-party services we do not control.
        </p>
      </section>

      <section>
        <h2>7. Location, maps, and tracking</h2>
        <p>
          Map and place information may be provided by third parties and may be incomplete or change over time. Any live
          tracking or device features are provided for convenience only. You remain responsible for your pet’s safety
          and compliance with local rules. <strong>We do not provide veterinary, legal, or emergency services.</strong>
        </p>
      </section>

      <section id="shop-payments">
        <h2>8. Shop, payments, and subscriptions</h2>
        <p>
          Card payments for the PetPal shop are processed securely by the <strong>JCC payment gateway</strong> (3-D
          Secure where supported). Please review the following before you complete a purchase.
        </p>
        <p>
          Your card details are entered on JCC’s hosted payment page — PetPal does not store your full card number.
        </p>
        <p>
          Subscription plans renew automatically on the billing cycle (monthly or yearly) until you cancel from{' '}
          <Link to="/shop" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            Shop → Your subscriptions
          </Link>
          . If you chose “Save card until cancelled”, your card is tokenised by JCC for renewals only.
        </p>
        <p>
          GPS trackers and NFC tags are shipped to the delivery address you provide at checkout after payment.
          Fulfilment typically takes a few business days.
        </p>
        <p>
          You can request subscription cancellation in the shop at any time. After cancellation, billing stops and
          tracker SIM service is disabled as described in your plan.
        </p>
        <p>
          If you are an EU/EEA consumer, you have statutory rights for distance contracts, including pre-contractual
          information and withdrawal where applicable. See the sections below on governing law and contact for
          complaints, refunds, and the European Commission ODR platform.
        </p>
        <p>
          Pricing, billing intervals, and any promotional first-year or renewal rates are shown at the point of purchase
          in the shop and on your order confirmation.
        </p>
      </section>

      <section>
        <h2>9. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” TO THE MAXIMUM EXTENT PERMITTED BY LAW. WE DISCLAIM ALL
          WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. We do not warrant that the Service will be uninterrupted, error-free, or free of harmful
          components.
        </p>
      </section>

      <section>
        <h2>10. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by applicable law (including mandatory consumer rights in the EU/EEA that
          cannot be waived), we are not liable for any indirect, incidental, special, consequential, or punitive
          damages, or any loss of profits, data, or goodwill, arising from your use of the Service. Our total liability
          for any claim relating to the Service is limited to the greater of (a) the amounts you paid us for the
          Service in the [twelve] months before the event giving rise to liability, or (b) [€50] if you have not paid
          us, unless a stricter limit applies under law.
        </p>
        <p>Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or other
        liability that cannot be excluded under law.</p>
      </section>

      <section>
        <h2>11. Indemnity</h2>
        <p>
          You will defend and indemnify us against third-party claims and liabilities arising from your content, your
          violation of these Terms, or your violation of law, subject to the limitations above and applicable
          defences.
        </p>
      </section>

      <section>
        <h2>12. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of the Republic of Cyprus, without regard to conflict-of-law rules. If
          you are a consumer in the EEA, you also benefit from any mandatory rules of the country where you live.
          Disputes may be brought before the courts of Cyprus, or where you are a consumer, you may also have the
          right to bring proceedings in your country of residence. The European Commission provides an ODR platform for
          out-of-court resolution:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            className="pp-link"
            style={{ display: 'inline', padding: 0 }}
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          ; participation in ODR is voluntary for businesses unless required by law.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>
          Questions:{' '}
          <a href={`mailto:${BRAND.contactEmail}`} className="pp-link" style={{ display: 'inline', padding: 0 }}>
            {BRAND.contactEmail}
          </a>
          . For data protection, see the Privacy policy.
        </p>
      </section>
    </LegalPageShell>
  );
}
