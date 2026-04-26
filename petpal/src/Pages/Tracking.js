import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PositionMap from '../tracking/PositionMap';
import { usePets } from '../pets/PetsContext';
import { getLatestPosition, getTrackingDataSource, mapsLink } from '../tracking/traccarClient';

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
  const { pets, getCategory, updatePet } = usePets();
  const dataSource = getTrackingDataSource();
  const dataSourceLabel = {
    bff: 'Backend (BFF)',
    traccar: 'Traccar API',
    mock: 'Mock (add REACT_APP_TRACKING_BFF_URL or REACT_APP_TRACCAR_BASE_URL)',
  }[dataSource];

  const [selectedPetId, setSelectedPetId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedPet = useMemo(() => pets.find((p) => p.id === selectedPetId), [pets, selectedPetId]);

  useEffect(() => {
    if (pets.length === 0) {
      setSelectedPetId('');
      return;
    }
    setSelectedPetId((cur) => (cur && pets.some((p) => p.id === cur) ? cur : pets[0].id));
  }, [pets]);

  useEffect(() => {
    if (!selectedPetId) {
      setDeviceId('');
      return;
    }
    const p = pets.find((x) => x.id === selectedPetId);
    setDeviceId(p?.trackingDeviceId || '');
  }, [selectedPetId, pets]);

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
    if (selectedPetId) {
      updatePet(selectedPetId, { trackingDeviceId: deviceId.trim() || null });
    }
    void refresh();
  }

  if (pets.length === 0) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <div className="pp-card pp-pad">
            <div className="pp-badge">GPS tracker (Traccar)</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              Add a pet first
            </h1>
            <p className="pp-subtle" style={{ marginBottom: 16 }}>
              Register at least one pet, then link a Traccar device id to the pet you want to track.
            </p>
            <Link className="pp-btn pp-btnPrimary" to="/pets" style={{ textDecoration: 'none', display: 'inline-block' }}>
              My pets
            </Link>
          </div>
        </div>
      </div>
    );
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
              Pick which pet this device belongs to, then load the latest fix. Pets can exist without a
              device — link one here when you&apos;re ready.
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Pet &amp; device</h2>
          <p className="pp-subtle" style={{ marginBottom: 12, fontSize: 14 }}>
            Data source: <strong>{dataSourceLabel}</strong>
          </p>
          <div className="pp-form" style={{ marginBottom: 12 }}>
            <div>
              <div className="pp-label">Pet using this tracker</div>
              <select
                className="pp-input"
                value={selectedPetId}
                onChange={(e) => setSelectedPetId(e.target.value)}
              >
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getCategory(p).emoji} {p.name}
                    {p.trackingDeviceId ? ` (device #${p.trackingDeviceId})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
            {selectedPet ? (
              <p className="pp-subtle" style={{ fontSize: 13, margin: 0 }}>
                Saving writes this id to <strong>{selectedPet.name}</strong> so the map matches the right
                pet.
              </p>
            ) : null}
            {error ? <div className="pp-error">{error}</div> : null}
            <div className="pp-row" style={{ justifyContent: 'space-between' }}>
              <button className="pp-btn pp-btnPrimary" type="submit" disabled={loading || !deviceId.trim()}>
                {loading ? 'Refreshing…' : 'Save & load / refresh'}
              </button>
              <Link className="pp-link" to="/pets">
                Manage pets
              </Link>
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
