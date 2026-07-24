import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { PrettySelect } from '../components/PrettySelect';
import { formatEur } from '../shop/catalog';
import { ADMIN_FULFILLMENT_STATUSES, formatOrderStatusLabel, adminUpdateOrder, subscribeAllOrders } from '../shop/ordersFirestore';
import { localizeCartItem } from '../shop/shopCartHelpers';
import { adminAssignSubscriptionImei } from '../shop/subscriptionImeiClient';
import { formatDateTime24 } from '../formatTime24';

function orderWhen(row) {
  const ts = row.paidAt || row.createdAt;
  if (ts?.toDate) return formatDateTime24(ts.toDate());
  return '—';
}

export default function AdminOrders() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [draftNotes, setDraftNotes] = useState({});
  const [imeiDrafts, setImeiDrafts] = useState({});
  const [imeiBusyKey, setImeiBusyKey] = useState('');

  useEffect(() => {
    if (!firebaseReady || !isAdmin) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return subscribeAllOrders(
      (list) => {
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || 'Failed to load orders.');
        setLoading(false);
      }
    );
  }, [firebaseReady, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        row.orderNumber,
        row.paymentId,
        row.uid,
        row.sku,
        row.customer?.email,
        row.customerEmailNormalized,
        row.customer?.name,
        row.shipping?.phone,
        row.shipping?.address,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter]);

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) return <p className="pp-error">Firebase is not configured.</p>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  async function saveStatus(row, status) {
    setBusyId(row.id);
    setErr('');
    try {
      await adminUpdateOrder(row.id, {
        status,
        adminNotes: draftNotes[row.id] ?? row.adminNotes ?? '',
      });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusyId('');
    }
  }

  async function assignImei(row, line) {
    const key = `${row.id}:${line.subscriptionId}`;
    const imei = String(imeiDrafts[key] || '').trim();
    if (!imei) {
      setErr('Enter a collar IMEI.');
      return;
    }
    setImeiBusyKey(key);
    setErr('');
    setOk('');
    try {
      await adminAssignSubscriptionImei({
        uid: row.uid,
        paymentId: line.paymentId || row.paymentId || row.id,
        subPaymentId: line.subPaymentId,
        subscriptionId: line.subscriptionId,
        imei,
      });
      setOk(`IMEI assigned for payment ${line.paymentId || row.paymentId} · sub ${line.subPaymentId}.`);
      setImeiDrafts((prev) => ({ ...prev, [key]: '' }));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setImeiBusyKey('');
    }
  }

  return (
    <div className="pp-pad">
      <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Link className="pp-link" to="/admin">
            ← Admin
          </Link>
          <h1 className="pp-h1" style={{ marginTop: 10 }}>
            {t('adminOrders.title')}
          </h1>
          <p className="pp-subtle">{t('adminOrders.sub')}</p>
        </div>
      </div>

      <div className="pp-adminFilters" style={{ marginTop: 16 }}>
        <input
          type="search"
          className="pp-input"
          placeholder={t('adminOrders.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <PrettySelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t('adminOrders.filterAll')}</option>
          {ADMIN_FULFILLMENT_STATUSES.concat(['pending_payment', 'payment_failed']).map((s) => (
            <option key={s} value={s}>
              {formatOrderStatusLabel(s, t)}
            </option>
          ))}
        </PrettySelect>
      </div>

      {err ? <div className="pp-error" style={{ marginTop: 12 }}>{err}</div> : null}
      {ok ? <div className="pp-shopBanner" role="status">{ok}</div> : null}
      {loading ? <p className="pp-subtle">{t('adminOrders.loading')}</p> : null}

      <ul className="pp-adminOrdersList">
        {filtered.map((row) => {
          const open = expandedId === row.id;
          return (
            <li key={row.id} className="pp-card pp-adminOrdersList__item">
              <button
                type="button"
                className="pp-adminOrdersList__head"
                onClick={() => setExpandedId(open ? '' : row.id)}
              >
                <div>
                  <strong>{row.paymentId || row.orderNumber}</strong>
                  <div className="pp-subtle">
                    {orderWhen(row)} · {formatEur(row.amountCents)} · {row.sku}
                  </div>
                </div>
                <span className="pp-badge">{formatOrderStatusLabel(row.status, t)}</span>
              </button>
              {open ? (
                <div className="pp-adminOrdersList__body">
                  <div className="pp-adminOrdersList__grid">
                    <div>
                      <h3 className="pp-sectionTitle">{t('adminOrders.customerTitle')}</h3>
                      <p className="pp-subtle" style={{ margin: 0 }}>
                        {row.customer?.name || row.shipping?.receiverName || '—'}
                        <br />
                        {row.customer?.email || row.shipping?.email || '—'}
                        <br />
                        {row.customer?.phone || row.shipping?.phone || '—'}
                        <br />
                        UID: <code>{row.uid}</code>
                      </p>
                    </div>
                    <div>
                      <h3 className="pp-sectionTitle">{t('adminOrders.shippingTitle')}</h3>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{row.shipping?.address || '—'}</p>
                    </div>
                  </div>
                  <h3 className="pp-sectionTitle">{t('adminOrders.itemsTitle')}</h3>
                  <ul className="pp-ordersList__lines">
                    {row.items.map((item) => {
                      const displayItem = localizeCartItem(item, t);
                      return (
                        <li key={item.key}>
                          {displayItem.title} ×{item.qty} — {formatEur(item.priceCents * item.qty)}
                          {item.subPaymentId ? (
                            <span className="pp-subtle">
                              {' '}
                              · subPaymentID {item.subPaymentId}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {row.trackerSubscriptions?.length ? (
                    <div className="pp-adminOrdersList__trackers">
                      <h3 className="pp-sectionTitle">{t('adminOrders.trackerSubsTitle')}</h3>
                      <p className="pp-subtle">{t('adminOrders.trackerSubsLead')}</p>
                      <ul className="pp-adminOrdersList__trackerLines">
                        {row.trackerSubscriptions.map((line) => {
                          const key = `${row.id}:${line.subscriptionId}`;
                          const assigned = line.trackerImei ? String(line.trackerImei) : '';
                          return (
                            <li key={line.subscriptionId} className="pp-adminOrdersList__trackerRow">
                              <div className="pp-subtle">
                                {t('adminOrders.paymentId')}: <code>{line.paymentId || row.paymentId}</code>
                                {line.subPaymentId ? (
                                  <>
                                    {' '}
                                    · {t('adminOrders.subPaymentId')}: <code>{line.subPaymentId}</code>
                                  </>
                                ) : null}
                              </div>
                              <div className="pp-subtle">
                                {t('adminOrders.trackerSubId')}: <code>{line.subscriptionId}</code>
                              </div>
                              {assigned ? (
                                <p className="pp-subtle" style={{ margin: '6px 0 0' }}>
                                  {t('adminOrders.trackerImeiAssigned', { imei: assigned })}
                                </p>
                              ) : (
                                <div className="pp-adminOrdersList__imeiRow">
                                  <input
                                    type="text"
                                    className="pp-input"
                                    inputMode="numeric"
                                    placeholder={t('adminOrders.trackerImeiLabel')}
                                    value={imeiDrafts[key] || ''}
                                    disabled={imeiBusyKey === key}
                                    onChange={(e) =>
                                      setImeiDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="pp-btn pp-btn--primary"
                                    disabled={imeiBusyKey === key}
                                    onClick={() => void assignImei(row, line)}
                                  >
                                    {imeiBusyKey === key
                                      ? t('adminOrders.trackerImeiBusy')
                                      : t('adminOrders.trackerImeiAssign')}
                                  </button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                  <div className="pp-adminOrdersList__statusRow">
                    <label className="pp-field">
                      <span>{t('adminOrders.statusLabel')}</span>
                      <PrettySelect
                        value={row.status}
                        disabled={busyId === row.id}
                        onChange={(e) => void saveStatus(row, e.target.value)}
                      >
                        {ADMIN_FULFILLMENT_STATUSES.concat(['pending_payment', 'payment_failed']).map((s) => (
                          <option key={s} value={s}>
                            {formatOrderStatusLabel(s, t)}
                          </option>
                        ))}
                      </PrettySelect>
                    </label>
                    <label className="pp-field">
                      <span>{t('adminOrders.notesLabel')}</span>
                      <textarea
                        rows={2}
                        value={draftNotes[row.id] ?? row.adminNotes ?? ''}
                        disabled={busyId === row.id}
                        onChange={(e) => setDraftNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        onBlur={() => {
                          const notes = draftNotes[row.id];
                          if (notes == null || notes === (row.adminNotes || '')) return;
                          void saveStatus(row, row.status);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
