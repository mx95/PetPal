import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { subscribeAllBookings } from '../bookings/bookingFirestore';
import { formatDateTime24 } from '../formatTime24';

function bookingWhen(b) {
  if (b.startAt?.toDate) return formatDateTime24(b.startAt.toDate());
  return '—';
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'booked') return 'pp-badge';
  if (s === 'completed') return 'pp-badge';
  if (s === 'cancelled') return 'pp-badge';
  return 'pp-badge';
}

function statusBadgeStyle(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'booked') return { background: 'rgba(46, 144, 250, 0.12)', color: '#1570ef' };
  if (s === 'completed') return { background: 'rgba(18, 183, 106, 0.12)', color: '#039855' };
  if (s === 'cancelled') return { background: 'rgba(152, 162, 179, 0.18)', color: '#475467' };
  return { background: 'rgba(152, 162, 179, 0.12)', color: '#475467' };
}

function serializeBooking(b) {
  const copy = { ...b };
  if (copy.startAt?.toDate) copy.startAt = copy.startAt.toDate().toISOString();
  if (copy.endAt?.toDate) copy.endAt = copy.endAt.toDate().toISOString();
  if (copy.createdAt?.toDate) copy.createdAt = copy.createdAt.toDate().toISOString();
  if (copy.updatedAt?.toDate) copy.updatedAt = copy.updatedAt.toDate().toISOString();
  return copy;
}

export default function AdminBookings() {
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState('');

  useEffect(() => {
    if (!firebaseReady || !isAdmin) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeAllBookings(
      (list) => {
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || 'Failed to load bookings.');
        setLoading(false);
      }
    );
    return unsub;
  }, [firebaseReady, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((b) => {
      if (statusFilter !== 'all' && String(b.status || '').toLowerCase() !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        b.id,
        b.customerUid,
        b.companyId,
        b.slotId,
        b.serviceId,
        b.petId,
        b.petSnapshot?.name,
        b.serviceSnapshot?.name,
        b.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter]);

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

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge" style={{ background: 'rgba(180, 35, 24, 0.1)', color: '#b42318' }}>
              Admin
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              All bookings
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 720 }}>
              Live view of every appointment in Firestore for troubleshooting and customer support. Shows the latest 200
              bookings by start time.
            </p>
          </div>
          <Link className="pp-link" to="/admin">
            ← Admin tools
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <div className="pp-row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              className="pp-input"
              style={{ flex: '1 1 220px', minWidth: 0 }}
              placeholder="Search by booking id, user, company, pet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="pp-input" style={{ flex: '0 0 auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="booked">Booked</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {err ? <div className="pp-error">{err}</div> : null}
          {loading ? <div className="pp-muted">Loading bookings…</div> : null}
          {!loading && filtered.length === 0 ? (
            <div className="pp-muted">{rows.length === 0 ? 'No bookings in Firestore yet.' : 'No bookings match your filters.'}</div>
          ) : null}

          <div className="pp-stack" style={{ marginTop: 10 }}>
            {filtered.map((b) => {
              const serviceName = b.serviceSnapshot?.name || b.serviceId || 'Service';
              const petName = b.petSnapshot?.name || b.petId || 'Pet';
              const expanded = expandedId === b.id;
              return (
                <div key={b.id} className="pp-providerBookingCard" style={{ padding: 12 }}>
                  <div className="pp-rowBetween" style={{ alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>{petName}</div>
                      <div className="pp-muted" style={{ fontSize: 13 }}>
                        {serviceName} · {bookingWhen(b)}
                      </div>
                      <div className="pp-muted" style={{ fontSize: 12, marginTop: 4, wordBreak: 'break-all' }}>
                        <span title="Booking document id">ID: {b.id}</span>
                        {' · '}
                        <span title="Customer UID">Customer: {b.customerUid || '—'}</span>
                        {' · '}
                        <span title="Provider company id">Company: {b.companyId || '—'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className={statusBadgeClass(b.status)} style={statusBadgeStyle(b.status)}>
                        {b.status || 'unknown'}
                      </span>
                      <button
                        type="button"
                        className="pp-btn pp-btn--ghost"
                        onClick={() => setExpandedId(expanded ? '' : b.id)}
                      >
                        {expanded ? 'Hide details' : 'Details'}
                      </button>
                    </div>
                  </div>
                  {expanded ? (
                    <pre
                      className="pp-muted"
                      style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        background: 'rgba(0,0,0,0.04)',
                        fontSize: 11,
                        overflow: 'auto',
                        maxHeight: 320,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(serializeBooking(b), null, 2)}
                    </pre>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
