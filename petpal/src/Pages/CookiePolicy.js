import React from 'react';
import { Link } from 'react-router-dom';
import { LegalPageShell } from '../components/LegalPageShell';

export default function CookiePolicy() {
  return (
    <LegalPageShell title="Cookie policy" lastUpdated={new Date().toISOString().slice(0, 10)}>
      <section>
        <h2>1. What are cookies and similar technologies?</h2>
        <p>
          “Cookies” are small text files placed on your device. We also use similar technologies (e.g. local storage,
          session storage, pixels) for the same purposes. Together we refer to them as “<strong>cookies</strong>”
          in this policy.
        </p>
      </section>

      <section>
        <h2>2. Why we use them</h2>
        <p>We use cookies to:</p>
        <ul>
          <li>
            <strong>Strictly necessary:</strong> e.g. keep you signed in, maintain security, load the application.
          </li>
          <li>
            <strong>Functional / preferences:</strong> remember settings where we implement them.
          </li>
          <li>
            <strong>Analytics / performance:</strong> understand how the Service is used in aggregate, if you consent
            where required (e.g. Google Analytics, if enabled).
          </li>
        </ul>
        <p>We will not use non-essential cookies (or read/write to non-essential local storage) without consent where EU law requires it.</p>
      </section>

      <section>
        <h2>3. Types of cookies we may use</h2>
        <table className="pp-legalTable">
          <thead>
            <tr>
              <th>Name / category</th>
              <th>Purpose</th>
              <th>Duration / notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Session / auth (necessary)</td>
              <td>Maintain your authenticated session (often via the authentication provider).</td>
              <td>Session or as set by the provider; see our Privacy policy and Firebase documentation.</td>
            </tr>
            <tr>
              <td>localStorage / app storage (necessary / functional)</td>
              <td>Store app preferences and offline-first data for your account on this device.</td>
              <td>Until cleared by you or the app; may contain pet/game/community drafts.</td>
            </tr>
            <tr>
              <td>Analytics (optional)</td>
              <td>If enabled, to measure traffic and app usage.</td>
              <td>As per provider; typically requires consent in the EEA/UK where not strictly necessary.</td>
            </tr>
          </tbody>
        </table>
        <p className="pp-subtle" style={{ marginTop: 12 }}>
          We will list specific cookie names, providers, and retention in a data map as the Service matures. Third-party
          providers maintain their own documentation (e.g. Google/Firebase).
        </p>
      </section>

      <section>
        <h2>4. Legal basis and consent (GDPR / ePrivacy)</h2>
        <p>
          Strictly necessary cookies and similar storage required to deliver a service you request may rely on our
          legitimate interest or the performance of a contract, depending on context. For analytics, marketing, or
          other non-essential storage, we will request your consent where required before activation.
        </p>
      </section>

      <section>
        <h2>5. How to control cookies</h2>
        <p>
          You can set your browser to refuse cookies or delete them. This may break login or other features. You can
          also clear “site data” for our origin in your browser. Where we provide a cookie banner or settings panel, use
          it to withdraw consent for non-essential categories at any time.
        </p>
      </section>

      <section>
        <h2>6. Further information</h2>
        <p>
          For more on how we use personal data, see our{' '}
          <Link to="/privacy" className="pp-link" style={{ display: 'inline', padding: 0 }}>
            Privacy policy
          </Link>
          . For rights and the Cyprus supervisory authority, see the same document.
        </p>
      </section>
    </LegalPageShell>
  );
}
