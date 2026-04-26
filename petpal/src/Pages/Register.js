import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

function humanFirebaseError(err) {
  const code = err?.code || '';
  if (code === 'auth/email-already-in-use') return 'That email is already registered.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  return err?.message || 'Registration failed. Please try again.';
}

export default function Register() {
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
      setError('Please accept the Terms of service and Privacy policy to continue.');
      return;
    }
    if (accountType === 'company' && !businessName.trim()) {
      setError('Enter a business or venue name, or choose Individual account.');
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
      setError(humanFirebaseError(err));
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
            Create your account
          </h1>
          <p className="pp-subtle" style={{ marginBottom: 14 }}>
            Start tracking walks and achievements in minutes.
          </p>

          <form className="pp-form" onSubmit={onSubmit}>
            <div>
              <div className="pp-label">Account type</div>
              <div className="pp-community-walkStyle" style={{ marginTop: 6 }} role="group" aria-label="Account type">
                <label>
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'individual'}
                    onChange={() => setAccountType('individual')}
                  />
                  Pet owner
                </label>
                <label>
                  <input
                    type="radio"
                    name="accountType"
                    checked={accountType === 'company'}
                    onChange={() => setAccountType('company')}
                  />
                  Business / venue (map listing + review)
                </label>
              </div>
              <p className="pp-subtle" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                Businesses set a real map pin; an admin must approve you before you can run paid boosted community posts.
              </p>
            </div>
            {accountType === 'individual' ? (
              <div>
                <div className="pp-label">Name (optional)</div>
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
                <div className="pp-label">Business or venue name</div>
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
              <div className="pp-label">Email</div>
              <input
                className="pp-input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="pp-label">Password</div>
              <input
                className="pp-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
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
                I have read and agree to the{' '}
                <Link to="/terms" className="pp-link" style={{ display: 'inline', padding: 0 }} target="_blank" rel="noopener noreferrer">
                  Terms of service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="pp-link" style={{ display: 'inline', padding: 0 }} target="_blank" rel="noopener noreferrer">
                  Privacy policy
                </Link>
                .
              </span>
            </label>

            <div className="pp-row" style={{ justifyContent: 'space-between' }}>
              <button className="pp-btn pp-btnPrimary" disabled={submitting || !acceptedTerms}>
                {submitting ? 'Creating…' : 'Create account'}
              </button>
              <Link className="pp-link" to="/login">
                Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

