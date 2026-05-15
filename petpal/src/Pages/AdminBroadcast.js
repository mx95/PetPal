import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { createBroadcastMessage } from '../inbox/inboxFirestore';

export default function AdminBroadcast() {
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">Firebase is not configured.</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    setSending(true);
    try {
      await createBroadcastMessage({
        title,
        body,
        createdBy: user.uid,
        createdByEmail: user.email || null,
      });
      setTitle('');
      setBody('');
      setOk('Message sent to all users.');
    } catch (ex) {
      setErr(ex?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge" style={{ background: 'rgba(180, 35, 24, 0.1)', color: '#b42318' }}>
              Admin
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              Broadcast message
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 640 }}>
              Send an announcement to every signed-in user. It appears in their profile inbox with an unread badge until
              they open it.
            </p>
          </div>
          <Link className="pp-link" to="/admin">
            ← Admin tools
          </Link>
        </div>
      </div>

      <div className="pp-col-12 pp-col-md-8">
        <form className="pp-card pp-pad pp-inboxBroadcastForm" onSubmit={(e) => void handleSubmit(e)}>
          <label className="pp-field">
            <span className="pp-field__label">Subject</span>
            <input
              className="pp-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              placeholder="e.g. Scheduled maintenance tonight"
            />
          </label>
          <label className="pp-field">
            <span className="pp-field__label">Message</span>
            <textarea
              className="pp-input"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              required
              placeholder="Write the message everyone should see…"
            />
          </label>
          {err ? <p className="pp-error">{err}</p> : null}
          {ok ? <p className="pp-subtle" style={{ color: '#15803d', fontWeight: 700 }}>{ok}</p> : null}
          <div className="pp-row" style={{ gap: 10, marginTop: 8 }}>
            <button type="submit" className="pp-btn pp-btnPrimary" disabled={sending}>
              {sending ? 'Sending…' : 'Send to everyone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
