import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

/**
 * Wrapper for regulatory pages. Replace ORGANISATION placeholders in each page with your legal entity details.
 */
export function LegalPageShell({ title, lastUpdated, children }) {
  const { user } = useAuth();
  const back = user ? { to: '/dashboard', label: '← Back to app' } : { to: '/login', label: '← Back to login' };
  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-legalDoc">
          <p className="pp-legalDisclaimer">
            The information below is provided to help meet common transparency expectations (including EU GDPR).
            It does <strong>not</strong> constitute legal advice. Have a qualified lawyer review and adapt it for your
            entity, product, and data flows before relying on it.
          </p>
          <Link className="pp-link" to={back.to} style={{ display: 'inline-block', marginBottom: 16 }}>
            {back.label}
          </Link>
          <h1 className="pp-h1" style={{ marginTop: 0 }}>
            {title}
          </h1>
          <p className="pp-subtle" style={{ marginBottom: 24 }}>
            <strong>Last updated:</strong> {lastUpdated}
          </p>
          <div className="pp-legalBody">{children}</div>
        </div>
      </div>
    </div>
  );
}
