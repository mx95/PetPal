import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useI18n } from '../i18n/I18nContext';

function humanFirebaseError(err, t) {
  const code = err?.code || '';
  if (code === 'auth/invalid-credential') return t('auth.errors.incorrect');
  if (code === 'auth/invalid-email') return t('auth.errors.invalidEmail');
  if (code === 'auth/too-many-requests') return t('auth.errors.tooMany');
  return err?.message || t('auth.errors.loginGeneric');
}

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = useMemo(() => location.state?.from || '/dashboard', [location.state]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!auth) {
      setError(t('auth.errors.firebaseNotConfigured'));
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(humanFirebaseError(err, t));
    } finally {
      setSubmitting(false);
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

          <div className="pp-card pp-pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 className="pp-sectionTitle" style={{ fontSize: 22 }}>{t('login.formTitle')}</h2>
            <p className="pp-subtle" style={{ marginBottom: 14, marginTop: -4 }}>
              {t('login.formSubtitle')}
            </p>
            <form className="pp-form" onSubmit={onSubmit}>
              <div>
                <div className="pp-label">{t('login.email')}</div>
                <input
                  className="pp-input"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <div className="pp-label">{t('login.password')}</div>
                <input
                  className="pp-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error ? <div className="pp-error">{error}</div> : null}

              <button className="pp-btn pp-btnPrimary pp-btn--lg" disabled={submitting} style={{ marginTop: 4 }}>
                {submitting ? t('login.loggingIn') : t('login.logIn')}
              </button>
              <p className="pp-subtle" style={{ fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                {t('login.noAccountQ')}{' '}
                <Link className="pp-link" to="/register" style={{ display: 'inline', padding: 0 }}>
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
