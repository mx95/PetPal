import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { formatEur } from '../shop/catalog';
import { formatOrderStatusLabel, subscribeUserOrder } from '../shop/ordersFirestore';
import { localizeCartItem } from '../shop/shopCartHelpers';

export default function PaymentFailed() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('orderNumber') || '';
  const reason = searchParams.get('reason') || '';
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!user?.uid || !orderNumber) {
      setOrder(null);
      return () => {};
    }
    return subscribeUserOrder(orderNumber, user.uid, setOrder);
  }, [orderNumber, user?.uid]);

  const reasonText = useMemo(() => {
    if (reason === 'missing_order') return t('paymentFailed.reasonMissingOrder');
    if (reason === 'unknown_session') return t('paymentFailed.reasonUnknown');
    if (reason === 'status') return t('paymentFailed.reasonStatus');
    if (reason === 'config') return t('paymentFailed.reasonConfig');
    return t('paymentFailed.reasonDefault');
  }, [reason, t]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="pp-pad pp-paymentResult">
      <div className="pp-card pp-paymentResult__card pp-paymentResult__card--fail">
        <div className="pp-paymentResult__icon pp-paymentResult__icon--fail" aria-hidden>
          ✕
        </div>
        <p className="pp-badge pp-paymentResult__badge--fail">{t('paymentFailed.badge')}</p>
        <h1 className="pp-pageHeader__title" style={{ marginTop: 0 }}>
          {t('paymentFailed.title')}
        </h1>
        <p className="pp-pageHeader__sub">{reasonText}</p>
        {orderNumber ? (
          <p className="pp-muted" style={{ marginTop: 12, fontSize: 14 }}>
            {t('paymentFailed.orderRef', { ref: orderNumber })}
          </p>
        ) : null}
        {order ? (
          <div className="pp-shopBanner pp-shopBanner--warn pp-paymentResult__detail" role="status">
            <p style={{ margin: 0 }}>
              <strong>{formatOrderStatusLabel(order.status, t)}</strong>
              {order.amountCents ? ` · ${formatEur(order.amountCents)}` : ''}
            </p>
            {order.items?.length ? (
              <ul className="pp-paymentResult__items">
                {order.items.map((item) => {
                  const displayItem = localizeCartItem(item, t);
                  return (
                    <li key={item.key}>
                      {displayItem.title} ×{item.qty}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
        <p className="pp-subtle pp-paymentResult__hint">{t('paymentFailed.hint')}</p>
        <div className="pp-paymentResult__actions">
          <Link className="pp-btn pp-btn--primary" to="/shop">
            {t('paymentFailed.ctaShop')}
          </Link>
          <Link className="pp-btn pp-btn--ghost" to="/profile/orders">
            {t('paymentFailed.ctaOrders')}
          </Link>
        </div>
      </div>
    </div>
  );
}
