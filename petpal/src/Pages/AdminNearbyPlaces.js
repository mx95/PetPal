import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import {
  bootstrapNearbyPlacesCacheRemote,
  fetchNearbyPlacesCacheMetaRemote,
} from '../admin/nearbyPlacesCacheApi';

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

export default function AdminNearbyPlaces() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, adminReady, firebaseReady } = useCompany();
  const [meta, setMeta] = useState(null);
  const [placesApiKey, setPlacesApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const refreshMeta = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await fetchNearbyPlacesCacheMetaRemote();
      setMeta(data);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseReady || !adminReady || !isAdmin) return;
    void refreshMeta();
  }, [firebaseReady, adminReady, isAdmin, refreshMeta]);

  async function onBootstrap() {
    setBusy(true);
    setMsg('');
    setErr('');
    try {
      const result = await bootstrapNearbyPlacesCacheRemote({
        placesApiKey: placesApiKey.trim() || undefined,
      });
      setMsg(
        t('admin.nearbyPlaces.bootstrapOk', {
          tiles: result.tileCount ?? '—',
        })
      );
      setPlacesApiKey('');
      await refreshMeta();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>
        </div>
      </div>
    );
  }
  if (!adminReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-subtle">{t('admin.loading')}</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <Link className="pp-link" to="/admin">
          {t('admin.backAdminHub')}
        </Link>
        <h1 className="pp-h1" style={{ marginTop: 12 }}>
          {t('admin.nearbyPlaces.title')}
        </h1>
        <p className="pp-subtle" style={{ maxWidth: 640 }}>
          {t('admin.nearbyPlaces.lead')}
        </p>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>
            {t('admin.nearbyPlaces.statusTitle')}
          </h2>
          {loading ? <p className="pp-subtle">{t('admin.loading')}</p> : null}
          {!loading && meta ? (
            <ul className="pp-adminMetaList">
              <li>
                <strong>{t('admin.nearbyPlaces.statusLabel')}</strong> {meta.status || 'missing'}
              </li>
              <li>
                <strong>{t('admin.nearbyPlaces.lastRefresh')}</strong>{' '}
                {formatTimestamp(meta.lastRefreshAt)}
              </li>
              <li>
                <strong>{t('admin.nearbyPlaces.tileCount')}</strong> {meta.tileCount ?? '—'}
              </li>
              {meta.lastError ? (
                <li className="pp-error">
                  <strong>{t('admin.nearbyPlaces.lastError')}</strong> {meta.lastError}
                </li>
              ) : null}
            </ul>
          ) : null}
          {err ? <p className="pp-error">{err}</p> : null}
          {msg ? <p className="pp-success">{msg}</p> : null}
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>
            {t('admin.nearbyPlaces.bootstrapTitle')}
          </h2>
          <p className="pp-subtle">{t('admin.nearbyPlaces.bootstrapLead')}</p>
          <label className="pp-field">
            <span className="pp-field__label">{t('admin.nearbyPlaces.keyLabel')}</span>
            <input
              className="pp-input"
              type="password"
              autoComplete="off"
              placeholder={t('admin.nearbyPlaces.keyPlaceholder')}
              value={placesApiKey}
              disabled={busy}
              onChange={(e) => setPlacesApiKey(e.target.value)}
            />
            <span className="pp-subtle pp-field__hint">{t('admin.nearbyPlaces.keyHint')}</span>
          </label>
          <div className="pp-row" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" className="pp-btn pp-btn--primary" disabled={busy} onClick={() => void onBootstrap()}>
              {busy ? t('admin.nearbyPlaces.bootstrapBusy') : t('admin.nearbyPlaces.bootstrapCta')}
            </button>
            <button type="button" className="pp-btn pp-btn--ghost" disabled={loading} onClick={() => void refreshMeta()}>
              {t('admin.nearbyPlaces.refreshStatus')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
