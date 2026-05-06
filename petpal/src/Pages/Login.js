import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { mapAuthError, normalizeEmail, trackAuthEvent } from '../auth/authUtils';
import { useI18n } from '../i18n/I18nContext';

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = useMemo(() => location.state?.from || '/dashboard', [location.state]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const normalizedEmail = normalizeEmail(email);
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const formIsValid = emailIsValid && password.length > 0;
  const cooldownLeftSec = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const isCoolingDown = cooldownLeftSec > 0;

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting || isCoolingDown) return;
    setError('');
    setInfo('');
    if (!auth) {
      setError(t('auth.errors.firebaseNotConfigured'));
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      trackAuthEvent('login_success');
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err?.code === 'auth/too-many-requests') setCooldownUntil(Date.now() + 30_000);
      trackAuthEvent('login_failure', { code: err?.code || 'unknown' });
      setError(mapAuthError(err, t, 'login'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onResetPassword() {
    if (resetting || submitting || isCoolingDown) return;
    setError('');
    setInfo('');
    if (!auth) {
      setError(t('auth.errors.firebaseNotConfigured'));
      return;
    }
    if (!emailIsValid) {
      setError(t('login.enterEmailForReset'));
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setInfo(t('login.resetSent'));
      trackAuthEvent('password_reset_sent');
    } catch (err) {
      if (err?.code === 'auth/too-many-requests') setCooldownUntil(Date.now() + 30_000);
      trackAuthEvent('password_reset_failed', { code: err?.code || 'unknown' });
      setError(mapAuthError(err, t, 'login'));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-authPage">
          <aside className="pp-authPage__welcome">
            <span className="pp-authPage__welcomeEyebrow">{t('login.welcomeEyebrow')}</span>
            <div>
              <h1 className="pp-authPage__welcomeTitle">{t('login.welcome')}</h1>
              <p className="pp-authPage__welcomeSub" style={{ marginTop: 8 }}>
                {t('login.subtitle')}
              </p>
            </div>
            <ul className="pp-authPage__welcomeList">
              <li><span aria-hidden>🐾</span><span>{t('login.benefit1')}</span></li>
              <li><span aria-hidden>🔥</span><span>{t('login.benefit2')}</span></li>
              <li><span aria-hidden>📍</span><span>{t('login.benefit3')}</span></li>
            </ul>
            <p className="pp-subtle" style={{ fontSize: 13, margin: 0 }}>{t('login.trustLine')}</p>
          </aside>

          <div className="pp-card pp-pad pp-authFormCard">
            <h2 className="pp-sectionTitle pp-authFormTitle">{t('login.formTitle')}</h2>
            <p className="pp-subtle pp-authFormSubtitle">
              {t('login.formSubtitle')}
            </p>
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
              <div>
                <div className="pp-label">{t('login.password')}</div>
                <div className="pp-authPasswordWrap">
                  <input
                    className="pp-input pp-input--withRightIcon"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="pp-authIconBtn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                        <path
                          d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-0.68 1.53-1.8 2.9-3.2 4M6.1 6.1C4.29 7.35 2.83 9.05 2 12c1.73 3.89 6 7 10 7a10.94 10.94 0 004.26-.84"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                        <path
                          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error ? <div className="pp-error" role="alert">{error}</div> : null}
              {isCoolingDown ? <div className="pp-subtle">{t('login.cooldown', { sec: cooldownLeftSec })}</div> : null}
              {info ? <div className="pp-subtle pp-authInfo" role="status" aria-live="polite">{info}</div> : null}

              <div className="pp-authRow">
                <button
                  type="button"
                  className="pp-authTextBtn"
                  onClick={onResetPassword}
                  disabled={resetting || submitting || isCoolingDown}
                >
                  {resetting ? t('login.sendingReset') : t('login.forgotPassword')}
                </button>
              </div>

              <button className="pp-btn pp-btnPrimary pp-btn--lg" disabled={submitting || !formIsValid || isCoolingDown}>
                {submitting ? t('login.loggingIn') : t('login.logIn')}
              </button>
              <p className="pp-subtle pp-authSwitchHint">
                {t('login.noAccountQ')}{' '}
                <Link className="pp-link pp-link--inline" to="/register">
                  {t('login.createAccount')}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
