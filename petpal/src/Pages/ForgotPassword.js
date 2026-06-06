import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { mapAuthError, normalizeEmail, trackAuthEvent } from '../auth/authUtils';
import { useI18n } from '../i18n/I18nContext';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const normalizedEmail = normalizeEmail(email);
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting || !emailIsValid) return;
    setError('');
    if (!auth) {
      setError(t('auth.errors.firebaseNotConfigured'));
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setSent(true);
      trackAuthEvent('password_reset_sent');
    } catch (err) {
      trackAuthEvent('password_reset_failed', { code: err?.code || 'unknown' });
      setError(mapAuthError(err, t, 'login'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-authPage pp-authPage--narrow">
          <div className="pp-card pp-pad pp-authFormCard">
            <Link className="pp-link pp-authBackLink" to="/login">
              ← {t('forgotPassword.backToLogin')}
            </Link>
            <h1 className="pp-sectionTitle pp-authFormTitle">{t('forgotPassword.title')}</h1>
            <p className="pp-subtle pp-authFormSubtitle">{t('forgotPassword.subtitle')}</p>

            {sent ? (
              <div className="pp-authSuccess" role="status">
                <p>{t('forgotPassword.sentTitle')}</p>
                <p className="pp-subtle">{t('forgotPassword.sentBody', { email: normalizedEmail })}</p>
                <Link className="pp-btn pp-btnPrimary pp-btn--lg" to="/login">
                  {t('forgotPassword.backToLogin')}
                </Link>
              </div>
            ) : (
              <form className="pp-form" onSubmit={onSubmit}>
                <div>
                  <div className="pp-label">{t('login.email')}</div>
                  <input
                    className="pp-input"
                    type="email"
                    required
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                {error ? (
                  <div className="pp-error" role="alert">
                    {error}
                  </div>
                ) : null}
                <button
                  className="pp-btn pp-btnPrimary pp-btn--lg"
                  type="submit"
                  disabled={submitting || !emailIsValid}
                >
                  {submitting ? t('forgotPassword.sending') : t('forgotPassword.sendLink')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
