import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
import { useI18n } from '../i18n/I18nContext';
import { PLUS_SKUS } from '../shop/catalog';
import { checkoutSuccessMessage } from '../shop/checkoutSuccessMessage';

export default function PaymentSuccess() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const checkout = searchParams.get('checkout');
  const orderNumber = searchParams.get('orderNumber');
  const focusSku = searchParams.get('sku');
  const plusBound = searchParams.get('plusBound');
  const includeTrackerParam = searchParams.get('includeTracker');
  const includeNfcParam = searchParams.get('includeNfc');
  const collarComboParam = searchParams.get('collarCombo');
  const collarTotalParam = searchParams.get('collarTotal');

  const [plusActive, setPlusActive] = useState(false);
  const [shopStats, setShopStats] = useState({ combo: 0, total: 0 });

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      setPlusActive(false);
      setShopStats({ combo: 0, total: 0 });
      return () => {};
    }
    const db = getDb();
    const plusSku = focusSku && PLUS_SKUS.includes(focusSku) ? focusSku : PLUS_SKUS[0];
    const unsubs = [];
    if (orderNumber && plusSku === 'PETPAL_PLUS_MONTHLY') {
      unsubs.push(
        onSnapshot(
          doc(db, 'users', user.uid, 'trackerSubscriptions', orderNumber),
          (snap) => setPlusActive(Boolean(snap.exists() && snap.data()?.status === 'active')),
          () => setPlusActive(false)
        )
      );
    } else {
      unsubs.push(
        onSnapshot(
          doc(db, 'billingSubscriptions', `${user.uid}_${plusSku}`),
          (snap) => setPlusActive(Boolean(snap.exists() && snap.data()?.status === 'active')),
          () => setPlusActive(false)
        )
      );
    }
    if (plusSku === 'PETPAL_PLUS_MONTHLY') {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users', user.uid, 'trackerSubscriptions'), where('status', '==', 'active')),
          (snap) => {
            if (snap.size > 0) setPlusActive(true);
          },
          () => {}
        )
      );
    }
    const statsDoc = doc(db, 'shopStats', 'public');
    const unsubStats = onSnapshot(
      statsDoc,
      (snap) => {
        const d = snap.data() || {};
        setShopStats({
          combo: Math.max(0, Number(d.activeSubscriptionsWithCollar) || 0),
          total: Math.max(0, Number(d.totalCollarPurchases) || 0),
        });
      },
      () => {}
    );
    return () => {
      unsubs.forEach((u) => u());
      unsubStats();
    };
  }, [user, focusSku, orderNumber]);

  const detail = useMemo(
    () =>
      checkoutSuccessMessage(t, {
        focusSku,
        plusBound,
        plusActive,
        includeTrackerParam,
        includeNfcParam,
        collarComboParam,
        collarTotalParam,
        shopStats,
      }),
    [t, focusSku, plusBound, plusActive, includeTrackerParam, includeNfcParam, collarComboParam, collarTotalParam, shopStats]
  );

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (checkout !== 'success') {
    return <Navigate to="/shop" replace />;
  }

  return (
    <div className="pp-pad pp-paymentSuccess">
      <div className="pp-card pp-paymentSuccess__card">
        <div className="pp-paymentSuccess__icon" aria-hidden>
          ✓
        </div>
        <p className="pp-badge" style={{ marginBottom: 10 }}>
          {t('paymentSuccess.badge')}
        </p>
        <h1 className="pp-pageHeader__title" style={{ marginTop: 0 }}>
          {t('paymentSuccess.title')}
        </h1>
        <p className="pp-pageHeader__sub" style={{ marginTop: 8 }}>
          {t('paymentSuccess.lead')}
        </p>
        {orderNumber ? (
          <p className="pp-muted" style={{ marginTop: 12, fontSize: 14 }}>
            {t('paymentSuccess.orderRef', { ref: orderNumber })}
          </p>
        ) : null}
        <div className="pp-shopBanner pp-shopBanner--ok pp-paymentSuccess__detail" role="status">
          {detail}
        </div>
        <div className="pp-paymentSuccess__actions">
          <Link className="pp-btn pp-btn--primary" to="/profile/orders">
            {t('paymentSuccess.ctaOrders')}
          </Link>
          <Link className="pp-btn pp-btn--ghost" to="/shop">
            {t('paymentSuccess.ctaShop')}
          </Link>
          <Link className="pp-btn pp-btn--ghost" to="/dashboard">
            {t('paymentSuccess.ctaDashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
