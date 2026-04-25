import React, { useCallback, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import PositionMap from '../tracking/PositionMap';
import { getLatestPosition, getTrackingDataSource, mapsLink } from '../tracking/traccarClient';

const STORAGE_KEY = 'petpal_traccar_device_id';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function Tracking() {
  const fieldId = useId();
  const dataSource = getTrackingDataSource();
  const dataSourceLabel = {
    bff: 'Backend (BFF)',
    traccar: 'Traccar API',
    mock: 'Mock (add REACT_APP_TRACKING_BFF_URL or REACT_APP_TRACCAR_BASE_URL)',
  }[dataSource];
  const [deviceId, setDeviceId] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const p = await getLatestPosition(deviceId);
      setPosition(p);
    } catch (e) {
      setPosition(null);
      setError(e?.message || 'Could not load position.');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  function saveIdAndLoad(e) {
    e?.preventDefault();
    localStorage.setItem(STORAGE_KEY, deviceId.trim());
    void refresh();
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div className="pp-badge">GPS tracker (Traccar)</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              Live position
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 720 }}>
              Connect any cellular GPS device supported by Traccar. Prefer a small <strong>backend</strong>{' '}
              (<code style={{ fontSize: 12 }}>REACT_APP_TRACKING_BFF_URL</code>) that proxies Traccar so you
              avoid CORS and keep secrets server-side. Otherwise the app can call Traccar directly when CORS
              allows, or use a <strong>mock</strong> point for UI development.
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Device</h2>
          <p className="pp-subtle" style={{ marginBottom: 12, fontSize: 14 }}>
            Use the device id from your Traccar web UI (or whatever your BFF maps to). Data source:{' '}
            <strong>{dataSourceLabel}</strong>
          </p>
          <form className="pp-form" onSubmit={saveIdAndLoad}>
            <div>
              <label className="pp-label" htmlFor={fieldId}>
                Traccar device ID
              </label>
              <input
                id={fieldId}
                className="pp-input"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="e.g. 1"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            {error ? <div className="pp-error">{error}</div> : null}
            <div className="pp-row" style={{ justifyContent: 'space-between' }}>
              <button className="pp-btn pp-btnPrimary" type="submit" disabled={loading || !deviceId.trim()}>
                {loading ? 'Refreshing…' : 'Load / refresh'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Last fix</h2>
          {!position && !error ? (
            <p className="pp-subtle">Enter a device id and load to see coordinates.</p>
          ) : null}
          {position ? (
            <div className="pp-form" style={{ gap: 8 }}>
              <div>
                <div className="pp-label">Latitude / longitude</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                </div>
              </div>
              {position.speed != null ? (
                <div>
                  <div className="pp-label">Speed (from device)</div>
                  <div style={{ fontWeight: 800 }}>{Number(position.speed).toFixed(1)} m/s</div>
                </div>
              ) : null}
              <div>
                <div className="pp-label">Device time</div>
                <div>{formatTime(position.deviceTime)}</div>
              </div>
              {position.address ? (
                <div>
                  <div className="pp-label">Address (if any)</div>
                  <div>{position.address}</div>
                </div>
              ) : null}
              <div>
                <div className="pp-label">Source</div>
                <div style={{ textTransform: 'capitalize' }}>{position.source}</div>
              </div>
              <a
                className="pp-link"
                href={mapsLink(position.lat, position.lng)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 800 }}
              >
                Open in Google Maps ↗
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {position ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad">
            <h2 className="pp-sectionTitle">Map</h2>
            <p className="pp-subtle" style={{ marginBottom: 12, fontSize: 14 }}>
              Tiles: OpenStreetMap (attribution in-map).
            </p>
            <PositionMap lat={position.lat} lng={position.lng} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
