import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { useI18n } from '../i18n/I18nContext';

function humanFirebaseError(err, t) {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') return t('auth.errors.emailInUse');
  if (code === 'auth/invalid-email') return t('auth.errors.invalidEmail');
  if (code === 'auth/weak-password') return t('auth.errors.weakPassword');
  return err?.message || t('auth.errors.registerGeneric');
}

export default function Register() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [accountType, setAccountType] = useState(/** @type {'individual' | 'company'} */ ('individual'));
  const [businessName, setBusinessName] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!acceptedTerms) {
      setError(t('register.termsError'));
      return;
    }
    if (accountType === 'company' && !businessName.trim()) {
      setError(t('register.businessNameError'));
      return;
    }
    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const name = accountType === 'company' ? businessName.trim() : displayName.trim();
      if (name) await updateProfile(cred.user, { displayName: name });
      if (accountType === 'company') {
        navigate('/company/apply', { replace: true, state: { businessName: businessName.trim() } });
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(humanFirebaseError(err, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad" style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="pp-badge">PetPal</div>
          <h1 className="pp-h1" style={{ marginTop: 10 }}>
            {t('register.title')}
          </h1>
          <p className="pp-subtle" style={{ marginBottom: 14 }}>
            {t('register.subtitle')}
          </p>

          <form className="pp-form" onSubmit={onSubmit}>
            <div>
              <div className="pp-label">{t('register.accountType')}</div>
              <div className="pp-community-walkStyle" style={{ marginTop: 6 }} role="group" aria-label={t('register.accountType')}>
                <label>
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'individual'}
                    onChange={() => setAccountType('individual')}
                  />
                  {t('register.accountOwner')}
                </label>
                <label>
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'company'}
                    onChange={() => setAccountType('company')}
                  />
                  {t('register.accountBusiness')}
                </label>
              </div>
              <p className="pp-subtle" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                {t('register.businessHint')}
              </p>
            </div>
            {accountType === 'individual' ? (
              <div>
                <div className="pp-label">{t('register.nameOptional')}</div>
                <input
                  className="pp-input"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Sotiris"
                />
              </div>
            ) : (
              <div>
                <div className="pp-label">{t('register.businessName')}</div>
                <input
                  className="pp-input"
                  autoComplete="organization"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Riverside Dog Daycare"
                />
              </div>
            )}
            <div>
              <div className="pp-label">{t('register.email')}</div>
              <input
                className="pp-input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="pp-label">{t('register.password')}</div>
              <input
                className="pp-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('register.passwordPh')}
              />
            </div>

            {error ? <div className="pp-error">{error}</div> : null}

            <label className="pp-legalCheck">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                aria-describedby="register-legal-desc"
              />
              <span id="register-legal-desc">
                {t('register.readTerms')}{' '}
                <Link to="/terms" className="pp-link" style={{ display: 'inline', padding: 0 }} target="_blank" rel="noopener noreferrer">
                  {t('register.terms')}
                </Link>{' '}
                {t('register.and')}{' '}
                <Link to="/privacy" className="pp-link" style={{ display: 'inline', padding: 0 }} target="_blank" rel="noopener noreferrer">
                  {t('register.privacy')}
                </Link>
                .
              </span>
            </label>

            <div className="pp-row" style={{ justifyContent: 'space-between' }}>
              <button className="pp-btn pp-btnPrimary" disabled={submitting || !acceptedTerms}>
                {submitting ? t('register.creating') : t('register.createAccount')}
              </button>
              <Link className="pp-link" to="/login">
                {t('register.backToLogin')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

