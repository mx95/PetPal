import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import PositionMap from '../tracking/PositionMap';
import {
  getLatestPositionWithSync,
  getPositionHistory,
  mapsLink,
} from '../tracking/petpalVendorClient';
import { normalizeTrackerImei } from '../tracking/trackerImeiIndex';

const HISTORY_DAYS = 14;
const HISTORY_LIMIT = 2000;
const HISTORY_MAP_MAX = 800;

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function osmEmbedUrl(lat, lng) {
  const pad = 0.01;
  const left = lng - pad;
  const right = lng + pad;
  const top = lat + pad;
  const bottom = lat - pad;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function historyRangeIso(days) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function downsamplePath(points, maxPoints) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const out = [points[0]];
  const last = points.length - 1;
  const step = last / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i += 1) {
    out.push(points[Math.min(last, Math.round(i * step))]);
  }
  if (last > 0) out.push(points[last]);
  return out;
}

function hasRealHomePin(position) {
  const lat = Number(position?.homeLat);
  const lng = Number(position?.homeLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001;
}

export default function AdminTrackerLocation() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, adminReady, firebaseReady } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialImei = normalizeTrackerImei(searchParams.get('imei') || '') || '';

  const [imeiInput, setImeiInput] = useState(initialImei);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [position, setPosition] = useState(null);
  const [history, setHistory] = useState([]);
  const [lookedUpImei, setLookedUpImei] = useState('');

  const lookup = useCallback(
    async (rawImei) => {
      const imei = normalizeTrackerImei(rawImei) || String(rawImei || '').trim();
      if (!/^\d{10,20}$/.test(imei)) {
        setErr(t('adminTrackerLocation.errImei'));
        return;
      }
      setBusy(true);
      setErr('');
      setPosition(null);
      setHistory([]);
      setLookedUpImei(imei);
      setSearchParams({ imei }, { replace: true });
      const range = historyRangeIso(HISTORY_DAYS);
      try {
        const [pos, histRes] = await Promise.all([
          getLatestPositionWithSync(imei),
          getPositionHistory(imei, { limit: HISTORY_LIMIT, from: range.from, to: range.to }),
        ]);
        const hist = Array.isArray(histRes?.history)
          ? histRes.history
          : Array.isArray(histRes)
            ? histRes
            : [];
        setPosition(pos);
        setHistory(hist);
        if (!pos || !Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lng))) {
          setErr(t('adminTrackerLocation.errNoPosition'));
        }
      } catch (e) {
        setErr(e?.message || t('adminTrackerLocation.errLookup'));
      } finally {
        setBusy(false);
      }
    },
    [setSearchParams, t]
  );

  useEffect(() => {
    if (initialImei && /^\d{10,20}$/.test(initialImei)) {
      void lookup(initialImei);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lookup once from URL
  }, []);

  const historyPoints = useMemo(
    () =>
      history.filter(
        (row) => Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))
      ),
    [history]
  );

  const historyMapPath = useMemo(() => {
    const pts = historyPoints.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    return downsamplePath(pts, HISTORY_MAP_MAX);
  }, [historyPoints]);

  const historyStart = historyPoints[0] || null;
  const historyEnd = historyPoints.length ? historyPoints[historyPoints.length - 1] : null;

  const historyRouteMarkers = useMemo(() => {
    if (!historyStart || !historyEnd) return [];
    const markers = [
      {
        id: 'start',
        lat: Number(historyStart.lat),
        lng: Number(historyStart.lng),
        kind: 'start',
        label: t('adminTrackerLocation.routeStart'),
      },
    ];
    if (
      historyPoints.length > 1 &&
      (Number(historyStart.lat) !== Number(historyEnd.lat) ||
        Number(historyStart.lng) !== Number(historyEnd.lng))
    ) {
      markers.push({
        id: 'end',
        lat: Number(historyEnd.lat),
        lng: Number(historyEnd.lng),
        kind: 'end',
        label: t('adminTrackerLocation.routeEnd'),
      });
    }
    return markers;
  }, [historyStart, historyEnd, historyPoints.length, t]);

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) return <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>;
  if (!adminReady) return <p className="pp-subtle">{t('admin.loading')}</p>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const hasCoords =
    position && Number.isFinite(Number(position.lat)) && Number.isFinite(Number(position.lng));
  const showHistoryMap = historyMapPath.length > 0;

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <Link className="pp-link" to="/admin">
          {t('admin.backAdminHub')}
        </Link>
        <h1 className="pp-h1" style={{ marginTop: 10 }}>
          {t('adminTrackerLocation.title')}
        </h1>
        <p className="pp-subtle" style={{ maxWidth: 720 }}>
          {t('adminTrackerLocation.intro')}
        </p>
      </div>

      <div className="pp-col-12">
        <form
          className="pp-card"
          style={{ padding: 16, maxWidth: 640 }}
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(imeiInput);
          }}
        >
          <label className="pp-field">
            <span className="pp-label">{t('adminTrackerLocation.imeiLabel')}</span>
            <input
              type="text"
              inputMode="numeric"
              value={imeiInput}
              disabled={busy}
              onChange={(e) => setImeiInput(e.target.value.trim())}
              placeholder={t('adminTrackerLocation.imeiPlaceholder')}
              autoComplete="off"
              required
            />
          </label>
          <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="submit" className="pp-btn pp-btn--primary" disabled={busy || !imeiInput}>
              {busy ? t('adminTrackerLocation.lookingUp') : t('adminTrackerLocation.lookup')}
            </button>
            <Link className="pp-btn pp-btn--ghost" to="/admin/devices">
              {t('adminTrackerLocation.openRegistry')}
            </Link>
          </div>
        </form>
      </div>

      {err ? (
        <div className="pp-col-12">
          <div className="pp-error">{err}</div>
        </div>
      ) : null}

      {hasCoords ? (
        <div className="pp-col-12">
          <div className="pp-card" style={{ padding: 16 }}>
            <h2 className="pp-h2" style={{ marginTop: 0 }}>
              {t('adminTrackerLocation.resultTitle', { imei: lookedUpImei })}
            </h2>
            <dl className="pp-adminTrackerLoc__meta">
              <div>
                <dt>{t('adminTrackerLocation.coords')}</dt>
                <dd>
                  {Number(position.lat).toFixed(6)}, {Number(position.lng).toFixed(6)}
                </dd>
              </div>
              <div>
                <dt>{t('adminTrackerLocation.updated')}</dt>
                <dd>{formatWhen(position.serverTime || position.deviceTime || position.lastUpdate)}</dd>
              </div>
              <div>
                <dt>{t('adminTrackerLocation.source')}</dt>
                <dd>
                  {position.source || '—'}
                  {position.accuracy ? ` · ${position.accuracy}` : ''}
                  {position.warningApproximate || position.source === 'lbs'
                    ? ` (${t('adminTrackerLocation.approximate')})`
                    : ''}
                </dd>
              </div>
              <div>
                <dt>{t('adminTrackerLocation.battery')}</dt>
                <dd>{position.battery != null ? `${position.battery}%` : '—'}</dd>
              </div>
              <div>
                <dt>{t('adminTrackerLocation.signal')}</dt>
                <dd>{position.signal != null ? `${position.signal}%` : '—'}</dd>
              </div>
              <div>
                <dt>{t('adminTrackerLocation.freshness')}</dt>
                <dd>
                  {position.statusText || position.freshness || '—'}
                  {position.secondsAgo != null
                    ? ` · ${t('adminTrackerLocation.secondsAgo', { n: position.secondsAgo })}`
                    : ''}
                </dd>
              </div>
              {hasRealHomePin(position) ? (
                <div>
                  <dt>{t('adminTrackerLocation.homePin')}</dt>
                  <dd>
                    {Number(position.homeLat).toFixed(6)}, {Number(position.homeLng).toFixed(6)}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <a
                className="pp-btn pp-btn--primary"
                href={mapsLink(position.lat, position.lng)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('adminTrackerLocation.openMaps')}
              </a>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                disabled={busy}
                onClick={() => void lookup(lookedUpImei)}
              >
                {t('adminTrackerLocation.refresh')}
              </button>
              {showHistoryMap ? (
                <a className="pp-btn pp-btn--ghost" href="#admin-history-map">
                  {t('adminTrackerLocation.jumpHistoryMap')}
                </a>
              ) : null}
            </div>

            <div className="pp-adminTrackerLoc__mapWrap">
              <iframe
                title={t('adminTrackerLocation.mapTitle')}
                className="pp-adminTrackerLoc__map"
                src={osmEmbedUrl(Number(position.lat), Number(position.lng))}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      ) : null}

      {showHistoryMap ? (
        <div className="pp-col-12" id="admin-history-map">
          <div className="pp-card" style={{ padding: 16 }}>
            <h2 className="pp-h2" style={{ marginTop: 0 }}>
              {t('adminTrackerLocation.historyMapTitle', { count: historyPoints.length })}
            </h2>
            <p className="pp-subtle" style={{ marginTop: 0 }}>
              {t('adminTrackerLocation.historyMapIntro', { days: HISTORY_DAYS })}
            </p>
            {historyStart && historyEnd ? (
              <p className="pp-subtle" style={{ marginTop: 4 }}>
                {t('adminTrackerLocation.historyMapRange', {
                  from: formatWhen(historyStart.receivedAt || historyStart.timestamp),
                  to: formatWhen(historyEnd.receivedAt || historyEnd.timestamp),
                })}
              </p>
            ) : null}
            <div className="pp-adminTrackerLoc__historyMap">
              <PositionMap
                fill
                showRouteVertices
                mapActive={showHistoryMap}
                lat={Number(historyEnd.lat)}
                lng={Number(historyEnd.lng)}
                path={historyMapPath.length > 1 ? historyMapPath : []}
                fitPath={historyMapPath.length > 1 ? historyMapPath : undefined}
                fitMaxZoom={16}
                routeMarkers={historyRouteMarkers}
                accuracyM={historyMapPath.length <= 1 ? 45 : null}
              />
            </div>
          </div>
        </div>
      ) : lookedUpImei && !busy ? (
        <div className="pp-col-12">
          <div className="pp-card" style={{ padding: 16 }}>
            <h2 className="pp-h2" style={{ marginTop: 0 }}>
              {t('adminTrackerLocation.historyMapTitle', { count: 0 })}
            </h2>
            <p className="pp-subtle">{t('adminTrackerLocation.historyMapEmpty')}</p>
          </div>
        </div>
      ) : null}

      {history.length ? (
        <div className="pp-col-12">
          <div className="pp-card" style={{ padding: 0, overflow: 'auto' }}>
            <h2 className="pp-h2" style={{ margin: '16px 16px 8px' }}>
              {t('adminTrackerLocation.historyTitle', { count: history.length })}
            </h2>
            <table className="pp-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t('adminTrackerLocation.colWhen')}</th>
                  <th>{t('adminTrackerLocation.colCoords')}</th>
                  <th>{t('adminTrackerLocation.colSource')}</th>
                  <th>{t('adminTrackerLocation.colBattery')}</th>
                  <th>{t('adminTrackerLocation.colMap')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, idx) => (
                  <tr key={row.id || `${row.receivedAt}-${idx}`}>
                    <td>{formatWhen(row.receivedAt || row.deviceTime || row.timestamp)}</td>
                    <td>
                      {Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))
                        ? `${Number(row.lat).toFixed(5)}, ${Number(row.lng).toFixed(5)}`
                        : '—'}
                    </td>
                    <td>
                      {row.source || '—'}
                      {row.accuracy ? ` · ${row.accuracy}` : ''}
                    </td>
                    <td>{row.battery != null ? `${row.battery}%` : '—'}</td>
                    <td>
                      {Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng)) ? (
                        <a
                          className="pp-link"
                          href={mapsLink(row.lat, row.lng)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('adminTrackerLocation.openMaps')}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
