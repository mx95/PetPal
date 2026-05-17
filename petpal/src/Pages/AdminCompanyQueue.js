import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import {
  adminApproveCompany,
  adminRejectCompany,
  fetchPendingCompanyApplications,
} from '../company/companyFirestore';

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export default function AdminCompanyQueue() {
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();
  const [list, setList] = useState(/** @type {import('../company/companyTypes').CompanyProfile[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [actionId, setActionId] = useState(/** @type {string | null} */ (null));
  const [noteById, setNoteById] = useState(() => ({}));

  const refresh = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const rows = await fetchPendingCompanyApplications();
      setList(rows);
    } catch (e) {
      setErr(e?.message || 'Failed to load queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
  }, [isAdmin, refresh]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!firebaseReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">Firebase is not configured.</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  async function approve(id) {
    setActionId(id);
    setErr('');
    try {
      await adminApproveCompany(id, noteById[id] || '');
      await refresh();
    } catch (e) {
      setErr(e?.message || 'Approve failed. Check rules and that your UID has an /admins doc.');
    } finally {
      setActionId(null);
    }
  }

  async function reject(id) {
    setActionId(id);
    setErr('');
    try {
      await adminRejectCompany(id, noteById[id] || 'Please review and resubmit.');
      await refresh();
    } catch (e) {
      setErr(e?.message || 'Reject failed.');
    } finally {
      setActionId(null);
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
              Business applications
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 640 }}>
              Approve a pin only when the business and map location are legitimate. Reject with a short note; the
              business can resubmit. Create a document in Firestore <code>admins/&lt;yourUid&gt;</code> (any field) to
              unlock this page for your account.
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>
      </div>
      {err ? (
        <div className="pp-col-12">
          <p className="pp-error" style={{ margin: 0 }}>
            {err}
          </p>
        </div>
      ) : null}
      <div className="pp-col-12">
        {loading ? (
          <p className="pp-subtle">Loading…</p>
        ) : list.length === 0 ? (
          <p className="pp-subtle">No pending applications.</p>
        ) : (
          <ul className="pp-adminCompanyList" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {list.map((c) => {
              const id = c.id;
              if (!id) return null;
              return (
                <li key={id} className="pp-card pp-pad" style={{ marginBottom: 12 }}>
                  <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>
                    {c.businessName}
                  </h2>
                  <p className="pp-subtle" style={{ marginTop: 4, marginBottom: 4 }}>
                    Application ID: <code style={{ fontSize: 12 }}>{id}</code>
                  </p>
                  {c.ownerUid ? (
                    <p className="pp-subtle" style={{ marginTop: 4, marginBottom: 4 }}>
                      Owner UID: <code style={{ fontSize: 12 }}>{c.ownerUid}</code>
                    </p>
                  ) : null}
                  {c.addressLine ? (
                    <p className="pp-subtle" style={{ marginTop: 4 }}>
                      {c.addressLine}
                    </p>
                  ) : null}
                  {c.publicEmail ? (
                    <p className="pp-subtle" style={{ marginTop: 4 }}>
                      Email: {c.publicEmail}
                    </p>
                  ) : null}
                  {c.lat != null && c.lng != null ? (
                    <p style={{ marginTop: 8 }}>
                      <a
                        className="pp-link"
                        href={mapsLink(c.lat, c.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open pin in Google Maps
                      </a>
                    </p>
                  ) : null}
                  <div style={{ marginTop: 10 }}>
                    <div className="pp-label" style={{ fontSize: 12 }}>
                      Note (optional, stored on approve / reject)
                    </div>
                    <input
                      className="pp-input"
                      style={{ maxWidth: 480, marginTop: 4, fontSize: 14 }}
                      value={noteById[id] || ''}
                      onChange={(e) => setNoteById((m) => ({ ...m, [id]: e.target.value }))}
                      placeholder="e.g. Verified via phone call / Does not match listing"
                    />
                  </div>
                  <div className="pp-row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="pp-btn pp-btnPrimary"
                      disabled={actionId === id}
                      onClick={() => approve(id)}
                    >
                      {actionId === id ? '…' : 'Approve'}
                    </button>
                    <button type="button" className="pp-btn" disabled={actionId === id} onClick={() => reject(id)}>
                      {actionId === id ? '…' : 'Reject'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
