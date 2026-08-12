import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { mapAuthError, normalizeEmail, trackAuthEvent } from '../auth/authUtils';
import { signInWithSocialProvider } from '../auth/socialAuth';
import AuthSocialButtons from '../components/AuthSocialButtons';
import { useI18n } from '../i18n/I18nContext';

const AUTH_PACK_SRC = `${process.env.PUBLIC_URL || ''}/images/auth-pack-pets.png`;

const DESKTOP_FEATURES = [
  { key: 'benefit1', descKey: 'benefit1Desc', icon: 'gps' },
  { key: 'benefit2', descKey: 'benefit2Desc', icon: 'nfc' },
  { key: 'benefit3', descKey: 'benefit3Desc', icon: 'nearby' },
];

const MOBILE_FEATURES = [
  { key: 'mobileGps', icon: 'gps' },
  { key: 'mobileNfc', icon: 'nfc' },
  { key: 'mobileBooking', icon: 'booking' },
  { key: 'mobileNearby', icon: 'nearby' },
  { key: 'mobileShop', icon: 'shop' },
  { key: 'mobileAchievements', icon: 'achievements' },
];

function FeatureIcon({ type }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (type === 'nfc') {
    return (
      <svg {...common}>
        <rect x="4" y="3.5" width="16" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 9.5c1.2-1.1 4.8-1.1 6 0M9.8 12.2c.8-.7 3.4-.7 4.2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'nearby') {
    return (
      <svg {...common}>
        <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 12 4.3a6.5 6.5 0 0 0-6.5 6.5C5.5 15.8 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="12" cy="10.8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (type === 'booking') {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3.5V7M16 3.5V7M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'shop') {
    return (
      <svg {...common}>
        <path d="M7.5 8.5h9l1.2 9.2a1.8 1.8 0 0 1-1.8 2H8.1a1.8 1.8 0 0 1-1.8-2L7.5 8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'achievements') {
    return (
      <svg {...common}>
        <circle cx="12" cy="9" r="4.2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 13.2V17M9.2 20l2.8-3 2.8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </svg>
  );
}

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = useMemo(() => location.state?.from || '/', [location.state]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [socialBusy, setSocialBusy] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [error, setError] = useState('');

  const normalizedEmail = normalizeEmail(email);
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const formIsValid = emailIsValid && password.length > 0;
  const cooldownLeftSec = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const isCoolingDown = cooldownLeftSec > 0;
  const busy = submitting || Boolean(socialBusy);

  async function finishSocial(providerId) {
    if (busy || isCoolingDown) return;
    setError('');
    setSocialBusy(providerId);
    try {
      await signInWithSocialProvider(providerId);
      trackAuthEvent('login_social_success', { provider: providerId });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err?.code === 'auth/too-many-requests') setCooldownUntil(Date.now() + 30_000);
      trackAuthEvent('login_social_failure', { provider: providerId, code: err?.code || 'unknown' });
      setError(mapAuthError(err, t, 'login'));
    } finally {
      setSocialBusy('');
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy || isCoolingDown) return;
    setError('');
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

  return (
    <div className="pp-authLogin">
      <div className="pp-authLogin__layout">
        <aside className="pp-authLogin__hero" aria-labelledby="login-hero-title">
          <div className="pp-authLogin__heroGlow" aria-hidden />
          <div className="pp-authLogin__heroCopy">
            <span className="pp-authLogin__eyebrow">{t('login.welcomeEyebrow')}</span>
            <h1 id="login-hero-title" className="pp-authLogin__title">
              {t('login.welcome')}
            </h1>
            <p className="pp-authLogin__sub">{t('login.subtitle')}</p>
            <ul className="pp-authLogin__desktopFeatures">
              {DESKTOP_FEATURES.map(({ key, descKey, icon }) => (
                <li key={key}>
                  <span className="pp-authLogin__featureIcon" aria-hidden>
                    <FeatureIcon type={icon} />
                  </span>
                  <div>
                    <strong>{t(`login.${key}`)}</strong>
                    <span>{t(`login.${descKey}`)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <figure className="pp-authLogin__art">
            <img src={AUTH_PACK_SRC} alt={t('login.packImageAlt')} loading="eager" decoding="async" />
          </figure>
        </aside>

        <ul className="pp-authLogin__mobileFeatures" aria-label={t('login.mobileFeaturesAria')}>
          {MOBILE_FEATURES.map(({ key, icon }) => (
            <li key={key}>
              <span className="pp-authLogin__featureIcon" aria-hidden>
                <FeatureIcon type={icon} />
              </span>
              <strong>{t(`login.${key}.title`)}</strong>
              <span>{t(`login.${key}.desc`)}</span>
            </li>
          ))}
        </ul>

        <div className="pp-authLogin__formCol">
          <div className="pp-authFormCard pp-authLogin__card">
            <h2 className="pp-authFormTitle">{t('login.formTitle')}</h2>
            <p className="pp-subtle pp-authFormSubtitle">{t('login.formSubtitle')}</p>

            <form className="pp-form pp-authLogin__form" onSubmit={onSubmit}>
              <div>
                <div className="pp-label">{t('login.email')}</div>
                <input
                  className="pp-input pp-authLogin__input"
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
                  disabled={busy}
                />
              </div>
              <div>
                <div className="pp-label">{t('login.password')}</div>
                <div className="pp-authPasswordWrap">
                  <input
                    className="pp-input pp-input--withRightIcon pp-authLogin__input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={busy}
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

              {error ? (
                <div className="pp-error" role="alert">
                  {error}
                </div>
              ) : null}
              {isCoolingDown ? <div className="pp-subtle">{t('login.cooldown', { sec: cooldownLeftSec })}</div> : null}

              <div className="pp-authRow">
                <Link className="pp-authTextBtn" to="/forgot-password">
                  {t('login.forgotPassword')}
                </Link>
              </div>

              <button
                className="pp-btn pp-btnPrimary pp-btn--lg pp-authLogin__submit"
                disabled={busy || !formIsValid || isCoolingDown}
              >
                {submitting ? t('login.loggingIn') : t('login.logIn')}
              </button>

              <AuthSocialButtons
                busy={busy}
                disabled={isCoolingDown}
                onGoogle={() => void finishSocial('google')}
                onApple={() => void finishSocial('apple')}
              />

              <p className="pp-subtle pp-authSwitchHint">
                {t('login.noAccountQ')}{' '}
                <Link className="pp-link pp-link--inline" to="/register">
                  {t('login.createAccount')}
                </Link>
              </p>

              <p className="pp-authTrust">{t('login.securityHint')}</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
