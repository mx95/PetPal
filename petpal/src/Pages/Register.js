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

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!acceptedTerms) {
      setError('Please accept the Terms of service and Privacy policy to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const name = displayName.trim();
      if (name) await updateProfile(cred.user, { displayName: name });
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
              <div className="pp-label">Name (optional)</div>
              <input
                className="pp-input"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sotiris"
              />
            </div>
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

