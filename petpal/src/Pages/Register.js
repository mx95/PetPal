import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signOut, updateProfile } from 'firebase/auth';
import { doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, getDb, isFirebaseConfigured } from '../firebase';
import { useAuth } from '../auth/AuthProvider';
import { mapAuthError, normalizeEmail, trackAuthEvent } from '../auth/authUtils';
import { signInWithSocialProvider } from '../auth/socialAuth';
import AuthSocialButtons from '../components/AuthSocialButtons';
import { useI18n } from '../i18n/I18nContext';

const AUTH_PACK_SRC = `${process.env.PUBLIC_URL || ''}/images/auth-pack-pets.png`;

function normalizeAccountName(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

async function rollbackCreatedUser(user) {
  try {
    await deleteUser(user);
  } catch (deleteErr) {
    console.error('auth rollback delete failed', deleteErr);
  }
  try {
    if (auth) await signOut(auth);
  } catch (signOutErr) {
    console.error('auth rollback signOut failed', signOutErr);
  }
}

export default function Register() {
  const { t } = useI18n();
  const { beginRegistrationTransaction, completeRegistrationTransaction } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [accountType, setAccountType] = useState(/** @type {'individual' | 'company'} */ ('individual'));
  const [businessName, setBusinessName] = useState('');
  const [socialBusy, setSocialBusy] = useState('');

  const passwordChecks = {
    len: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
  const busy = submitting || Boolean(socialBusy);

  async function finishSocial(providerId) {
    if (busy) return;
    setError('');
    setInfo('');
    if (!acceptedTerms) {
      setError(t('register.termsError'));
      return;
    }
    if (accountType === 'company') {
      setError(t('register.socialIndividualOnly'));
      return;
    }
    setSocialBusy(providerId);
    beginRegistrationTransaction();
    try {
      await signInWithSocialProvider(providerId);
      completeRegistrationTransaction(true);
      trackAuthEvent('register_social_success', { provider: providerId });
      navigate('/', { replace: true });
    } catch (err) {
      completeRegistrationTransaction(false);
      trackAuthEvent('register_social_failure', { provider: providerId, code: err?.code || 'unknown' });
      setError(mapAuthError(err, t, 'register'));
    } finally {
      setSocialBusy('');
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setInfo('');
    const trimmedDisplayName = displayName.trim();
    const trimmedBusinessName = businessName.trim();
    const normalizedEmail = normalizeEmail(email);
    const accountName = accountType === 'company' ? trimmedBusinessName : trimmedDisplayName;
    const accountNameNormalized = normalizeAccountName(accountName);

    if (accountType === 'individual' && trimmedDisplayName.length < 2) {
      setError(t('register.nameRequired'));
      return;
    }
    if (!acceptedTerms) {
      setError(t('register.termsError'));
      return;
    }
    if (accountType === 'company' && trimmedBusinessName.length < 2) {
      setError(t('register.businessNameError'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }
    if (!passwordChecks.len || !passwordChecks.upper || !passwordChecks.number) {
      setError(t('register.passwordPolicyFail'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.errors.weakPassword'));
      return;
    }
    if (!auth) {
      setError(t('auth.errors.firebaseNotConfigured'));
      return;
    }
    setSubmitting(true);
    beginRegistrationTransaction();
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const name = accountType === 'company' ? trimmedBusinessName : trimmedDisplayName;

      // Ensure Firestore sees an authenticated user immediately after sign-up.
      await cred.user.getIdToken(true);

      if (isFirebaseConfigured()) {
        try {
          const db = getDb();
          await runTransaction(db, async (tx) => {
            const reservationRef = doc(db, 'accountNames', accountNameNormalized);
            const reservationSnap = await tx.get(reservationRef);
            if (reservationSnap.exists() && reservationSnap.data()?.uid !== cred.user.uid) {
              throw new Error('NAME_TAKEN');
            }
            tx.set(reservationRef, {
              uid: cred.user.uid,
              accountType,
              accountName: accountName,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true });
          });
        } catch (reservationErr) {
          if (reservationErr?.message === 'NAME_TAKEN') {
            await rollbackCreatedUser(cred.user);
            completeRegistrationTransaction(false);
            setError(t(accountType === 'company' ? 'register.businessNameTaken' : 'register.usernameTaken'));
            return;
          }

          // Some projects have stricter/older rules for /accountNames.
          // If reservation read/write is denied, continue with registration flow
          // so Auth + /users profile creation can still proceed.
          if (reservationErr?.code === 'permission-denied') {
            console.warn('accountNames reservation skipped due to permissions', reservationErr);
          } else {
            await rollbackCreatedUser(cred.user);
            completeRegistrationTransaction(false);
            setError(t('register.nameCheckFailed'));
            return;
          }
        }
      }

      if (name) await updateProfile(cred.user, { displayName: name });

      if (isFirebaseConfigured()) {
        try {
          const db = getDb();
          await setDoc(
            doc(db, 'users', cred.user.uid),
            {
              uid: cred.user.uid,
              email: normalizedEmail,
              accountType,
              accountName: name,
              accountNameNormalized,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          await sendEmailVerification(cred.user);
          setInfo(t('register.verifyEmailSent'));
        } catch (writeErr) {
          console.error('users profile write failed', writeErr);
          await rollbackCreatedUser(cred.user);
          completeRegistrationTransaction(false);
          setError(
            writeErr?.code === 'permission-denied'
              ? t('auth.errors.firestorePermissionDenied')
              : t('auth.errors.registerGeneric')
          );
          return;
        }
      }

      if (accountType === 'company') {
        completeRegistrationTransaction(true);
        trackAuthEvent('register_success_company');
        navigate('/company/apply', { replace: true, state: { businessName: trimmedBusinessName } });
        return;
      }
      completeRegistrationTransaction(true);
      trackAuthEvent('register_success_individual');
      navigate('/', { replace: true });
    } catch (err) {
      completeRegistrationTransaction(false);
      trackAuthEvent('register_failure', { code: err?.code || 'unknown' });
      setError(mapAuthError(err, t, 'register'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-authPage pp-authPage--login">
          <aside className="pp-authPage__welcome">
            <div className="pp-authPage__welcomeTop">
              <span className="pp-authPage__welcomeEyebrow">{t('register.welcomeEyebrow')}</span>
              <h1 className="pp-authPage__welcomeTitle">{t('register.title')}</h1>
              <p className="pp-authPage__welcomeSub">{t('register.subtitle')}</p>
              <ul className="pp-authPage__welcomeList">
                <li>
                  <span className="pp-authPage__welcomeIcon" aria-hidden>
                    🐾
                  </span>
                  <span>{t('register.benefit1')}</span>
                </li>
                <li>
                  <span className="pp-authPage__welcomeIcon" aria-hidden>
                    🏅
                  </span>
                  <span>{t('register.benefit2')}</span>
                </li>
                <li>
                  <span className="pp-authPage__welcomeIcon" aria-hidden>
                    📍
                  </span>
                  <span>{t('register.benefit3')}</span>
                </li>
              </ul>
            </div>
            <figure className="pp-authPage__welcomeArt">
              <img src={AUTH_PACK_SRC} alt={t('login.packImageAlt')} loading="lazy" decoding="async" />
            </figure>
          </aside>

          <div className="pp-card pp-pad pp-authFormCard">
            <h2 className="pp-sectionTitle pp-authFormTitle">{t('register.formTitle')}</h2>
            <p className="pp-subtle pp-authFormSubtitle">{t('register.formSubtitle')}</p>

          <form className="pp-form" onSubmit={onSubmit}>
            <div>
              <div className="pp-label">{t('register.accountType')}</div>
              <div className="pp-radioChipRow" role="group" aria-label={t('register.accountType')}>
                <label className={`pp-radioChip ${accountType === 'individual' ? 'pp-radioChip--on' : ''}`}>
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'individual'}
                    onChange={() => setAccountType('individual')}
                    disabled={busy}
                  />
                  <span aria-hidden>🐾</span>
                  {t('register.accountOwner')}
                </label>
                <label className={`pp-radioChip ${accountType === 'company' ? 'pp-radioChip--on' : ''}`}>
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'company'}
                    onChange={() => setAccountType('company')}
                    disabled={busy}
                  />
                  <span aria-hidden>🏪</span>
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
                  required
                  minLength={2}
                  autoComplete="username"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('register.usernamePlaceholder')}
                />
              </div>
            ) : (
              <div>
                <div className="pp-label">{t('register.businessName')}</div>
                <input
                  className="pp-input"
                  required
                  minLength={2}
                  autoComplete="organization"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={t('register.businessNamePlaceholder')}
                />
              </div>
            )}
            <div>
              <div className="pp-label">{t('register.email')}</div>
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
              <div className="pp-label">{t('register.password')}</div>
              <div className="pp-authPasswordWrap">
                <input
                  className="pp-input pp-input--withRightIcon"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {error ? <div className="pp-error">{error}</div> : null}
            {info ? <div className="pp-subtle pp-authInfo" role="status" aria-live="polite">{info}</div> : null}
            <ul className="pp-passwordRules" style={{ marginTop: 4 }}>
              <li className={`pp-passwordRule ${passwordChecks.len ? 'is-valid' : ''}`}>
                {t('register.passwordRuleMin')}
              </li>
              <li className={`pp-passwordRule ${passwordChecks.upper ? 'is-valid' : ''}`}>
                {t('register.passwordRuleUpper')}
              </li>
              <li className={`pp-passwordRule ${passwordChecks.number ? 'is-valid' : ''}`}>
                {t('register.passwordRuleNumber')}
              </li>
            </ul>

            <label className="pp-legalCheck">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                aria-describedby="register-legal-desc"
              />
              <span id="register-legal-desc">
                {t('register.readTerms')}{' '}
                <Link to="/terms" className="pp-link pp-link--inline" target="_blank" rel="noopener noreferrer">
                  {t('register.terms')}
                </Link>{' '}
                {t('register.and')}{' '}
                <Link to="/privacy" className="pp-link pp-link--inline" target="_blank" rel="noopener noreferrer">
                  {t('register.privacy')}
                </Link>
                .
              </span>
            </label>

            <button className="pp-btn pp-btnPrimary pp-btn--lg" disabled={busy || !acceptedTerms}>
              {submitting ? t('register.creating') : t('register.createAccount')}
            </button>

            <AuthSocialButtons
              busy={busy}
              disabled={!acceptedTerms}
              onGoogle={() => void finishSocial('google')}
              onApple={() => void finishSocial('apple')}
            />

            <p className="pp-subtle pp-authSwitchHint">
              {t('register.haveAccountQ')}{' '}
              <Link className="pp-link pp-link--inline" to="/login">
                {t('register.backToLogin')}
              </Link>
            </p>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}

