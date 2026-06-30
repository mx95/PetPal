import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { getDb, isFirebaseConfigured } from '../firebase';
import { useI18n } from '../i18n/I18nContext';
import {
  NFC_TAG_ADDON_CENTS,
  PLUS_SKUS,
  SHOP_PRODUCTS,
  TRACKER_ADDON_CENTS,
  formatEur,
  formatShopPrice,
  monthlyFirstPaymentCents,
} from '../shop/catalog';
import { startJccCheckout } from '../shop/startJccCheckout';

export default function Shop() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isApprovedCompany } = useCompany();
  const [searchParams] = useSearchParams();
  const checkout = searchParams.get('checkout');
  const focusSku = searchParams.get('sku');
  const cardRefs = useRef(/** @type {Record<string, HTMLElement | null>} */ ({}));

  useEffect(() => {
    if (checkout !== 'success') return;
    const q = searchParams.toString();
    navigate(q ? `/payment/success?${q}` : '/payment/success?checkout=success', { replace: true });
  }, [checkout, navigate, searchParams]);

  const [plusActiveBySku, setPlusActiveBySku] = useState(() =>
    PLUS_SKUS.reduce((acc, id) => {
      acc[id] = false;
      return acc;
    }, {})
  );
  const [monthlyIncludeTracker, setMonthlyIncludeTracker] = useState(false);
  const [monthlyIncludeNfc, setMonthlyIncludeNfc] = useState(false);
  const [activeTrackerSubCount, setActiveTrackerSubCount] = useState(0);
  const [legacyMonthlyActive, setLegacyMonthlyActive] = useState(false);

  useEffect(() => {
    if (!focusSku) return;
    const id = window.setTimeout(() => {
      const el = cardRefs.current[focusSku];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => window.clearTimeout(id);
  }, [focusSku]);

  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      setPlusActiveBySku(PLUS_SKUS.reduce((acc, id) => ({ ...acc, [id]: false }), {}));
      setActiveTrackerSubCount(0);
      setLegacyMonthlyActive(false);
      return () => {};
    }
    const db = getDb();
    const unsubs = PLUS_SKUS.filter((sku) => sku !== 'PETPAL_PLUS_MONTHLY').map((sku) =>
      onSnapshot(doc(db, 'billingSubscriptions', `${user.uid}_${sku}`), (snap) => {
        const active = Boolean(snap.exists() && snap.data()?.status === 'active');
        setPlusActiveBySku((prev) => ({ ...prev, [sku]: active }));
      })
    );
    const legacyMonthlyUnsub = onSnapshot(doc(db, 'billingSubscriptions', `${user.uid}_PETPAL_PLUS_MONTHLY`), (snap) => {
      const data = snap.data() || {};
      const active = Boolean(snap.exists() && data.status === 'active' && data.nextRenewalAt);
      setLegacyMonthlyActive(active);
    });
    const trackerSubsUnsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'trackerSubscriptions'), where('status', '==', 'active')),
      (snap) => {
        setActiveTrackerSubCount(snap.size);
      }
    );
    return () => {
      unsubs.forEach((u) => u());
      legacyMonthlyUnsub();
      trackerSubsUnsub();
    };
  }, [user]);

  const monthlySubCount =
    activeTrackerSubCount + (legacyMonthlyActive && activeTrackerSubCount === 0 ? 1 : 0);

  const [saveCardById, setSaveCardById] = useState(() =>
    SHOP_PRODUCTS.reduce((acc, p) => {
      acc[p.id] = p.recurring;
      return acc;
    }, {})
  );
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  const banner = useMemo(() => {
    if (checkout === 'fail') return { text: t('shopPage.checkoutFail') };
    if (checkout === 'error') return { text: t('shopPage.checkoutError') };
    return null;
  }, [checkout, t]);

  const isPlusSku = (id) => PLUS_SKUS.includes(id);

  const monthlyAddonOpts = useMemo(
    () => ({ includeTracker: monthlyIncludeTracker, includeNfc: monthlyIncludeNfc }),
    [monthlyIncludeTracker, monthlyIncludeNfc]
  );

  if (!user) {
    return (
      <div className="pp-pad pp-demoProviderPortal">
        <div className="pp-pageHeader">
          <div className="pp-pageHeader__copy">
            <div className="pp-pageHeader__title">{t('shopPage.signInTitle')}</div>
            <div className="pp-pageHeader__subtitle">{t('shopPage.signInSub')}</div>
          </div>
        </div>
        <Link className="pp-btn pp-btn--primary" to="/login">
          {t('nav.login')}
        </Link>
      </div>
    );
  }

  if (!isFirebaseConfigured()) {
    return (
      <div className="pp-pad">
        <h1 className="pp-pageHeader__title">
          {t('shopPage.needFirebaseTitle')}
        </h1>
        <p className="pp-subtle">{t('shopPage.needFirebaseSub')}</p>
      </div>
    );
  }

  async function onPay(product) {
    setErr('');
    setBusy(product.id);
    try {
      const saveCard = Boolean(saveCardById[product.id]);
      if (product.recurring && !saveCard) {
        setErr(t('shopPage.saveCardRequired'));
        setBusy(null);
        return;
      }
      const includeTracker = product.id === 'PETPAL_PLUS_MONTHLY' && monthlyIncludeTracker;
      const includeNfc = product.id === 'PETPAL_PLUS_MONTHLY' && monthlyIncludeNfc;
      const companyId = product.id === 'STORE_BOOST_MONTHLY' ? user.uid : undefined;
      await startJccCheckout({ sku: product.id, saveCard, companyId, includeTracker, includeNfc });
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(null);
    }
  }

  return (
    <div className="pp-pad pp-shopPage">
      {banner ? (
        <div className="pp-shopBanner pp-shopBanner--warn" role="status">
          {banner.text}
        </div>
      ) : null}

      {err ? <div className="pp-error" style={{ marginTop: 12 }}>{err}</div> : null}

      <div className="pp-shopGrid">
        {SHOP_PRODUCTS.map((p) => {
          const planActive = isPlusSku(p.id)
            ? p.id === 'PETPAL_PLUS_MONTHLY'
              ? monthlySubCount > 0
              : plusActiveBySku[p.id]
            : false;
          const isLoading = busy === p.id;
          const monthlyActive = monthlySubCount > 0;
          const monthlyAddOnMode = p.id === 'PETPAL_PLUS_MONTHLY' && monthlyActive;
          const monthlyCanCheckout =
            p.id !== 'PETPAL_PLUS_MONTHLY' || !monthlyActive || monthlyIncludeTracker;
          const dueTodayCents =
            p.id === 'PETPAL_PLUS_MONTHLY' ? monthlyFirstPaymentCents(monthlyAddonOpts) : p.amountCents;
          const hasMonthlyAddons = monthlyIncludeTracker || monthlyIncludeNfc;

          return (
            <article
              key={p.id}
              ref={(el) => {
                cardRefs.current[p.id] = el;
              }}
              className={`pp-card pp-shopCard${focusSku === p.id ? ' pp-shopCard--focus' : ''}${p.id === 'PETPAL_PLUS_YEARLY' ? ' pp-shopCard--featured' : ''}`}
            >
              <div className="pp-shopCard__body">
              <span className="pp-shopCard__badge">{p.badge}</span>
              <h2 className="pp-sectionTitle" style={{ margin: '6px 0 4px' }}>
                {p.title}
              </h2>
              <p className="pp-subtle" style={{ marginTop: 0 }}>
                {p.subtitle}
              </p>
              {isPlusSku(p.id) ? (
                <p className={`pp-shopCard__status${planActive ? ' pp-shopCard__status--on' : ''}`}>
                  {planActive ? t('shopPage.plusBadgeActive') : t('shopPage.plusBadgeInactive')}
                </p>
              ) : null}
              {p.id === 'PETPAL_PLUS_MONTHLY' && monthlySubCount > 0 ? (
                <p className="pp-subtle pp-shopCard__trackerCount">
                  {t('shopPage.trackerEntitlements', { count: monthlySubCount })}
                </p>
              ) : null}
              {p.id === 'PETPAL_PLUS_MONTHLY' && (!planActive || monthlyAddOnMode) ? (
                <div className="pp-shopAddons">
                  {monthlyAddOnMode ? (
                    <p className="pp-subtle pp-shopAddons__lead">{t('shopPage.monthlyAddAnotherLead')}</p>
                  ) : null}
                  <label className="pp-shopTrackerOpt">
                    <input
                      type="checkbox"
                      checked={monthlyIncludeTracker}
                      disabled={isLoading}
                      onChange={(e) => setMonthlyIncludeTracker(e.target.checked)}
                    />
                    <span className="pp-shopTrackerOpt__copy">
                      <strong>
                        {monthlyAddOnMode
                          ? t('shopPage.monthlyAddTrackerAgainTitle')
                          : t('shopPage.monthlyAddTrackerTitle')}
                      </strong>
                      <small>
                        {monthlyAddOnMode
                          ? t('shopPage.monthlyAddTrackerAgainSub')
                          : t('shopPage.monthlyAddTrackerSub')}
                      </small>
                    </span>
                    <span className="pp-shopTrackerOpt__meta">
                      <span className="pp-shopTrackerOpt__price">+{formatEur(TRACKER_ADDON_CENTS)}</span>
                      <span className="pp-shopTrackerOpt__switch" aria-hidden />
                    </span>
                  </label>
                  <label className="pp-shopTrackerOpt">
                    <input
                      type="checkbox"
                      checked={monthlyIncludeNfc}
                      disabled={isLoading}
                      onChange={(e) => setMonthlyIncludeNfc(e.target.checked)}
                    />
                    <span className="pp-shopTrackerOpt__copy">
                      <strong>{t('shopPage.monthlyAddNfcTitle')}</strong>
                      <small>
                        {monthlyAddOnMode
                          ? t('shopPage.monthlyAddNfcAgainSub')
                          : t('shopPage.monthlyAddNfcSub')}
                      </small>
                    </span>
                    <span className="pp-shopTrackerOpt__meta">
                      <span className="pp-shopTrackerOpt__price">+{formatEur(NFC_TAG_ADDON_CENTS)}</span>
                      <span className="pp-shopTrackerOpt__switch" aria-hidden />
                    </span>
                  </label>
                </div>
              ) : null}
              {p.id === 'PETPAL_PLUS_YEARLY' ? (
                <p className="pp-shopCard__highlight">{t('shopPage.yearlyHardwareIncluded')}</p>
              ) : null}
              <div className="pp-shopCard__price">{formatShopPrice(p)}</div>
              {p.id === 'PETPAL_PLUS_MONTHLY' && (!planActive || monthlyIncludeTracker) ? (
                <p className="pp-shopCard__dueToday">
                  {t('shopPage.dueToday', { amount: formatEur(dueTodayCents) })}
                  {hasMonthlyAddons ? (
                    <span className="pp-shopCard__dueTodayNote"> {t('shopPage.dueTodayWithAddons')}</span>
                  ) : null}
                </p>
              ) : null}
              {p.id === 'PETPAL_PLUS_MONTHLY' && monthlyAddOnMode && !monthlyIncludeTracker ? (
                <p className="pp-subtle pp-shopCard__hint">{t('shopPage.monthlySelectTrackerHint')}</p>
              ) : null}
              {p.id === 'STORE_BOOST_MONTHLY' && !isApprovedCompany ? (
                <p className="pp-subtle">{t('shopPage.boostBusinessOnly')}</p>
              ) : null}
              </div>
              <div className="pp-shopCard__foot">
              <label className="pp-shopSaveRow">
                <input
                  type="checkbox"
                  checked={Boolean(saveCardById[p.id])}
                  disabled={(isPlusSku(p.id) && planActive && p.id !== 'PETPAL_PLUS_MONTHLY') || isLoading || !p.recurring}
                  onChange={(e) => setSaveCardById((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                />
                <span>
                  {t('shopPage.saveCardLabel')} <small>{t('shopPage.saveCardHint')}</small>
                </span>
              </label>
              <button
                type="button"
                className={`pp-btn pp-btn--primary pp-shopCard__payBtn${isLoading ? ' pp-shopCard__payBtn--loading' : ''}`}
                disabled={
                  Boolean(busy) ||
                  (p.id === 'STORE_BOOST_MONTHLY' && !isApprovedCompany) ||
                  (p.id === 'PETPAL_PLUS_YEARLY' && planActive) ||
                  !monthlyCanCheckout
                }
                aria-busy={isLoading}
                onClick={() => void onPay(p)}
              >
                {isLoading ? (
                  <>
                    <span className="pp-shopCard__paySpinner" aria-hidden />
                    <span>{t('shopPage.checkoutRedirecting')}</span>
                  </>
                ) : p.id === 'PETPAL_PLUS_MONTHLY' && monthlyAddOnMode && monthlyIncludeTracker ? (
                  t('shopPage.addTrackerSubscriptionCta')
                ) : p.id === 'PETPAL_PLUS_YEARLY' && planActive ? (
                  t('shopPage.plusSubscribedCta')
                ) : (
                  t('shopPage.payCta')
                )}
              </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
