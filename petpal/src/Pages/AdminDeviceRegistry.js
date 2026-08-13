import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import {
  GPSPOS_POLL_PRESETS,
  PROTOCOL_OPTIONS,
  PROVIDER_OPTIONS,
  clearAdminDeviceHistory,
  deleteAdminDevice,
  isTrackerAdminApiAvailable,
  listAdminDevices,
  patchAdminDevice,
} from '../tracking/adminDeviceApi';
import { fetchImeiPetLinks } from '../tracking/imeiPetLinks';
import { normalizeTrackerImei } from '../tracking/trackerImeiIndex';
import { useI18n } from '../i18n/I18nContext';

function protocolLabel(id, t) {
  if (id === 'g365') return t('admin.devices.protocolG365');
  if (id === 'gt06') return t('admin.devices.protocolGt06');
  if (id === 'gpspos') return t('admin.devices.protocolGpspos');
  return id;
}

function providerLabel(id, t) {
  if (id === 'auto') return t('admin.devices.providerAuto');
  return protocolLabel(id, t);
}

function formatInterval(sec, t) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 60) return t('admin.devices.intervalSeconds', { n });
  if (n < 3600) return t('admin.devices.intervalMinutes', { n: Math.round(n / 60) });
  return t('admin.devices.intervalHours', { n: Math.round(n / 3600) });
}

