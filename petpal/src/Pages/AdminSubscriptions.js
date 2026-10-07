import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { formatDateTime24 } from '../formatTime24';
import {
  adminCancelSubscription,
  adminClearPaymentMethod,
  adminLookupSubscriptions,
  adminSetSubscriptionNextRenewal,
} from '../shop/subscriptionAdminClient';
import { adminExtendSubscriptionFreeMonths } from '../shop/subscriptionImeiClient';

function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function formatMoney(cents, currency) {
  if (!Number.isFinite(Number(cents))) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(Number(cents) / 100);
  } catch {
    return `${(Number(cents) / 100).toFixed(2)} ${currency || 'EUR'}`;
  }
}

export default function AdminSubscriptions() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { isAdmin, adminReady, firebaseReady } = useCompany();

  const [query, setQuery] = useState('');
  const [bundle, setBundle] = useState(null);
  const [renewDrafts, setRenewDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const rows = useMemo(() => {
    if (!bundle) return [];
    return [...(bundle.trackerSubscriptions || []), ...(bundle.billingSubscriptions || [])].sort((a, b) => {
      const as = a.status === 'active' ? 0 : 1;
      const bs = b.status === 'active' ? 0 : 1;
      if (as !== bs) return as - bs;
      return String(a.sku).localeCompare(String(b.sku));
    });
  }, [bundle]);

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) return <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>;
  if (!adminReady) return <p className="pp-subtle">{t('admin.loading')}</p>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  async function refreshLookup(emailOrUid) {
    const q = String(emailOrUid || query || '').trim();
    if (!q) {
      setErr(t('adminSubscriptions.errQuery'));
      return;
    }
    setLoading(true);
    setErr('');
    setOk('');
    try {
      const payload = q.includes('@') ? { email: q } : { uid: q };
      const data = await adminLookupSubscriptions(payload);
      setBundle(data);
      const drafts = {};
      for (const row of [...(data.trackerSubscriptions || []), ...(data.billingSubscriptions || [])]) {
        drafts[`${row.kind}:${row.id}`] = isoToLocalInput(row.nextRenewalAt);
      }
      setRenewDrafts(drafts);
      setOk(t('adminSubscriptions.lookupOk', { email: data.email || data.uid }));
    } catch (e) {
      setBundle(null);
      setErr(e?.message || t('adminSubscriptions.errLookup'));
    } finally {
      setLoading(false);
    }
  }

  async function onLookup(e) {
    e.preventDefault();
    await refreshLookup(query);
  }

  async function onSaveRenewal(row) {
    const key = `${row.kind}:${row.id}`;
    const iso = localInputToIso(renewDrafts[key]);
    if (!iso) {
      setErr(t('adminSubscriptions.errDate'));
      return;
    }
    setBusy(key);
    setErr('');
    setOk('');
    try {
      await adminSetSubscriptionNextRenewal({
        uid: bundle.uid,
        subscriptionId: row.id,
        kind: row.kind,
        nextRenewalAt: iso,
      });
      setOk(t('adminSubscriptions.renewSaved'));
      await refreshLookup(bundle.email || bundle.uid);
    } catch (e) {
      setErr(e?.message || t('adminSubscriptions.errSave'));
    } finally {
      setBusy('');
    }
  }

  async function onExtendMonth(row) {
    const key = `ext:${row.kind}:${row.id}`;
    setBusy(key);
    setErr('');
    setOk('');
    try {
      await adminExtendSubscriptionFreeMonths({
        uid: bundle.uid,
        subscriptionId: row.kind === 'tracker' ? row.id : undefined,
        months: 1,
        note: 'Admin subscriptions tool',
      });
      setOk(t('adminSubscriptions.extendOk'));
      await refreshLookup(bundle.email || bundle.uid);
    } catch (e) {
      setErr(e?.message || t('adminSubscriptions.errSave'));
    } finally {
      setBusy('');
    }
  }

  async function onCancelOne(row) {
    if (!window.confirm(t('adminSubscriptions.cancelConfirmOne', { id: row.subscriptionId || row.id }))) {
      return;
    }
    const key = `cancel:${row.kind}:${row.id}`;
    setBusy(key);
    setErr('');
    setOk('');
    try {
      await adminCancelSubscription({
        uid: bundle.uid,
        subscriptionId: row.id,
        kind: row.kind,
        clearPaymentMethod: false,
        reason: 'admin_tool',
      });
      setOk(t('adminSubscriptions.cancelOk'));
      await refreshLookup(bundle.email || bundle.uid);
    } catch (e) {
      setErr(e?.message || t('adminSubscriptions.errSave'));
    } finally {
      setBusy('');
    }
  }

  async function onCancelAll() {
    if (!window.confirm(t('adminSubscriptions.cancelConfirmAll', { email: bundle.email || bundle.uid }))) {
      return;
    }
    setBusy('cancelAll');
    setErr('');
    setOk('');
    try {
      await adminCancelSubscription({
        uid: bundle.uid,
        cancelAll: true,
        clearPaymentMethod: true,
        reason: 'admin_tool_all',
      });
      setOk(t('adminSubscriptions.cancelAllOk'));
      await refreshLookup(bundle.email || bundle.uid);
    } catch (e) {
      setErr(e?.message || t('adminSubscriptions.errSave'));
    } finally {
      setBusy('');
    }
  }

  async function onClearCard() {
    if (!window.confirm(t('adminSubscriptions.clearCardConfirm'))) return;
    setBusy('clearCard');
    setErr('');
    setOk('');
    try {
      await adminClearPaymentMethod({ uid: bundle.uid });
      setOk(t('adminSubscriptions.clearCardOk'));
      await refreshLookup(bundle.email || bundle.uid);
    } catch (e) {
      setErr(e?.message || t('adminSubscriptions.errSave'));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <Link className="pp-link" to="/admin">
          {t('admin.backAdminHub')}
        </Link>
        <h1 className="pp-h1" style={{ marginTop: 10 }}>
          {t('adminSubscriptions.title')}
        </h1>
        <p className="pp-subtle" style={{ maxWidth: 720 }}>
          {t('adminSubscriptions.intro')}
        </p>
      </div>

      <div className="pp-col-12">
        <form className="pp-card" style={{ padding: 16, maxWidth: 640 }} onSubmit={onLookup}>
          <label className="pp-field">
            <span className="pp-label">{t('adminSubscriptions.queryLabel')}</span>
            <input
              type="text"
              className="pp-input"
              value={query}
              onChange={(e) => setQuery(e.target.value.trim())}
              placeholder={t('adminSubscriptions.queryPlaceholder')}
              autoComplete="off"
              required
            />
          </label>
          <div className="pp-row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="pp-btn pp-btn--primary" disabled={loading || !query}>
              {loading ? t('adminSubscriptions.lookingUp') : t('adminSubscriptions.lookup')}
            </button>
          </div>
        </form>
      </div>

      {err ? (
        <div className="pp-col-12">
          <div className="pp-error">{err}</div>
        </div>
      ) : null}
      {ok ? (
        <div className="pp-col-12">
          <div className="pp-success">{ok}</div>
        </div>
      ) : null}

      {bundle ? (
        <div className="pp-col-12">
          <div className="pp-card" style={{ padding: 16 }}>
            <div className="pp-adminUserCard__head" style={{ marginBottom: 12 }}>
              <div>
                <strong>{bundle.name || bundle.email || bundle.uid}</strong>
                <div className="pp-subtle">{bundle.email || '—'}</div>
                <div className="pp-subtle">
                  UID: <code>{bundle.uid}</code>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="pp-btn pp-btn--ghost"
                  disabled={Boolean(busy)}
                  onClick={() => void onClearCard()}
                >
                  {busy === 'clearCard' ? t('admin.busyShort') : t('adminSubscriptions.clearCard')}
                </button>
                <button
                  type="button"
                  className="pp-btn pp-btn--ghost pp-adminShopAssets__removeBtn"
                  disabled={Boolean(busy)}
                  onClick={() => void onCancelAll()}
                >
                  {busy === 'cancelAll' ? t('admin.busyShort') : t('adminSubscriptions.cancelAll')}
                </button>
              </div>
            </div>

            <div className="pp-subtle" style={{ marginBottom: 12 }}>
              {bundle.paymentMethod?.hasBinding
                ? t('adminSubscriptions.cardOnFile', {
                    pan: bundle.paymentMethod.maskedPan || '••••',
                  })
                : t('adminSubscriptions.noCard')}
            </div>

            {!rows.length ? (
              <p className="pp-subtle">{t('adminSubscriptions.empty')}</p>
            ) : (
              <ul className="pp-adminPetNfcList">
                {rows.map((row) => {
                  const key = `${row.kind}:${row.id}`;
                  const active = row.status === 'active';
                  return (
                    <li key={key} className="pp-adminPetNfc" style={{ display: 'block' }}>
                      <div className="pp-adminPetNfc__name" style={{ marginBottom: 8 }}>
                        <strong>{row.sku || row.id}</strong>
                        <span className={`pp-badge ${active ? '' : 'pp-badge--muted'}`} style={{ marginLeft: 8 }}>
                          {row.status || '—'}
                        </span>
                        <span className="pp-subtle" style={{ marginLeft: 8 }}>
                          {row.kind}
                        </span>
                      </div>
                      <div className="pp-subtle" style={{ marginBottom: 8 }}>
                        ID: <code>{row.subscriptionId || row.id}</code>
                        {row.paymentId ? (
                          <>
                            {' '}
                            · {t('adminSubscriptions.paymentId')}: <code>{row.paymentId}</code>
                          </>
                        ) : null}
                        {row.trackerImei ? (
                          <>
                            {' '}
                            · IMEI: <code>{row.trackerImei}</code>
                          </>
                        ) : null}
                        {row.petName ? <> · {row.petName}</> : null}
                        {' · '}
                        {formatMoney(row.amountCents, row.currency)}
                        {' · '}
                        {row.hasBinding
                          ? t('adminSubscriptions.hasToken')
                          : t('adminSubscriptions.noToken')}
                      </div>
                      <div className="pp-adminPetNfc__collarRow" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <label className="pp-field" style={{ flex: '1 1 220px', margin: 0 }}>
                          <span className="pp-label">{t('adminSubscriptions.nextPayment')}</span>
                          <input
                            type="datetime-local"
                            className="pp-input"
                            value={renewDrafts[key] || ''}
                            disabled={Boolean(busy)}
                            onChange={(e) =>
                              setRenewDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="pp-btn pp-btn--primary"
                          disabled={Boolean(busy)}
                          onClick={() => void onSaveRenewal(row)}
                        >
                          {busy === key ? t('admin.saving') : t('adminSubscriptions.saveRenewal')}
                        </button>
                        {row.kind === 'tracker' ? (
                          <button
                            type="button"
                            className="pp-btn pp-btn--ghost"
                            disabled={Boolean(busy)}
                            onClick={() => void onExtendMonth(row)}
                          >
                            {busy === `ext:${key}`
                              ? t('admin.busyShort')
                              : t('adminSubscriptions.extendMonth')}
                          </button>
                        ) : null}
                        {active ? (
                          <button
                            type="button"
                            className="pp-btn pp-btn--ghost pp-adminShopAssets__removeBtn"
                            disabled={Boolean(busy)}
                            onClick={() => void onCancelOne(row)}
                          >
                            {busy === `cancel:${key}`
                              ? t('admin.busyShort')
                              : t('adminSubscriptions.cancelOne')}
                          </button>
                        ) : null}
                      </div>
                      {row.nextRenewalAt ? (
                        <p className="pp-subtle" style={{ marginTop: 8, marginBottom: 0 }}>
                          {t('adminSubscriptions.currentRenewal', {
                            when: formatDateTime24(new Date(row.nextRenewalAt), language),
                          })}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {Array.isArray(bundle.cancelRequests) && bundle.cancelRequests.length ? (
              <div style={{ marginTop: 16 }}>
                <h3 className="pp-h2" style={{ marginTop: 0 }}>
                  {t('adminSubscriptions.cancelRequestsTitle')}
                </h3>
                <ul className="pp-subtle">
                  {bundle.cancelRequests.map((r) => (
                    <li key={r.id}>
                      <code>{r.id}</code> — {r.status}
                      {r.createdAt ? ` · ${formatDateTime24(new Date(r.createdAt), language)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
