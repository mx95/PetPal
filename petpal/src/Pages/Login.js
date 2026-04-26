import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

function humanFirebaseError(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-credential') return 'Incorrect email or password.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Try again later.';
  return err?.message || 'Login failed. Please try again.';
}

export default function Login() {
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
      setError(humanFirebaseError(err));
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
            Welcome back
          </h1>
          <p className="pp-subtle">
            Log in to track walks, unlock achievements, and keep your dog safe.
          </p>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Log in</h2>
          <form className="pp-form" onSubmit={onSubmit}>
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error ? <div className="pp-error">{error}</div> : null}

            <div className="pp-row" style={{ justifyContent: 'space-between' }}>
              <button className="pp-btn pp-btnPrimary" disabled={submitting}>
                {submitting ? 'Logging in…' : 'Log in'}
              </button>
              <Link className="pp-link" to="/register">
                Create account
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

