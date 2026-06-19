import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import {
  GPSPOS_POLL_PRESETS,
  PROTOCOL_OPTIONS,
  PROVIDER_OPTIONS,
  isTrackerAdminApiAvailable,
  listAdminDevices,
  patchAdminDevice,
} from '../tracking/adminDeviceApi';
import { fetchImeiPetLinks } from '../tracking/imeiPetLinks';
import { normalizeTrackerImei } from '../tracking/trackerImeiIndex';

function providerLabel(id) {
  const opt = PROVIDER_OPTIONS.find((p) => p.id === id);
  return opt?.label || id;
}

function formatInterval(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 60) return `${n}s`;
  if (n < 3600) return `${Math.round(n / 60)} min`;
  return `${Math.round(n / 3600)} h`;
}

export default function AdminDeviceRegistry() {
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();

  const [devices, setDevices] = useState([]);
  const [defaults, setDefaults] = useState({ gpsposPollIntervalSec: 60 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busyImei, setBusyImei] = useState('');
  const [search, setSearch] = useState('');

  const [newImei, setNewImei] = useState('');
  const [newProtocol, setNewProtocol] = useState('g365');
  const [drafts, setDrafts] = useState({});
  const [petLinks, setPetLinks] = useState({});
  const [petLinksLoading, setPetLinksLoading] = useState(false);
  const [petLinksError, setPetLinksError] = useState('');

  const apiReady = useMemo(() => isTrackerAdminApiAvailable(), []);

  const load = useCallback(async () => {
    if (!apiReady) {
      setLoading(false);
      return;
    }
    setErr('');
    try {
      const data = await listAdminDevices();
      setDevices(Array.isArray(data?.devices) ? data.devices : []);
      if (data?.defaults) setDefaults(data.defaults);
    } catch (e) {
      setErr(e?.message || 'Failed to load devices.');
    } finally {
      setLoading(false);
    }
  }, [apiReady]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!devices.length) {
      setPetLinks({});
      return;
    }
    let cancelled = false;
    setPetLinksLoading(true);
    setPetLinksError('');
    void fetchImeiPetLinks(devices.map((d) => d.imei))
      .then((map) => {
        if (!cancelled) setPetLinks(map);
      })
      .catch((e) => {
        if (!cancelled) {
          setPetLinks({});
          setPetLinksError(e?.message || 'Could not load app pet links.');
        }
      })
      .finally(() => {
        if (!cancelled) setPetLinksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [devices]);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...devices].sort((a, b) => String(a.imei).localeCompare(String(b.imei)));
    if (!q) return list;
    return list.filter((d) => String(d.imei || '').includes(q));
  }, [devices, search]);

  function draftFor(device) {
    const imei = device.imei;
    if (drafts[imei]) return drafts[imei];
    const override = device.providerOverride;
    const providerId =
      override === 'g365' || override === 'gpspos' ? override : 'auto';
    return {
      providerId,
      gpsposPlatformImei: device.gpsposPlatformImei || '',
      gpsposPollEnabled: Boolean(device.gpsposPollEnabled),
      gpsposPollIntervalSec:
        device.gpsposPollIntervalSec ?? defaults.gpsposPollIntervalSec ?? 60,
    };
  }

  function updateDraft(imei, patch) {
    const device = devices.find((d) => d.imei === imei);
    if (!device) return;
    setDrafts((prev) => ({
      ...prev,
      [imei]: { ...draftFor(device), ...prev[imei], ...patch },
    }));
  }

  async function saveDevice(imei) {
    const device = devices.find((d) => d.imei === imei);
    if (!device) return;
    const draft = { ...draftFor(device), ...drafts[imei] };
    const providerOpt = PROVIDER_OPTIONS.find((p) => p.id === draft.providerId);
    const patch = {
      providerOverride: providerOpt?.value ?? null,
      gpsposPlatformImei: draft.gpsposPlatformImei?.trim() || null,
      gpsposPollEnabled: draft.gpsposPollEnabled,
      gpsposPollIntervalSec: Number(draft.gpsposPollIntervalSec) || defaults.gpsposPollIntervalSec,
    };

    setBusyImei(imei);
    setErr('');
    setOk('');
    try {
      const data = await patchAdminDevice(imei, patch);
      if (data?.device) {
        setDevices((prev) => {
          const next = prev.filter((d) => d.imei !== imei);
          return [...next, data.device].sort((a, b) => String(a.imei).localeCompare(String(b.imei)));
        });
      }
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[imei];
        return copy;
      });
      setOk(`Saved ${imei}. Link the same IMEI on My pets for users to see it in Tracker.`);
    } catch (e) {
      setErr(e?.message || 'Save failed.');
    } finally {
      setBusyImei('');
    }
  }

  async function addDevice(e) {
    e.preventDefault();
    const imei = String(newImei || '').trim();
    if (!/^\d{10,20}$/.test(imei)) {
      setErr('Enter a valid IMEI (10–20 digits).');
      return;
    }
    const protocolOpt = PROTOCOL_OPTIONS.find((p) => p.id === newProtocol);
    if (!protocolOpt) {
      setErr('Choose a protocol.');
      return;
    }

    setBusyImei(imei);
    setErr('');
    setOk('');
    try {
      await patchAdminDevice(imei, {
        providerOverride: protocolOpt.value,
        gpsposPollEnabled: protocolOpt.value === 'gpspos',
        gpsposPollIntervalSec: defaults.gpsposPollIntervalSec ?? 60,
      });
      setNewImei('');
      await load();
      setOk(
        `Added ${imei} as ${protocolOpt.label}. Users must also enter this IMEI on My pets → edit pet → GPS device.`
      );
    } catch (e) {
      setErr(e?.message || 'Could not add device.');
    } finally {
      setBusyImei('');
    }
  }

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
              Device registry
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 760 }}>
              View every IMEI on the tracker server, register new collars, and assign <strong>365GPS</strong> or{' '}
              <strong>GPSPOS</strong>. After saving here, link the same IMEI on each pet under My pets so it appears in
              Tracker.
            </p>
          </div>
          <Link className="pp-link" to="/admin">
            ← Admin hub
          </Link>
        </div>
      </div>

      {!apiReady ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad">
            <p className="pp-error">
              Tracker admin API is not configured. Set <code>REACT_APP_XEXUN_HTTP_BASE_URL</code> (or{' '}
              <code>same</code>) and <code>REACT_APP_TRACKER_ADMIN_TOKEN</code> matching server{' '}
              <code>TRACKER_ADMIN_TOKEN</code>, then rebuild the app.
            </p>
          </div>
        </div>
      ) : null}

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <h2 className="pp-h2" style={{ marginTop: 0 }}>
            Add IMEI
          </h2>
          <form
            className="pp-adminDeviceCard__grid"
            style={{ alignItems: 'flex-end' }}
            onSubmit={(e) => void addDevice(e)}
          >
            <label className="pp-field">
              <span className="pp-field__label">IMEI</span>
              <input
                className="pp-input"
                inputMode="numeric"
                value={newImei}
                onChange={(e) => setNewImei(e.target.value)}
                placeholder="861261021497967"
                disabled={!apiReady || Boolean(busyImei)}
                list="admin-imei-suggestions"
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Protocol</span>
              <select
                className="pp-input"
                value={newProtocol}
                onChange={(e) => setNewProtocol(e.target.value)}
                disabled={!apiReady || Boolean(busyImei)}
              >
                {PROTOCOL_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="pp-btn pp-btnPrimary" disabled={!apiReady || Boolean(busyImei)}>
              Add device
            </button>
          </form>
        </div>
      </div>

      {err ? (
        <div className="pp-col-12">
          <p className="pp-error" role="alert">
            {err}
          </p>
        </div>
      ) : null}
      {ok ? (
        <div className="pp-col-12">
          <p className="pp-trackDevicePanel__status" role="status">
            {ok}
          </p>
        </div>
      ) : null}

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2 className="pp-h2" style={{ margin: 0 }}>
              All devices ({devices.length})
            </h2>
            <label className="pp-field" style={{ margin: 0, minWidth: 220 }}>
              <span className="pp-field__label">Search IMEI</span>
              <input
                className="pp-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="861261…"
                disabled={loading}
              />
            </label>
          </div>

          {loading ? <p className="pp-subtle">Loading…</p> : null}
          {!loading && devices.length === 0 ? (
            <p className="pp-subtle">No devices yet. Add an IMEI above or wait for a collar to check in.</p>
          ) : null}
          {!loading && devices.length > 0 && filteredDevices.length === 0 ? (
            <p className="pp-subtle">No IMEI matches your search.</p>
          ) : null}

          <div className="pp-adminDeviceList">
            {filteredDevices.map((device) => {
              const draft = draftFor(device);
              const isGpspos = draft.providerId === 'gpspos';
              const saving = busyImei === device.imei;
              const hasFix = Boolean(device.lastUpdate);
              const imeiKey = normalizeTrackerImei(device.imei);
              const links = petLinks[imeiKey] || [];
              return (
                <article key={device.imei} className="pp-adminDeviceCard">
                  <header className="pp-adminDeviceCard__head">
                    <div>
                      <code className="pp-docsCode">{device.imei}</code>
                      {device.name ? <span className="pp-subtle"> — {device.name}</span> : null}
                    </div>
                    <div className="pp-adminDeviceCard__meta pp-subtle">
                      Protocol: <strong>{device.effectiveProvider || 'unknown'}</strong>
                      {device.observedProvider && device.observedProvider !== device.effectiveProvider ? (
                        <span> (observed: {device.observedProvider})</span>
                      ) : null}
                      <span> · {hasFix ? `Last fix ${device.lastUpdate}` : 'No position yet'}</span>
                    </div>
                    <div className="pp-adminDeviceCard__owner">
                      {petLinksLoading ? (
                        <span className="pp-subtle">Checking app links…</span>
                      ) : petLinksError ? (
                        <span className="pp-subtle" style={{ color: '#b42318' }}>
                          {petLinksError}
                        </span>
                      ) : links.length ? (
                        links.map((link) => (
                          <div key={`${link.uid}-${link.petId}`} className="pp-adminDeviceCard__ownerRow">
                            <span className="pp-adminDeviceCard__ownerBadge">Linked in app</span>
                            <span>
                              {link.petName ? `${link.petName} · ` : ''}
                              <code>{link.uid}</code>
                              {link.email ? (
                                <>
                                  {' · '}
                                  <a className="pp-link" href={`mailto:${link.email}`}>
                                    {link.email}
                                  </a>
                                </>
                              ) : (
                                <span className="pp-subtle"> · no email on profile</span>
                              )}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="pp-subtle">Not linked to any user — assign on My pets.</span>
                      )}
                    </div>
                  </header>

                  <div className="pp-adminDeviceCard__grid">
                    <label className="pp-field">
                      <span className="pp-field__label">Protocol</span>
                      <select
                        className="pp-input"
                        value={draft.providerId}
                        onChange={(e) => updateDraft(device.imei, { providerId: e.target.value })}
                        disabled={saving}
                      >
                        {PROVIDER_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {providerLabel(opt.id)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {isGpspos ? (
                      <>
                        <label className="pp-field">
                          <span className="pp-field__label">GPSPOS platform ID (optional)</span>
                          <input
                            className="pp-input"
                            value={draft.gpsposPlatformImei}
                            onChange={(e) => updateDraft(device.imei, { gpsposPlatformImei: e.target.value })}
                            placeholder="If different from IMEI suffix"
                            disabled={saving}
                          />
                        </label>

                        <label className="pp-field pp-field--checkbox">
                          <input
                            type="checkbox"
                            checked={draft.gpsposPollEnabled}
                            onChange={(e) => updateDraft(device.imei, { gpsposPollEnabled: e.target.checked })}
                            disabled={saving}
                          />
                          <span>Enable automatic cloud polling</span>
                        </label>

                        <label className="pp-field">
                          <span className="pp-field__label">Poll every</span>
                          <select
                            className="pp-input"
                            value={String(draft.gpsposPollIntervalSec)}
                            onChange={(e) =>
                              updateDraft(device.imei, { gpsposPollIntervalSec: Number(e.target.value) })
                            }
                            disabled={saving || !draft.gpsposPollEnabled}
                          >
                            {GPSPOS_POLL_PRESETS.map(({ id, seconds }) => (
                              <option key={id} value={seconds}>
                                {formatInterval(seconds)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : null}
                  </div>

                  <div className="pp-adminDeviceCard__actions">
                    <button
                      type="button"
                      className="pp-btn pp-btnPrimary"
                      disabled={saving}
                      onClick={() => void saveDevice(device.imei)}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
