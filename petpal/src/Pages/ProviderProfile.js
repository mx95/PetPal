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
import { useI18n } from '../i18n/I18nContext';

export default function ProviderProfile() {
  const { t } = useI18n();
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
      (e) => setErr(e?.message || t('common.errorGeneric'))
    );
  }, [companyId, useCatalog, t]);

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
        const msg = String(e?.message || t('common.errorGeneric'));
        setErr(/permission/i.test(msg) ? t('bookingsHub.providerServicesLoadError') : msg);
      }
      ),
    [companyId, useCatalog, t]
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

  const groupLabels = useMemo(
    () => ({
      vet: t('bookingsHub.tabVet'),
      saloon: t('bookingsHub.tabGroom'),
      hotel: t('bookingsHub.tabHotel'),
      bath: t('bookingsHub.tabBath'),
      walker: t('bookingsHub.tabWalker'),
    }),
    [t]
  );

  const groupOrder = ['vet', 'walker', 'bath', 'saloon', 'hotel'];

  if (needsLegacyRedirect) {
    return <Navigate to={`/bookings/provider/${encodeURIComponent(companyId)}`} replace />;
  }

  return (
    <div className="pp-pad">
      <div className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <div className="pp-badge">{t('bookConfirm.providerLabel')}</div>
          <div className="pp-pageHeader__title">{provider?.displayName || t('bookConfirm.providerLabel')}</div>
          <div className="pp-pageHeader__subtitle">
            {provider?.address || ''} {provider?.phone ? `• ${provider.phone}` : ''}
          </div>
        </div>
      </div>

      {err ? <div className="pp-error">{err}</div> : null}

      <div className="pp-card" style={{ marginTop: 14 }}>
        <div className="pp-card__title">{t('providerPortal.servicesTitle')}</div>
        {services.length === 0 ? <div className="pp-muted">{t('bookingsHub.providerNoServicesPublished')}</div> : null}

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
                          {t('bookConfirm.mins', { n: s.durationMin })} {s.price ? `• ${s.price}` : ''}{' '}
                          {s.description ? `• ${s.description}` : ''}
                        </div>
                      </div>
                      <Link className="pp-btn pp-btn--primary" to={`/bookings/provider/${companyId}/book/${s.id}`}>
                        {t('bookingsHub.bookServiceCta')}
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
