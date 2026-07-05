import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { subscribeCompanyServices } from '../bookings/bookingFirestore';
import {
  getCatalogProvider,
  getCatalogServices,
  isCatalogProvider,
  resolveCatalogProviderId,
} from '../bookings/bookingCatalog';
import { getDb, isFirebaseConfigured } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function ProviderProfile() {
  const { providerId } = useParams();
  const rawProviderId = String(providerId || '');
  const companyId = resolveCatalogProviderId(rawProviderId);
  const needsLegacyRedirect = companyId !== rawProviderId;
  const useCatalog = isCatalogProvider(companyId);
  const [provider, setProvider] = useState(() => (useCatalog ? getCatalogProvider(companyId) : null));
  const [services, setServices] = useState(() => (useCatalog ? getCatalogServices(companyId) : []));
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) return undefined;
    return onSnapshot(
      doc(getDb(), 'providers', companyId),
      (snap) => {
        if (snap.exists()) {
          setProvider({ id: snap.id, ...snap.data() });
        } else if (useCatalog) {
          setProvider(getCatalogProvider(companyId));
        } else {
          setProvider(null);
        }
      },
      (e) => setErr(e?.message || 'failed')
    );
  }, [companyId, useCatalog]);

  useEffect(
    () =>
      subscribeCompanyServices(
        companyId,
        (rows) => {
          if (rows.length) {
            setServices(rows);
          } else if (useCatalog) {
            setServices(getCatalogServices(companyId));
          } else {
            setServices([]);
          }
        },
      (e) => {
        const msg = String(e?.message || 'failed');
        setErr(/permission/i.test(msg) ? 'Could not load services for this provider.' : msg);
      }
      ),
    [companyId, useCatalog]
  );

  const grouped = useMemo(() => {
    const g = { vet: [], saloon: [], hotel: [], bath: [], walker: [] };
    services.forEach((s) => {
      const k = s.type || 'vet';
      if (!g[k]) g[k] = [];
      g[k].push(s);
    });
    return g;
  }, [services]);

  const groupLabels = { vet: 'Vet', saloon: 'Grooming', hotel: 'Hotel', bath: 'Bath', walker: 'Pet walkers' };

  const groupOrder = ['vet', 'walker', 'bath', 'saloon', 'hotel'];

  if (needsLegacyRedirect) {
    return <Navigate to={`/bookings/provider/${encodeURIComponent(companyId)}`} replace />;
  }

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
          {groupOrder.map((k) =>
            grouped[k]?.length ? (
              <div key={k} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>{groupLabels[k] || k}</div>
                <div className="pp-stack">
                  {grouped[k].map((s) => (
                    <div key={s.id} className="pp-rowBetween pp-rowBetween--card">
                      <div>
                        <div style={{ fontWeight: 900 }}>{s.name}</div>
                        <div className="pp-muted" style={{ fontSize: 13 }}>
                          {s.durationMin} min {s.price ? `• ${s.price}` : ''}{' '}
                          {s.description ? `• ${s.description}` : ''}
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
