import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { subscribeCustomerBookings } from '../bookings/bookingFirestore';
import { subscribeProviders } from '../bookings/providerDirectoryFirestore';

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={`pp-btn pp-btn--ghost ${active ? 'pp-btn--primary' : ''}`}
      onClick={onClick}
      style={{ borderRadius: 999 }}
    >
      {children}
    </button>
  );
}

export default function BookingsHub() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [tab, setTab] = useState('browse'); // browse|mine

  return (
    <div className="pp-pad">
      <div className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <div className="pp-badge">Bookings</div>
          <div className="pp-pageHeader__title">Appointments & reservations</div>
          <div className="pp-pageHeader__subtitle">Book vets, saloons, and pet hotels.</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <TabButton active={tab === 'browse'} onClick={() => setTab('browse')}>
          Browse
        </TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          My bookings
        </TabButton>
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === 'browse' ? <BrowseProviders /> : null}
        {tab === 'mine' ? <MyBookings uid={uid} /> : null}
      </div>
    </div>
  );
}

function BrowseProviders() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => subscribeProviders(setRows, (e) => setErr(e?.message || 'failed')), []);

  const examples = [
    {
      id: 'example_vet',
      displayName: 'Paws & Care Vet Clinic',
      address: '123 Oak Street',
      phone: '+30 210 000 0000',
    },
    {
      id: 'example_groom',
      displayName: 'Fluffy Cuts Grooming & Pet Shop',
      address: '45 Sunset Avenue',
      phone: '+30 210 111 1111',
    },
  ];

  return (
    <div className="pp-card">
      <div className="pp-card__title">Providers</div>
      {err ? <div className="pp-error">{err}</div> : null}
      {rows.length === 0 ? (
        <>
          <div className="pp-muted">No providers published yet.</div>
          <div className="pp-muted" style={{ marginTop: 6, fontSize: 13 }}>
            Examples (these are just previews — publish real providers from the Provider Portal):
          </div>
        </>
      ) : null}
      <div className="pp-stack" style={{ marginTop: 10 }}>
        {rows.length === 0
          ? examples.map((p) => (
              <div
                key={p.id}
                className="pp-rowBetween pp-rowBetween--card"
                style={{ opacity: 0.75, cursor: 'default' }}
                role="group"
                aria-label="Example provider"
              >
                <div>
                  <div style={{ fontWeight: 900 }}>{p.displayName}</div>
                  <div className="pp-muted" style={{ fontSize: 13 }}>
                    {p.address} {p.phone ? `• ${p.phone}` : ''}
                  </div>
                </div>
                <span className="pp-muted" style={{ fontWeight: 900 }}>
                  Example
                </span>
              </div>
            ))
          : null}
        {rows.map((p) => (
          <Link key={p.id} to={`/bookings/provider/${p.id}`} className="pp-rowBetween pp-rowBetween--card">
            <div>
              <div style={{ fontWeight: 900 }}>{p.displayName || 'Provider'}</div>
              <div className="pp-muted" style={{ fontSize: 13 }}>
                {p.address || ''} {p.phone ? `• ${p.phone}` : ''}
              </div>
            </div>
            <span className="pp-muted" style={{ fontWeight: 900 }}>
              View →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MyBookings({ uid }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => subscribeCustomerBookings(uid, setRows, (e) => setErr(e?.message || 'failed')), [uid]);

  return (
    <div className="pp-card">
      <div className="pp-card__title">My bookings</div>
      {err ? <div className="pp-error">{err}</div> : null}
      {rows.length === 0 ? <div className="pp-muted">No bookings yet.</div> : null}
      <div className="pp-stack" style={{ marginTop: 10 }}>
        {rows.map((b) => (
          <div key={b.id} className="pp-rowBetween pp-rowBetween--card">
            <div>
              <div style={{ fontWeight: 900 }}>{b.petSnapshot?.name || 'Pet'}</div>
              <div className="pp-muted" style={{ fontSize: 13 }}>
                {b.status} • {b.startAt?.toDate ? b.startAt.toDate().toLocaleString() : ''}
              </div>
            </div>
            <Link className="pp-btn pp-btn--ghost" to={`/bookings/provider/${b.companyId}`}>
              Provider
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

