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
      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <div className="pp-badge">PetPal</div>
          <h1 className="pp-h1" style={{ marginTop: 10 }}>
            {t('login.welcome')}
          </h1>
          <p className="pp-subtle">
            {t('login.subtitle')}
          </p>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">{t('login.formTitle')}</h2>
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

            <div className="pp-row" style={{ justifyContent: 'space-between' }}>
              <button className="pp-btn pp-btnPrimary" disabled={submitting}>
                {submitting ? t('login.loggingIn') : t('login.logIn')}
              </button>
              <Link className="pp-link" to="/register">
                {t('login.createAccount')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

