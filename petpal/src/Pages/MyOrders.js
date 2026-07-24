import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { formatEur } from '../shop/catalog';
import { formatOrderStatusLabel, subscribeUserOrders } from '../shop/ordersFirestore';
import { localizeCartItem } from '../shop/shopCartHelpers';
import { formatDateTime24 } from '../formatTime24';

function orderWhen(row) {
  const ts = row.paidAt || row.createdAt;
  if (ts?.toDate) return formatDateTime24(ts.toDate());
  return '—';
}

function statusStyle(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'paid' || s === 'delivered') return { background: 'rgba(18, 183, 106, 0.12)', color: '#039855' };
  if (s === 'processing' || s === 'shipped') return { background: 'rgba(46, 144, 250, 0.12)', color: '#1570ef' };
  if (s === 'payment_failed' || s === 'cancelled') return { background: 'rgba(152, 162, 179, 0.18)', color: '#475467' };
  return { background: 'rgba(249, 112, 102, 0.12)', color: '#d92d20' };
}

export default function MyOrders() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState('');

  useEffect(() => {
    if (!user?.uid) {
      setRows([]);
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    return subscribeUserOrders(
      user.uid,
      (list) => {
        setRows(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [user?.uid]);

  const visible = useMemo(() => rows.filter((r) => r.status !== 'pending_payment'), [rows]);

  return (
    <div className="pp-pad">
      <div className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <Link className="pp-link" to="/profile">
            ← {t('ordersPage.backProfile')}
          </Link>
          <h1 className="pp-pageHeader__title" style={{ marginTop: 10 }}>
            {t('ordersPage.title')}
          </h1>
          <p className="pp-pageHeader__subtitle">{t('ordersPage.sub')}</p>
        </div>
      </div>

      {loading ? <p className="pp-subtle">{t('ordersPage.loading')}</p> : null}
      {!loading && !visible.length ? (
        <div className="pp-card pp-pad">
          <p className="pp-subtle">{t('ordersPage.empty')}</p>
          <Link className="pp-btn pp-btn--primary" to="/shop">
            {t('ordersPage.emptyCta')}
          </Link>
        </div>
      ) : null}

      <ul className="pp-ordersList">
        {visible.map((row) => {
          const open = expandedId === row.id;
          return (
            <li key={row.id} className="pp-card pp-ordersList__item">
              <button
                type="button"
                className="pp-ordersList__head"
                aria-expanded={open}
                onClick={() => setExpandedId(open ? '' : row.id)}
              >
                <div>
                  <strong>{row.orderNumber}</strong>
                  <div className="pp-subtle">{orderWhen(row)} · {formatEur(row.amountCents)}</div>
                </div>
                <span className="pp-badge" style={statusStyle(row.status)}>
                  {formatOrderStatusLabel(row.status, t)}
                </span>
              </button>
              {open ? (
                <div className="pp-ordersList__body">
                  <p className="pp-subtle">{t('ordersPage.itemsTitle')}</p>
                  <ul className="pp-ordersList__lines">
                    {row.items.map((item) => {
                      const displayItem = localizeCartItem(item, t);
                      return (
                        <li key={item.key}>
                          {displayItem.title} ×{item.qty} — {formatEur(item.priceCents * item.qty)}
                        </li>
                      );
                    })}
                  </ul>
                  {row.shipping?.address ? (
                    <>
                      <p className="pp-subtle" style={{ marginTop: 12 }}>
                        {t('ordersPage.shippingTitle')}
                      </p>
                      <p style={{ margin: 0 }}>
                        {row.shipping.receiverName}
                        <br />
                        {row.shipping.address}
                        <br />
                        {row.shipping.phone} · {row.shipping.email}
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
