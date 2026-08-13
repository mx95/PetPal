import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { formatEur } from '../shop/catalog';
import { formatOrderStatusLabel, subscribeAllOrders } from '../shop/ordersFirestore';
import { formatDateTime24 } from '../formatTime24';

function orderWhen(row, lang) {
  const ts = row.paidAt || row.createdAt;
  if (ts?.toDate) return formatDateTime24(ts.toDate(), lang);
  return '—';
}

const HUB_ORDER_LIMIT = 25;

export default function AdminRecentOrdersPanel({ enabled }) {
  const { t, language } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!enabled) {
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
        setErr(e?.message || t('admin.hub.ordersErr'));
        setLoading(false);
      }
    );
  }, [enabled, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((row) => {
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
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
    return list.slice(0, HUB_ORDER_LIMIT);
  }, [rows, search]);

  return (
    <section className="pp-adminHubSection" id="admin-orders">
      <div className="pp-adminHubSection__head">
        <div>
          <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
            {t('admin.hub.ordersSectionTitle')}
          </h2>
          <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 720 }}>
            {t('admin.hub.ordersSectionIntro')}
          </p>
        </div>
        <Link className="pp-link" to="/admin/orders">
          {t('admin.hub.ordersViewAll')}
        </Link>
      </div>

      <input
        type="search"
        className="pp-input"
        style={{ marginTop: 14, maxWidth: 480 }}
        placeholder={t('adminOrders.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {err ? <div className="pp-error" style={{ marginTop: 12 }}>{err}</div> : null}
      {loading ? <p className="pp-subtle">{t('admin.hub.ordersLoading')}</p> : null}
      {!loading && !filtered.length ? (
        <p className="pp-subtle">{t('admin.hub.ordersEmpty')}</p>
      ) : null}

      <ul className="pp-adminHubOrders">
        {filtered.map((row) => (
          <li key={row.id} className="pp-card pp-adminHubOrder">
            <div>
              <strong>{row.paymentId || row.orderNumber}</strong>
              <div className="pp-subtle">
                {orderWhen(row, language)} · {formatEur(row.amountCents)}
                {row.customer?.name || row.customer?.email
                  ? ` · ${row.customer?.name || row.customer?.email}`
                  : ''}
              </div>
            </div>
            <span className="pp-badge">{formatOrderStatusLabel(row.status, t)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
