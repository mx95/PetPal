import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { subscribeCompanyServices } from '../bookings/bookingFirestore';
import { getDb, isFirebaseConfigured } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function ProviderProfile() {
  const { providerId } = useParams();
  const companyId = String(providerId || '');
  const [provider, setProvider] = useState(null);
  const [services, setServices] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) return undefined;
    return onSnapshot(
      doc(getDb(), 'providers', companyId),
      (snap) => setProvider(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (e) => setErr(e?.message || 'failed')
    );
  }, [companyId]);

  useEffect(() => subscribeCompanyServices(companyId, setServices, (e) => setErr(e?.message || 'failed')), [companyId]);

  const grouped = useMemo(() => {
    const g = { vet: [], saloon: [], hotel: [] };
    services.forEach((s) => {
      const k = s.type || 'vet';
      if (!g[k]) g[k] = [];
      g[k].push(s);
    });
    return g;
  }, [services]);

  return (
    <div className="pp-pad">
      <div className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <div className="pp-badge">Provider</div>
          <div className="pp-pageHeader__title">{provider?.displayName || 'Provider'}</div>
          <div className="pp-pageHeader__subtitle">
            {provider?.address || ''} {provider?.phone ? `• ${provider.phone}` : ''}
          </div>
        </div>
      </div>

      {err ? <div className="pp-error">{err}</div> : null}

      <div className="pp-card" style={{ marginTop: 14 }}>
        <div className="pp-card__title">Services</div>
        {services.length === 0 ? <div className="pp-muted">No services published yet.</div> : null}

        <div className="pp-stack" style={{ marginTop: 10 }}>
          {['vet', 'saloon', 'hotel'].map((k) =>
            grouped[k]?.length ? (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 900, marginBottom: 6, textTransform: 'capitalize' }}>{k}</div>
                <div className="pp-stack">
                  {grouped[k].map((s) => (
                    <div key={s.id} className="pp-rowBetween pp-rowBetween--card">
                      <div>
                        <div style={{ fontWeight: 900 }}>{s.name}</div>
                        <div className="pp-muted" style={{ fontSize: 13 }}>
                          {s.durationMin} min {s.description ? `• ${s.description}` : ''}
                        </div>
                      </div>
                      <Link className="pp-btn pp-btn--primary" to={`/bookings/provider/${companyId}/book/${s.id}`}>
                        Book
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