export default function AdminDeviceRegistry() {
  const { t } = useI18n();
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
  const [newEmnifyCard, setNewEmnifyCard] = useState('');
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
      setErr(e?.message || t('admin.devices.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [apiReady, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!devices.length || !user) {
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
          setPetLinksError(e?.message || t('admin.devices.errPetLinks'));
        }
      })
      .finally(() => {
        if (!cancelled) setPetLinksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [devices, user, t]);

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...devices].sort((a, b) => String(a.imei).localeCompare(String(b.imei)));
    if (!q) return list;
    return list.filter((d) => {
      const imei = String(d.imei || '').toLowerCase();
      const card = String(d.emnifyCard || '').toLowerCase();
      return imei.includes(q) || card.includes(q);
    });
  }, [devices, search]);

  function draftFor(device) {
    const override = device.providerOverride;
    const providerId =
      override === 'g365' || override === 'gpspos' ? override : 'auto';
    const base = {
      providerId,
      gpsposPlatformImei: device.gpsposPlatformImei || '',
      gpsposPollEnabled: Boolean(device.gpsposPollEnabled),
      gpsposPollIntervalSec:
        device.gpsposPollIntervalSec ?? defaults.gpsposPollIntervalSec ?? 60,
      emnifyCard: device.emnifyCard || '',
    };
    return drafts[device.imei] ? { ...base, ...drafts[device.imei] } : base;
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
      emnifyCard: draft.emnifyCard?.trim() || null,
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
      setOk(t('admin.devices.saved', { imei }));
    } catch (e) {
      setErr(e?.message || t('admin.devices.errSave'));
    } finally {
      setBusyImei('');
    }
  }

  async function addDevice(e) {
    e.preventDefault();
    const imei = String(newImei || '').trim();
    if (!/^\d{10,20}$/.test(imei)) {
      setErr(t('admin.devices.errValidImei'));
      return;
    }
    const protocolOpt = PROTOCOL_OPTIONS.find((p) => p.id === newProtocol);
    if (!protocolOpt) {
      setErr(t('admin.devices.errChooseProtocol'));
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
        emnifyCard: newEmnifyCard.trim() || null,
      });
      setNewImei('');
      setNewEmnifyCard('');
      await load();
      setOk(t('admin.devices.added', { imei, protocol: protocolLabel(protocolOpt.id, t) }));
    } catch (e) {
      setErr(e?.message || t('admin.devices.errAdd'));
    } finally {
      setBusyImei('');
    }
  }

  async function removeDevice(imei) {
    const okConfirm = window.confirm(t('admin.devices.confirmRemove', { imei }));
    if (!okConfirm) return;

    setBusyImei(imei);
    setErr('');
    setOk('');
    try {
      await deleteAdminDevice(imei);
      setDevices((prev) => prev.filter((d) => d.imei !== imei));
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[imei];
        return copy;
      });
      setOk(t('admin.devices.removed', { imei }));
    } catch (e) {
      setErr(e?.message || t('admin.devices.errRemove'));
    } finally {
      setBusyImei('');
    }
  }

  async function clearHistory(imei) {
    const okConfirm = window.confirm(t('admin.devices.confirmClearHistory', { imei }));
    if (!okConfirm) return;

    setBusyImei(imei);
    setErr('');
    setOk('');
    try {
      const data = await clearAdminDeviceHistory(imei);
      const deleted = Number(data?.deleted);
      setDevices((prev) =>
        prev.map((d) =>
          d.imei === imei
            ? {
                ...d,
                lastUpdate: null,
              }
            : d
        )
      );
      setOk(
        Number.isFinite(deleted)
          ? t('admin.devices.clearedHistoryCount', { imei, count: deleted })
          : t('admin.devices.clearedHistory', { imei })
      );
    } catch (e) {
      setErr(e?.message || t('admin.devices.errClearHistory'));
    } finally {
      setBusyImei('');
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
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge" style={{ background: 'rgba(180, 35, 24, 0.1)', color: '#b42318' }}>
              {t('admin.badge')}
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('admin.devices.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 760 }}>
              {t('admin.devices.subPrefix')} <strong>365GPS</strong> {t('admin.devices.subOr')}{' '}
              <strong>GPSPOS</strong>. {t('admin.devices.subSuffix')}
            </p>
          </div>
          <Link className="pp-link" to="/admin">
            {t('admin.backAdminHub')}
          </Link>
        </div>
      </div>

      {!apiReady ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad">
            <p className="pp-error">
              {t('admin.devices.apiNotConfiguredPrefix')} <code>REACT_APP_XEXUN_HTTP_BASE_URL</code>{' '}
              {t('admin.devices.apiNotConfiguredMiddle')} <code>same</code>{t('admin.devices.apiNotConfiguredAnd')}{' '}
              <code>REACT_APP_TRACKER_ADMIN_TOKEN</code> {t('admin.devices.apiNotConfiguredSuffix')}{' '}
              <code>TRACKER_ADMIN_TOKEN</code>, {t('admin.devices.apiNotConfiguredEnd')}
            </p>
          </div>
        </div>
      ) : null}

      <div className="pp-col-12">
        <div className="pp-card pp-pad">
          <h2 className="pp-h2" style={{ marginTop: 0 }}>
            {t('admin.devices.addImeiTitle')}
          </h2>
          <form
            className="pp-adminDeviceCard__grid"
            style={{ alignItems: 'flex-end' }}
            onSubmit={(e) => void addDevice(e)}
          >
            <label className="pp-field">
              <span className="pp-field__label">{t('admin.devices.imeiLabel')}</span>
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
              <span className="pp-field__label">{t('admin.devices.protocolLabel')}</span>
              <select
                className="pp-input"
                value={newProtocol}
                onChange={(e) => setNewProtocol(e.target.value)}
                disabled={!apiReady || Boolean(busyImei)}
              >
                {PROTOCOL_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {protocolLabel(opt.id, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('admin.devices.emnifyCard')}</span>
              <input
                className="pp-input"
                value={newEmnifyCard}
                onChange={(e) => setNewEmnifyCard(e.target.value)}
                placeholder={t('admin.devices.emnifyCardPlaceholder')}
                disabled={!apiReady || Boolean(busyImei)}
              />
            </label>
            <button type="submit" className="pp-btn pp-btnPrimary" disabled={!apiReady || Boolean(busyImei)}>
              {t('admin.devices.addDevice')}
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
              {t('admin.devices.allDevices', { count: devices.length })}
            </h2>
            <label className="pp-field" style={{ margin: 0, minWidth: 220 }}>
              <span className="pp-field__label">{t('admin.devices.searchImei')}</span>
              <input
                className="pp-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="861261…"
                disabled={loading}
              />
            </label>
          </div>

          {loading ? <p className="pp-subtle">{t('admin.loading')}</p> : null}
          {!loading && devices.length === 0 ? (
            <p className="pp-subtle">{t('admin.devices.empty')}</p>
          ) : null}
          {!loading && devices.length > 0 && filteredDevices.length === 0 ? (
            <p className="pp-subtle">{t('admin.devices.emptySearch')}</p>
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
                      {t('admin.devices.protocolLabel')}: <strong>{device.effectiveProvider || t('admin.devices.unknown')}</strong>
                      {device.observedProvider && device.observedProvider !== device.effectiveProvider ? (
                        <span> {t('admin.devices.observedProvider', { provider: device.observedProvider })}</span>
                      ) : null}
                      {device.emnifyCard ? (
                        <span>
                          {' · '}
                          {t('admin.devices.emnifyCard')}: <code>{device.emnifyCard}</code>
                        </span>
                      ) : null}
                      <span>
                        {' · '}
                        {hasFix
                          ? t('admin.devices.lastFix', { when: device.lastUpdate })
                          : t('admin.devices.noPosition')}
                      </span>
                    </div>
                    <div className="pp-adminDeviceCard__owner">
                      {petLinksLoading ? (
                        <span className="pp-subtle">{t('admin.devices.checkingLinks')}</span>
                      ) : petLinksError ? (
                        <span className="pp-subtle" style={{ color: '#b42318' }}>
                          {petLinksError}
                        </span>
                      ) : links.length ? (
                        links.map((link) => (
                          <div key={`${link.uid}-${link.petId}`} className="pp-adminDeviceCard__ownerRow">
                            <span className="pp-adminDeviceCard__ownerBadge">{t('admin.devices.linkedInApp')}</span>
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
                                <span className="pp-subtle"> · {t('admin.devices.noEmail')}</span>
                              )}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="pp-subtle">{t('admin.devices.notLinked')}</span>
                      )}
                    </div>
                  </header>

                  <div className="pp-adminDeviceCard__grid">
                    <label className="pp-field">
                      <span className="pp-field__label">{t('admin.devices.protocolLabel')}</span>
                      <select
                        className="pp-input"
                        value={draft.providerId}
                        onChange={(e) => updateDraft(device.imei, { providerId: e.target.value })}
                        disabled={saving}
                      >
                        {PROVIDER_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {providerLabel(opt.id, t)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="pp-field">
                      <span className="pp-field__label">{t('admin.devices.emnifyCard')}</span>
                      <input
                        className="pp-input"
                        value={draft.emnifyCard}
                        onChange={(e) => updateDraft(device.imei, { emnifyCard: e.target.value })}
                        placeholder={t('admin.devices.emnifyCardPlaceholder')}
                        disabled={saving}
                      />
                    </label>

                    {isGpspos ? (
                      <>
                        <label className="pp-field">
                          <span className="pp-field__label">{t('admin.devices.gpsposPlatformId')}</span>
                          <input
                            className="pp-input"
                            value={draft.gpsposPlatformImei}
                            onChange={(e) => updateDraft(device.imei, { gpsposPlatformImei: e.target.value })}
                            placeholder={t('admin.devices.gpsposPlatformPlaceholder')}
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
                          <span>{t('admin.devices.enablePolling')}</span>
                        </label>

                        <label className="pp-field">
                          <span className="pp-field__label">{t('admin.devices.pollEvery')}</span>
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
                                {formatInterval(seconds, t)}
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
                      {saving ? t('admin.saving') : t('admin.save')}
                    </button>
                    <button
                      type="button"
                      className="pp-btn pp-adminDeviceCard__danger"
                      disabled={saving}
                      onClick={() => void clearHistory(device.imei)}
                    >
                      {t('admin.devices.clearHistory')}
                    </button>
                    <button
                      type="button"
                      className="pp-btn pp-adminDeviceCard__danger"
                      disabled={saving}
                      onClick={() => void removeDevice(device.imei)}
                    >
                      {t('admin.devices.remove')}
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
