import React from 'react';
import { LegalPageShell } from '../components/LegalPageShell';
import { BRAND } from '../config/brand';

export default function PrivacyPolicy() {
  return (
    <LegalPageShell title="Privacy policy" lastUpdated={new Date().toISOString().slice(0, 10)}>
      <section>
        <h2>1. Who we are</h2>
        <p>
          <strong>Data controller:</strong> {BRAND.legalName}, registered in the Republic of Cyprus, with registered
          address at {BRAND.address} (“<strong>we</strong>”, “<strong>us</strong>”, “<strong>our</strong>”).
        </p>
        <p>
          <strong>Contact (general):</strong>{' '}
          <a href={`mailto:${BRAND.contactEmail}`} className="pp-link">
            {BRAND.contactEmail}
          </a>
          <br />
          <strong>Contact (data protection / privacy):</strong>{' '}
          <a href={`mailto:${BRAND.privacyEmail}`} className="pp-link">
            {BRAND.privacyEmail}
          </a>
        </p>
      </section>

      <section>
        <h2>2. Scope</h2>
        <p>
          This policy describes how we process personal data in connection with the PetPal Care Hub web application and
          related services (the “<strong>Service</strong>”). It applies to users in the European Economic Area (EEA) and,
          where the UK GDPR applies, to users in the United Kingdom, in each case in addition to any local law that
          applies to you.
        </p>
      </section>

      <section>
        <h2>3. What personal data we process</h2>
        <p>Depending on how you use the Service, we may process:</p>
        <ul>
          <li>
            <strong>Account and identity:</strong> email address, display name, authentication identifiers (e.g. user
            ID from our authentication provider), password hash (held by the authentication provider, not in plain
            text).
          </li>
          <li>
            <strong>Pet and activity data you enter:</strong> pet names, categories, optional device/tracker
            identifiers you associate with a pet, walk distances or logs you record, optional photos you attach to a
            walk log, and content you post in community features.
          </li>
          <li>
            <strong>Bookings:</strong> appointment details you create or receive (e.g. provider/store, service, pet,
            time, and status) and related communications (e.g. confirmation emails and calendar invitations).
          </li>
          <li>
            <strong>Shop and subscriptions:</strong> purchases, subscription status (monthly/yearly), renewal and
            cancellation events, delivery/shipping details for physical items (e.g. GPS trackers or NFC tags), and
            customer support messages about orders.
          </li>
          <li>
            <strong>Technical and usage data:</strong> IP address, device/browser type, approximate location derived
            from IP if available, timestamps, and diagnostic or security logs, including via hosting and service
            providers. If we enable optional analytics, we will ask for consent where required before loading it.
          </li>
          <li>
            <strong>Maps / places:</strong> if you use location-based features, we may process queries (e.g. map centre
            or place search) and results through third-party APIs (e.g. Google) under their terms and privacy policies.
          </li>
          <li>
            <strong>Public leaderboard (opt-in):</strong> if you choose to share, we may process your display name and
            aggregated walk statistics you explicitly publish to a public leaderboard.
          </li>
        </ul>
        <p>We do not ask you to provide special categories of data (e.g. health) as a condition of use.</p>
      </section>

      <section>
        <h2>4. Purposes and legal bases (GDPR Articles 6 &amp; 9)</h2>
        <p>We process personal data on the following legal bases, as applicable:</p>
        <ul>
          <li>
            <strong>Performance of a contract (Art. 6(1)(b)):</strong> to provide, operate, and support the Service,
            including authentication, security, and features you request.
          </li>
          <li>
            <strong>Legitimate interests (Art. 6(1)(f)):</strong> to secure the Service, prevent abuse, improve
            performance, analyse aggregated usage, and communicate service-related messages; where required, we balance
            these interests with your rights.
          </li>
          <li>
            <strong>Consent (Art. 6(1)(a)):</strong> for optional features such as non-essential cookies / similar
            technologies, marketing communications where required, and any optional public sharing (e.g. leaderboard);
            you may withdraw consent at any time without affecting the lawfulness of processing before withdrawal.
          </li>
          <li>
            <strong>Legal obligation (Art. 6(1)(c)):</strong> to comply with applicable law, or respond to lawful
            requests from public authorities.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Recipients and processors</h2>
        <p>We use trusted service providers who process data on our instructions, including (non-exhaustive):</p>
        <ul>
          <li>
            <strong>Google Firebase / Google Cloud (Google Ireland Limited / Google LLC):</strong> authentication,
            database, and related infrastructure, potentially including analytics if enabled.
          </li>
          <li>
            <strong>JCC Payment Systems Ltd:</strong> payment processing for shop purchases and subscriptions. Payment
            details are entered on JCC’s hosted checkout pages; we do not receive your full card number.
          </li>
          <li>
            <strong>Maps, geocoding, or Places providers</strong> (e.g. Google Maps Platform) where such features are
            used.
          </li>
          <li>
            <strong>Hosting, email, and error monitoring</strong> providers used to operate the Service.
          </li>
        </ul>
        <p>
          We enter into data processing terms (including Standard Contractual Clauses where required) with providers
          that transfer or access personal data from outside the EEA, in line with EU requirements.
        </p>
      </section>

      <section>
        <h2>6. Payments (JCC) and subscriptions</h2>
        <p>
          When you purchase items or subscriptions in the PetPal Care Hub shop, your card payment is processed by{' '}
          <strong>JCC Payment Systems Ltd</strong>. PetPal Care Hub does not store your full card number.
        </p>
        <p>
          We may receive and store limited payment-related information needed to operate the shop and subscriptions,
          such as the status of a payment (successful/failed), order reference, subscription status (active/cancelled),
          and whether a saved payment token exists for renewals. Where required, we use this information to provide
          customer support, process cancellations, and comply with accounting and tax obligations.
        </p>
      </section>

      <section>
        <h2>7. International transfers</h2>
        <p>
          Data may be processed in the EEA and, where a provider is located in a country not subject to an EU adequacy
          decision, we rely on appropriate safeguards (such as the EU Commission-approved Standard Contractual Clauses)
          and supplementary measures where needed.
        </p>
      </section>

      <section>
        <h2>8. Retention</h2>
        <p>We keep personal data only as long as necessary for the purposes above, including:</p>
        <ul>
          <li>
            <strong>Account data:</strong> for the life of your account, unless a longer period is required by law.
          </li>
          <li>
            <strong>Bookings:</strong> to manage your appointments and provide history, and as needed for customer
            support and dispute handling.
          </li>
          <li>
            <strong>Orders and billing records:</strong> as required for accounting, tax, and legal compliance.
          </li>
          <li>
            <strong>Security logs:</strong> typically a limited period unless needed for an investigation.
          </li>
          <li>
            <strong>Local device storage:</strong> some information may be stored in your browser; clearing site data
            may remove it from your device.
          </li>
        </ul>
        <p>
          Where possible, we minimise data and delete or anonymise it when it is no longer needed for the purposes above.
        </p>
      </section>

      <section>
        <h2>9. Your rights</h2>
        <p>Subject to applicable law, you may have the right to:</p>
        <ul>
          <li>Request access to your personal data and certain information about processing (Art. 15 GDPR).</li>
          <li>Request rectification of inaccurate data (Art. 16).</li>
          <li>Request erasure (“right to be forgotten”) in certain cases (Art. 17).</li>
          <li>Request restriction of processing in certain cases (Art. 18).</li>
          <li>Data portability, where processing is based on contract or consent and is automated (Art. 20).</li>
          <li>Object to processing based on legitimate interests (Art. 21).</li>
          <li>Withdraw consent at any time, where we rely on consent (Art. 7(3)).</li>
          <li>
            Lodge a complaint with a supervisory authority — in Cyprus, the{' '}
            <a
              href="https://www.dataprotection.gov.cy/"
              target="_blank"
              rel="noopener noreferrer"
              className="pp-link"
              style={{ display: 'inline', padding: 0 }}
            >
              Office of the Commissioner for Personal Data Protection
            </a>
            .
          </li>
        </ul>
        <p>
          To exercise your rights, contact us at the privacy email above. We may need to verify your identity. You will
          not have to pay a fee unless your request is manifestly unfounded or excessive; if so, we may charge a
          reasonable fee or refuse the request, as permitted by law.
        </p>
      </section>

      <section>
        <h2>10. Security</h2>
        <p>
          We implement appropriate technical and organisational measures appropriate to the risk, including
          industry-standard transport encryption where applicable, access control principles, and reliance on
          established cloud providers. No method of transmission or storage is 100% secure.
        </p>
      </section>

      <section>
        <h2>11. Children</h2>
        <p>
          The Service is not directed at children under the age at which they may provide consent for information society
          services under local law (often 16 in the EU, with Member State variations; Cyprus implements conditions under
          national law). We do not knowingly process personal data of children below that age without parental authority
          as required. If you believe we have, please contact us and we will take appropriate steps.
        </p>
      </section>

      <section>
        <h2>12. Changes</h2>
        <p>
          We may update this policy. We will post the new version with an updated “Last updated” date and, where
          required, provide a more prominent notice (e.g. in-app or by email) for material changes.
        </p>
      </section>
    </LegalPageShell>
  );
}
