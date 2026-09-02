import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { usePets } from '../pets/PetsContext';
import { isFirebaseConfigured } from '../firebase';
import { useI18n } from '../i18n/I18nContext';
import { subscribeProviderProfile } from '../bookings/providerDirectoryFirestore';
import { providerBookingsBoostIsActive, providerNearbyBoostIsActive } from '../bookings/bookingBrowseUtils';
import ShopCartBar from '../components/shop/ShopCartBar';
import SubscriptionCarousel from '../components/shop/SubscriptionCarousel';
import ShopPlanFeatureList from '../components/shop/ShopPlanFeatureList';
import ShopPetPicker from '../components/shop/ShopPetPicker';
import NfcDesignSelector from '../components/shop/NfcDesignSelector';
import ImeiQrScannerButton from '../components/ImeiQrScannerButton';
import { useShopAssets } from '../hooks/useShopAssets';
import ShopDeferredImage from '../components/shop/ShopDeferredImage';
import {
  NFC_TAG_ADDON_CENTS,
  PLUS_SKUS,
  HARDWARE_SKUS,
  PLUS_YEARLY_RENEWAL_CENTS,
  SHOP_PRODUCTS,
  BUSINESS_BOOST_PRODUCTS,
  BOOST_SKUS,
  TRACKER_ADDON_CENTS,
  formatEur,
  formatShopPrice,
  localizeShopProduct,
  monthlyFirstPaymentCents,
} from '../shop/catalog';
import { MARKETPLACE_PRODUCTS, MARKETPLACE_SELLER } from '../shop/marketplaceProducts';
import { useShopCart } from '../shop/ShopCartContext';
import { requestSubscriptionCancel } from '../shop/requestSubscriptionCancel';
import { cancelBusinessBoost } from '../shop/cancelBusinessBoost';
import { buildSubscriptionCartItem } from '../shop/shopCartHelpers';
import { subscribeShopSubscriptionState } from '../shop/shopSubscriptionsFirestore';
import { normalizeTrackerImei } from '../tracking/trackerImeiIndex';
import ProfilePaymentMethod from '../components/ProfilePaymentMethod';

const SUBSCRIPTION_PRODUCTS = SHOP_PRODUCTS.filter((p) => PLUS_SKUS.includes(p.id));

function petForImei(pets, imei) {
  const key = normalizeTrackerImei(imei);
  if (!key) return null;
  return pets.find((p) => normalizeTrackerImei(p.trackingDeviceId) === key) || null;
}

function formatImeiTail(imei) {
  const s = normalizeTrackerImei(imei);
  return s.length >= 4 ? s.slice(-4) : s;
}

export default function Shop() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { isApprovedCompany, isAdmin } = useCompany();
  const showBusinessBoosts = isApprovedCompany && !isAdmin;
  const { pets } = usePets();
  const [searchParams] = useSearchParams();
  const checkout = searchParams.get('checkout');
  const focusSku = searchParams.get('sku');
  const cardRefs = useRef(/** @type {Record<string, HTMLElement | null>} */ ({}));

  const [shopTab, setShopTab] = useState('subscriptions');
  const { addToCart, setCheckoutError, cartItems } = useShopCart();
  const hasMarketplaceProducts = MARKETPLACE_PRODUCTS.length > 0;

  const localizedSubscriptionProducts = useMemo(
    () => SUBSCRIPTION_PRODUCTS.map((product) => localizeShopProduct(product, t)),
    [t]
  );
  const localizedBoostProducts = useMemo(
    () => BUSINESS_BOOST_PRODUCTS.map((product) => localizeShopProduct(product, t)),
    [t]
  );

  const localizedMarketplaceProducts = useMemo(
    () =>
      MARKETPLACE_PRODUCTS.map((product) => ({
        ...product,
        title: t(product.titleKey),
        description: t(product.descKey),
      })),
    [t]
  );

  useEffect(() => {
    if (checkout !== 'success') return;
    const q = searchParams.toString();
    navigate(q ? `/payment/success?${q}` : '/payment/success?checkout=success', { replace: true });
  }, [checkout, navigate, searchParams]);

  const [plusActiveBySku, setPlusActiveBySku] = useState(() =>
    PLUS_SKUS.reduce((acc, id) => ({ ...acc, [id]: false }), {})
  );
  const [monthlyIncludeTracker, setMonthlyIncludeTracker] = useState(false);
  const [monthlyIncludeNfc, setMonthlyIncludeNfc] = useState(false);
  const [monthlyUseExistingImei, setMonthlyUseExistingImei] = useState(false);
  const [monthlyExistingImei, setMonthlyExistingImei] = useState('');
  const [monthlyNfcPetIds, setMonthlyNfcPetIds] = useState(/** @type {string[]} */ ([]));
  const [yearlyNfcPetIds, setYearlyNfcPetIds] = useState(/** @type {string[]} */ ([]));
  const { nfcDesigns, trackerImage, nfcProductImage } = useShopAssets();
  const [selectedNfcDesignId, setSelectedNfcDesignId] = useState(1);
  const [activeTrackerSubs, setActiveTrackerSubs] = useState(/** @type {Array<{ id: string, sku?: string, status?: string, createdAt?: unknown }>} */ ([]));
  const [legacyMonthlyActive, setLegacyMonthlyActive] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(null);
  const [boostCancelBusy, setBoostCancelBusy] = useState('');
  const [cancelMsg, setCancelMsg] = useState('');

  useEffect(() => {
    if (!nfcDesigns.some((d) => d.id === selectedNfcDesignId)) {
      setSelectedNfcDesignId(nfcDesigns[0]?.id || 1);
    }
  }, [nfcDesigns, selectedNfcDesignId]);

  const petOptions = useMemo(
    () =>
      pets.map((p) => ({
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        photoUrl: p.photoUrl,
        photoDataUrl: p.photoDataUrl,
      })),
    [pets]
  )

  const [providerDoc, setProviderDoc] = useState(null);

  useEffect(() => {
    if (!uid || !showBusinessBoosts) {
      setProviderDoc(null);
      return undefined;
    }
    return subscribeProviderProfile(uid, setProviderDoc);
  }, [uid, showBusinessBoosts]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'products') setShopTab('products');
    if (focusSku && HARDWARE_SKUS.includes(focusSku)) setShopTab('products');
    if (focusSku && PLUS_SKUS.includes(focusSku)) setShopTab('subscriptions');
  }, [focusSku, searchParams]);

  useEffect(() => {
    if (focusSku && BOOST_SKUS.includes(focusSku)) {
      setShopTab('subscriptions');
    }
  }, [focusSku]);

  useEffect(() => {
    if (searchParams.get('card') === 'updated') {
      setShopTab('subscriptions');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!focusSku) return;
    const id = window.setTimeout(() => {
      cardRefs.current[focusSku]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 250);
    return () => window.clearTimeout(id);
  }, [focusSku, shopTab]);

  useEffect(() => {
    if (!uid) {
      setPlusActiveBySku(PLUS_SKUS.reduce((acc, id) => ({ ...acc, [id]: false }), {}));
      setActiveTrackerSubs([]);
      setLegacyMonthlyActive(false);
      return () => {};
    }
    return subscribeShopSubscriptionState(uid, (state) => {
      setPlusActiveBySku(state.plusActiveBySku);
      setActiveTrackerSubs(state.activeTrackerSubs);
      setLegacyMonthlyActive(state.legacyMonthlyActive);
    });
  }, [uid]);

  const monthlySubCount =
    activeTrackerSubs.length + (legacyMonthlyActive && activeTrackerSubs.length === 0 ? 1 : 0);

  const manageSubscriptions = useMemo(() => {
    const rows = activeTrackerSubs.map((sub) => ({ ...sub, kind: 'tracker' }));
    if (legacyMonthlyActive && activeTrackerSubs.length === 0) {
      const legacyId = `${user?.uid || ''}_PETPAL_PLUS_MONTHLY`;
      rows.unshift({
        id: legacyId,
        sku: 'PETPAL_PLUS_MONTHLY',
        kind: 'legacy',
      });
    }
    return rows;
  }, [activeTrackerSubs, legacyMonthlyActive, user?.uid]);

  const manageRows = useMemo(() => {
    return manageSubscriptions.map((sub) => {
      const imei = normalizeTrackerImei(sub.trackerImei || sub.imei);
      const petFromId = sub.petId ? pets.find((p) => p.id === sub.petId) || null : null;
      const petFromImei = imei ? petForImei(pets, imei) : null;
      const pet = petFromId || petFromImei;
      const petName = pet?.name || sub.petName || null;
      const nfcPetNames = (Array.isArray(sub.nfcPetIds) ? sub.nfcPetIds : [])
        .map((id) => pets.find((p) => p.id === id)?.name)
        .filter(Boolean);
      const awaitingImei = Boolean(sub.includeTracker !== false && !imei && sub.kind !== 'legacy');
      return { ...sub, imei, pet, petName, nfcPetNames, awaitingImei };
    });
  }, [manageSubscriptions, pets]);

  const [saveCardById, setSaveCardById] = useState(() =>
    [...SHOP_PRODUCTS, ...BUSINESS_BOOST_PRODUCTS].reduce((acc, p) => {
      acc[p.id] = p.recurring;
      return acc;
    }, {})
  );
  const [err, setErr] = useState('');

  const banner = useMemo(() => {
    if (checkout === 'fail') return { text: t('shopPage.checkoutFail') };
    if (checkout === 'error') return { text: t('shopPage.checkoutError') };
    return null;
  }, [checkout, t]);

  const monthlyAddonOpts = useMemo(
    () => ({
      includeTracker: monthlyIncludeTracker,
      nfcPetIds: monthlyIncludeNfc ? monthlyNfcPetIds : [],
    }),
    [monthlyIncludeTracker, monthlyIncludeNfc, monthlyNfcPetIds]
  );

  function addSubscriptionToCart(product) {
    setErr('');
    const saveCard = Boolean(saveCardById[product.id]);
    if (product.recurring && !saveCard) {
      setErr(t('shopPage.saveCardRequired'));
      return;
    }
    if (product.id === 'PETPAL_PLUS_MONTHLY' && !monthlyUseExistingImei && !monthlyIncludeTracker) {
      setErr(t('shopPage.trackerSourceRequired'));
      return;
    }
    if (product.id === 'PETPAL_PLUS_MONTHLY' && monthlyIncludeNfc && !monthlyNfcPetIds.length) {
      setErr(t('shopPage.nfcSelectPetRequired'));
      return;
    }
    if (product.id === 'PETPAL_PLUS_YEARLY' && !yearlyNfcPetIds.length) {
      setErr(t('shopPage.nfcSelectPetRequired'));
      return;
    }
    if (product.id === 'PETPAL_PLUS_MONTHLY' && monthlyUseExistingImei) {
      const imei = normalizeTrackerImei(monthlyExistingImei);
      if (!imei) {
        setErr(t('shopPage.existingImeiInvalid'));
        return;
      }
    }
    const includeTracker =
      product.id === 'PETPAL_PLUS_MONTHLY'
        ? monthlyIncludeTracker && !monthlyUseExistingImei
        : product.id === 'PETPAL_PLUS_YEARLY';
    const includeNfc =
      product.id === 'PETPAL_PLUS_MONTHLY'
        ? monthlyIncludeNfc
        : product.id === 'PETPAL_PLUS_YEARLY';
    const nfcPetIds =
      product.id === 'PETPAL_PLUS_MONTHLY'
        ? monthlyNfcPetIds
        : product.id === 'PETPAL_PLUS_YEARLY'
          ? yearlyNfcPetIds
          : [];
    const petNames = petOptions.filter((p) => nfcPetIds.includes(p.id)).map((p) => p.name);
    addToCart(
      buildSubscriptionCartItem(product, {
        includeTracker: product.id === 'TRACKER_HARDWARE' ? true : includeTracker,
        includeNfc,
        nfcPetIds,
        selectedDesignId: includeNfc ? selectedNfcDesignId : undefined,
        saveCard,
        petNames,
        t,
        trackerImei:
          product.id === 'PETPAL_PLUS_MONTHLY' && monthlyUseExistingImei
            ? normalizeTrackerImei(monthlyExistingImei)
            : undefined,
      })
    );
    setCheckoutError('');
    if (product.id === 'PETPAL_PLUS_MONTHLY') {
      setMonthlyIncludeTracker(false);
      setMonthlyIncludeNfc(false);
      setMonthlyNfcPetIds([]);
      setMonthlyUseExistingImei(false);
      setMonthlyExistingImei('');
    }
  }

  function onMarketplaceProduct(product) {
    setErr('');
    if (product.shopSku === 'NFC_TAG_HARDWARE') {
      navigate('/shop/nfc');
      return;
    }
    const shopProduct = SHOP_PRODUCTS.find((row) => row.id === product.shopSku);
    if (!shopProduct) return;
    addSubscriptionToCart(localizeShopProduct(shopProduct, t));
  }

  async function onCancelBoost(product) {
    if (!user) return;
    const kind = product.id === 'STORE_BOOST_NEARBY_MONTHLY' ? 'nearby' : 'bookings';
    const ok = window.confirm(t('shopPage.boostCancelConfirm'));
    if (!ok) return;
    setBoostCancelBusy(product.id);
    setCancelMsg('');
    try {
      await cancelBusinessBoost({ uid: user.uid, companyId: user.uid, kind });
      setCancelMsg(t('shopPage.boostCancelRequested'));
    } catch (e) {
      setCancelMsg(e?.message || String(e));
    } finally {
      setBoostCancelBusy('');
    }
  }

  async function onCancelSubscription(sub) {
    if (!user) return;
    const ok = window.confirm(t('shopPage.cancelConfirm'));
    if (!ok) return;
    setCancelBusy(sub.id);
    setCancelMsg('');
    try {
      await requestSubscriptionCancel({
        uid: user.uid,
        subscriptionId: sub.id,
        sku: sub.sku || 'PETPAL_PLUS_MONTHLY',
        imei: sub.imei || null,
      });
      setCancelMsg(t('shopPage.cancelRequested'));
    } catch (e) {
      setCancelMsg(e?.message || String(e));
    } finally {
      setCancelBusy(null);
    }
  }

  if (!isFirebaseConfigured()) {
    return (
      <div className="pp-pad">
        <h1 className="pp-pageHeader__title">{t('shopPage.needFirebaseTitle')}</h1>
        <p className="pp-subtle">{t('shopPage.needFirebaseSub')}</p>
      </div>
    );
  }

  return (
    <div className="pp-pad pp-shopPage">
      {!user ? (
        <div className="pp-shopGuestBanner" role="note">
          <p className="pp-shopGuestBanner__text">{t('shopPage.guestBanner')}</p>
          <div className="pp-shopGuestBanner__actions">
            <Link className="pp-btn pp-btn--primary" to="/login" state={{ from: '/shop' }}>
              {t('shopPage.guestSignInCta')}
            </Link>
            <Link className="pp-btn pp-btn--ghost" to="/register">
              {t('shopPage.guestRegisterCta')}
            </Link>
          </div>
        </div>
      ) : null}
      <div className="pp-shopTabs" role="tablist" aria-label={t('shopPage.tabsAria')}>
        <button
          type="button"
          role="tab"
          aria-selected={shopTab === 'subscriptions'}
          className={`pp-shopTabs__btn${shopTab === 'subscriptions' ? ' is-active' : ''}`}
          onClick={() => setShopTab('subscriptions')}
        >
          {t('shopPage.tabSubscriptions')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={shopTab === 'products'}
          className={`pp-shopTabs__btn${shopTab === 'products' ? ' is-active' : ''}`}
          onClick={() => setShopTab('products')}
        >
          {t('shopPage.tabProducts')}
        </button>
      </div>

      {banner ? (
        <div className="pp-shopBanner pp-shopBanner--warn" role="status">
          {banner.text}
        </div>
      ) : null}
      {err ? <div className="pp-error" style={{ marginTop: 12 }}>{err}</div> : null}
      {cancelMsg ? <div className="pp-shopBanner" role="status">{cancelMsg}</div> : null}

      {cartItems.length ? <ShopCartBar /> : null}

      {shopTab === 'subscriptions' ? (
        <>
          <div className="pp-shopInfoBox" role="note">
            <strong>{t('shopPage.subInfoTitle')}</strong>
          </div>

          {showBusinessBoosts ? (
            <section className="pp-shopBoostSection" style={{ marginBottom: 18 }}>
              <h2 className="pp-sectionTitle">{t('shopPage.boostSectionTitle')}</h2>
              <div className="pp-shopGrid" style={{ marginTop: 12 }}>
                {localizedBoostProducts.map((p) => {
                    const boostActive =
                      p.id === 'STORE_BOOST_NEARBY_MONTHLY'
                        ? providerNearbyBoostIsActive(providerDoc)
                        : providerBookingsBoostIsActive(providerDoc);
                    const inCartQty = cartItems
                      .filter((row) => row.sku === p.id)
                      .reduce((sum, row) => sum + (row.qty || 1), 0);
                    return (
                      <article
                        key={p.id}
                        ref={(el) => {
                          cardRefs.current[p.id] = el;
                        }}
                        className={`pp-card pp-shopCard pp-shopCard--boost${focusSku === p.id ? ' pp-shopCard--focus' : ''}`}
                      >
                        <div className="pp-shopCard__body">
                          <span className="pp-shopCard__badge">{p.badge}</span>
                          <h3 className="pp-sectionTitle" style={{ margin: '6px 0 4px' }}>
                            {p.title}
                          </h3>
                          {inCartQty > 0 ? (
                            <p className="pp-shopCard__inCart">{t('shopPage.inCartQty', { count: inCartQty })}</p>
                          ) : null}
                          <p className="pp-subtle" style={{ marginTop: 0 }}>
                            {p.subtitle}
                          </p>
                          <p className={`pp-shopCard__status${boostActive ? ' pp-shopCard__status--on' : ''}`}>
                            {boostActive ? t('shopPage.boostActive') : t('shopPage.plusBadgeInactive')}
                          </p>
                          <div className="pp-shopCard__price">{formatShopPrice(p, t)}</div>
                          <p className="pp-shopCard__dueToday">{t('shopPage.dueToday', { amount: formatEur(p.amountCents) })}</p>
                        </div>
                        <div className="pp-shopCard__foot">
                          <label className="pp-shopSaveRow">
                            <input
                              type="checkbox"
                              checked={Boolean(saveCardById[p.id])}
                              disabled={boostActive}
                              onChange={(e) => setSaveCardById((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                            />
                            <span>{t('shopPage.saveCardLabel')}</span>
                          </label>
                          <button
                            type="button"
                            className={`pp-btn ${boostActive ? 'pp-btn--ghost' : 'pp-btn--primary'} pp-shopCard__payBtn`}
                            disabled={boostActive ? boostCancelBusy === p.id : false}
                            onClick={() => (boostActive ? onCancelBoost(p) : addSubscriptionToCart(p))}
                          >
                            {boostActive
                              ? boostCancelBusy === p.id
                                ? t('shopPage.cancelBusy')
                                : t('shopPage.boostCancelCta')
                              : t('shopPage.addToCart')}
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            </section>
          ) : null}

          <SubscriptionCarousel ariaLabel={t('shopPage.subCarouselAria')}>
            {localizedSubscriptionProducts.map((p) => {
              const planActive = PLUS_SKUS.includes(p.id)
                ? p.id === 'PETPAL_PLUS_MONTHLY'
                  ? monthlySubCount > 0
                  : plusActiveBySku[p.id]
                : false;
              const isLoading = false;
              const monthlyActive = monthlySubCount > 0;
              const monthlyAddOnMode = p.id === 'PETPAL_PLUS_MONTHLY' && monthlyActive;
              const dueTodayCents =
                p.id === 'PETPAL_PLUS_MONTHLY' ? monthlyFirstPaymentCents(monthlyAddonOpts) : p.amountCents;
              const hasMonthlyAddons =
                monthlyIncludeTracker || (monthlyIncludeNfc && monthlyNfcPetIds.length > 0);
              const monthlyTrackerSourceSelected = monthlyUseExistingImei || monthlyIncludeTracker;
              const monthlyExistingImeiValid =
                !monthlyUseExistingImei || Boolean(normalizeTrackerImei(monthlyExistingImei));
              const monthlyCanAddToCart = monthlyTrackerSourceSelected && monthlyExistingImeiValid;
              const showNfcPicker =
                (p.id === 'PETPAL_PLUS_MONTHLY' && monthlyIncludeNfc) ||
                p.id === 'PETPAL_PLUS_YEARLY';
              const inCartQty = cartItems
                .filter((row) => row.sku === p.id)
                .reduce((sum, row) => sum + (row.qty || 1), 0);

              return (
                <article
                  key={p.id}
                  ref={(el) => {
                    cardRefs.current[p.id] = el;
                  }}
                  className={`pp-card pp-shopCard pp-shopCard--featured${focusSku === p.id ? ' pp-shopCard--focus' : ''}`}
                >
                  <div className="pp-shopCard__body">
                    <div className="pp-shopCard__head">
                      <div className="pp-shopCard__headMain">
                        <h2 className="pp-sectionTitle pp-shopCard__planTitle" style={{ margin: 0 }}>
                          {p.id === 'PETPAL_PLUS_MONTHLY'
                            ? monthlyIncludeNfc
                              ? t('shopPage.planTitleLiveGpsNfc')
                              : t('shopPage.planTitleLiveGps')
                            : p.id === 'PETPAL_PLUS_YEARLY'
                              ? t('shopPage.planTitleLiveGpsNfc')
                              : p.title}
                        </h2>
                        <span className="pp-shopCard__planPeriod">{p.title}</span>
                      </div>
                      {PLUS_SKUS.includes(p.id) ? (
                        <p
                          className={`pp-shopCard__status pp-shopCard__status--corner${
                            planActive ? ' pp-shopCard__status--on' : ''
                          }`}
                        >
                          {planActive ? t('shopPage.plusBadgeActive') : t('shopPage.plusBadgeInactive')}
                        </p>
                      ) : null}
                    </div>
                    <ShopPlanFeatureList />
                    {inCartQty > 0 ? (
                      <p className="pp-shopCard__inCart">{t('shopPage.inCartQty', { count: inCartQty })}</p>
                    ) : null}
                    {p.subtitle ? (
                      <p className="pp-subtle" style={{ marginTop: 0 }}>
                        {p.subtitle}
                      </p>
                    ) : null}
                    {p.id === 'PETPAL_PLUS_MONTHLY' && monthlySubCount > 0 ? (
                      <p className="pp-subtle pp-shopCard__trackerCount">
                        {t('shopPage.trackerEntitlements', { count: monthlySubCount })}
                      </p>
                    ) : null}
                    {p.id === 'PETPAL_PLUS_MONTHLY' && (!planActive || monthlyAddOnMode) ? (
                      <div className="pp-shopAddons">
                        <label className="pp-shopTrackerOpt">
                          <input
                            type="checkbox"
                            checked={monthlyUseExistingImei}
                            disabled={isLoading}
                            onChange={(e) => {
                              setMonthlyUseExistingImei(e.target.checked);
                              if (e.target.checked) {
                                setMonthlyIncludeTracker(false);
                              } else {
                                setMonthlyExistingImei('');
                              }
                            }}
                          />
                          <span className="pp-shopTrackerOpt__copy">
                            <strong>{t('shopPage.monthlyExistingImeiTitle')}</strong>
                            {t('shopPage.monthlyExistingImeiSub') ? (
                              <small>{t('shopPage.monthlyExistingImeiSub')}</small>
                            ) : null}
                          </span>
                          <span className="pp-shopTrackerOpt__meta">
                            <span className="pp-shopTrackerOpt__switch" aria-hidden />
                          </span>
                        </label>
                        {monthlyUseExistingImei ? (
                          <label className="pp-field" style={{ marginTop: 10 }}>
                            <span className="pp-field__label">{t('shopPage.monthlyExistingImeiLabel')}</span>
                            <div className="pp-row" style={{ alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
                              <input
                                className="pp-input"
                                style={{ flex: '1 1 160px', minWidth: 0 }}
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder={t('shopPage.monthlyExistingImeiPlaceholder')}
                                value={monthlyExistingImei}
                                disabled={isLoading}
                                onChange={(e) => setMonthlyExistingImei(e.target.value.replace(/\D/g, '').slice(0, 20))}
                              />
                              <ImeiQrScannerButton
                                onImei={setMonthlyExistingImei}
                                disabled={isLoading}
                              />
                            </div>
                          </label>
                        ) : null}
                        <label className="pp-shopTrackerOpt pp-shopTrackerOpt--withImage">
                          <input
                            type="checkbox"
                            checked={monthlyIncludeTracker}
                            disabled={isLoading || monthlyUseExistingImei}
                            onChange={(e) => setMonthlyIncludeTracker(e.target.checked)}
                          />
                          <div className="pp-shopTrackerOpt__imgWrap" aria-hidden>
                            <ShopDeferredImage
                              className="pp-shopTrackerOpt__img"
                              src={trackerImage}
                              alt=""
                            />
                          </div>
                          <span className="pp-shopTrackerOpt__copy">
                            <strong>
                              {monthlyAddOnMode
                                ? t('shopPage.monthlyAddTrackerAgainTitle')
                                : t('shopPage.monthlyAddTrackerTitle')}
                            </strong>
                            {monthlyAddOnMode && t('shopPage.monthlyAddTrackerAgainSub') ? (
                              <small>
                                {t('shopPage.monthlyAddTrackerAgainSub')}
                              </small>
                            ) : !monthlyAddOnMode && t('shopPage.monthlyAddTrackerSub') ? (
                              <small>{t('shopPage.monthlyAddTrackerSub')}</small>
                            ) : null}
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
                            onChange={(e) => {
                              setMonthlyIncludeNfc(e.target.checked);
                              if (!e.target.checked) setMonthlyNfcPetIds([]);
                            }}
                          />
                          <span className="pp-shopTrackerOpt__copy">
                            <strong>{t('shopPage.monthlyAddNfcTitle')}</strong>
                            {monthlyAddOnMode && t('shopPage.monthlyAddNfcAgainSub') ? (
                              <small>{t('shopPage.monthlyAddNfcAgainSub')}</small>
                            ) : !monthlyAddOnMode && t('shopPage.monthlyAddNfcSub') ? (
                              <small>{t('shopPage.monthlyAddNfcSub')}</small>
                            ) : null}
                          </span>
                          <span className="pp-shopTrackerOpt__meta">
                            <span className="pp-shopTrackerOpt__price">+{formatEur(NFC_TAG_ADDON_CENTS)}</span>
                            <span className="pp-shopTrackerOpt__switch" aria-hidden />
                          </span>
                        </label>
                      </div>
                    ) : null}
                    {p.id === 'PETPAL_PLUS_YEARLY' ? (
                      <div className="pp-shopAddons pp-shopAddons--yearly">
                        <div
                          className="pp-shopTrackerOpt pp-shopTrackerOpt--withImage pp-shopTrackerOpt--included"
                          aria-disabled="true"
                        >
                          <div className="pp-shopTrackerOpt__imgWrap" aria-hidden>
                            <ShopDeferredImage
                              className="pp-shopTrackerOpt__img"
                              src={trackerImage}
                              alt=""
                            />
                          </div>
                          <span className="pp-shopTrackerOpt__copy">
                            <strong>{t('shopPage.planTitleLiveGps')}</strong>
                            <small>{t('shopPage.yearlyTrackerIncludedSub')}</small>
                          </span>
                          <span className="pp-shopTrackerOpt__meta">
                            <span className="pp-shopTrackerOpt__price pp-shopTrackerOpt__price--included">
                              {t('shopPage.yearlyTrackerIncludedBadge')}
                            </span>
                            <span className="pp-shopTrackerOpt__switch" aria-hidden />
                          </span>
                        </div>
                      </div>
                    ) : null}
                    {showNfcPicker ? (
                      <>
                        <ShopPetPicker
                          pets={petOptions}
                          guest={!user}
                          selectedIds={
                            p.id === 'PETPAL_PLUS_MONTHLY' ? monthlyNfcPetIds : yearlyNfcPetIds
                          }
                          disabled={isLoading}
                          onChange={
                            p.id === 'PETPAL_PLUS_MONTHLY'
                              ? setMonthlyNfcPetIds
                              : setYearlyNfcPetIds
                          }
                        />
                        <NfcDesignSelector
                          selectedDesignId={selectedNfcDesignId}
                          onChange={setSelectedNfcDesignId}
                          disabled={isLoading}
                          designs={nfcDesigns}
                        />
                      </>
                    ) : null}
                    {p.id === 'PETPAL_PLUS_MONTHLY' && monthlyIncludeNfc && monthlyNfcPetIds.length > 0 ? (
                      <p className="pp-subtle pp-shopCard__nfcPerPet">
                        {t('shopPage.nfcPerPetNote', {
                          count: monthlyNfcPetIds.length,
                          amount: formatEur(NFC_TAG_ADDON_CENTS * monthlyNfcPetIds.length),
                        })}
                      </p>
                    ) : null}
                    <div className="pp-shopCard__price">{formatShopPrice(p, t)}</div>
                    {p.id === 'PETPAL_PLUS_YEARLY' ? (
                      <p className="pp-subtle pp-shopCard__renewalNote">
                        {t('shopPage.yearlyRenewalNote', { amount: formatEur(PLUS_YEARLY_RENEWAL_CENTS) })}
                      </p>
                    ) : null}
                    {p.id === 'PETPAL_PLUS_MONTHLY' ? (
                      <p className="pp-shopCard__dueToday">
                        {t('shopPage.dueToday', { amount: formatEur(dueTodayCents) })}
                        {hasMonthlyAddons ? (
                          <span className="pp-shopCard__dueTodayNote"> {t('shopPage.dueTodayWithAddons')}</span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="pp-shopCard__foot">
                    {p.recurring ? (
                      <label className="pp-shopSaveRow">
                        <input
                          type="checkbox"
                          checked={Boolean(saveCardById[p.id])}
                          disabled={(PLUS_SKUS.includes(p.id) && planActive && p.id !== 'PETPAL_PLUS_MONTHLY') || isLoading}
                          onChange={(e) => setSaveCardById((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                        />
                        <span>{t('shopPage.saveCardLabel')}</span>
                      </label>
                    ) : null}
                    <button
                      type="button"
                      className="pp-btn pp-btn--primary pp-shopCard__payBtn"
                      disabled={
                        (p.id === 'PETPAL_PLUS_YEARLY' && planActive) ||
                        (p.id === 'PETPAL_PLUS_MONTHLY' && !monthlyCanAddToCart)
                      }
                      onClick={() => addSubscriptionToCart(p)}
                    >
                      {p.id === 'PETPAL_PLUS_MONTHLY' && monthlyAddOnMode
                        ? t('shopPage.addAnotherSubscriptionCta')
                        : p.id === 'PETPAL_PLUS_YEARLY' && planActive
                          ? t('shopPage.plusSubscribedCta')
                          : t('shopPage.addToCart')}
                    </button>
                  </div>
                </article>
              );
            })}
          </SubscriptionCarousel>

          {user ? <ProfilePaymentMethod /> : null}

          {user && (manageRows.length || plusActiveBySku.PETPAL_PLUS_YEARLY) ? (
            <section className="pp-card pp-pad pp-shopManage pp-shopManage--prominent">
              <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>
                {t('shopPage.manageTitle')}
              </h2>
              <ul className="pp-shopManage__list">
                {manageRows.map((sub) => {
                  const petName = sub.petName || sub.pet?.name || null;
                  const title =
                    sub.kind === 'legacy'
                      ? t('shopPage.manageLegacyMonthlyRow')
                      : petName
                        ? t('shopPage.manageForPet', { pet: petName })
                        : sub.awaitingImei
                          ? t('shopPage.manageAwaitingImei')
                          : sub.imei
                            ? t('shopPage.manageForImei', { imei: formatImeiTail(sub.imei) })
                            : t('shopPage.manageUnlinked');
                  const detail = sub.imei
                    ? petName
                      ? t('shopPage.managePetLinked', { pet: petName }) +
                        ` · ${t('shopPage.manageImeiDetail', { imei: sub.imei })}`
                      : t('shopPage.manageImeiDetail', { imei: sub.imei })
                    : sub.kind === 'legacy'
                      ? t('shopPage.manageLegacyImeiHint')
                      : t('shopPage.manageLinkOnMyPets');
                  return (
                    <li key={sub.id} className="pp-shopManage__row">
                      <div className="pp-shopManage__copy">
                        <strong className="pp-shopManage__title">{title}</strong>
                        <span className="pp-subtle pp-shopManage__detail">{detail}</span>
                      </div>
                      <button
                        type="button"
                        className="pp-btn pp-btn--ghost"
                        disabled={cancelBusy === sub.id}
                        onClick={() => void onCancelSubscription(sub)}
                      >
                        {cancelBusy === sub.id ? t('shopPage.cancelBusy') : t('shopPage.cancelCta')}
                      </button>
                    </li>
                  );
                })}
                {plusActiveBySku.PETPAL_PLUS_YEARLY ? (
                  <li className="pp-shopManage__row">
                    <div className="pp-shopManage__copy">
                      <strong className="pp-shopManage__title">{t('shopPage.manageYearlyRow')}</strong>
                      <span className="pp-subtle pp-shopManage__detail">{t('shopPage.manageYearlyDetail')}</span>
                      <span className="pp-shopManage__cancelNote">{t('shopPage.manageCancelYearly')}</span>
                    </div>
                    <button
                      type="button"
                      className="pp-btn pp-btn--ghost"
                      disabled={cancelBusy === 'yearly'}
                      onClick={() =>
                        void onCancelSubscription({ id: 'yearly', sku: 'PETPAL_PLUS_YEARLY' })
                      }
                    >
                      {cancelBusy === 'yearly' ? t('shopPage.cancelBusy') : t('shopPage.cancelCta')}
                    </button>
                  </li>
                ) : null}
              </ul>
              <p className="pp-subtle pp-shopManage__afterCancel">{t('shopPage.manageAfterCancel')}</p>
            </section>
          ) : null}
        </>
      ) : (
        <>
          {hasMarketplaceProducts ? (
            <>
              <p className="pp-subtle pp-shopProductsLead">{t('shopPage.productsLead')}</p>
              <section className="pp-shopSellerSection" aria-labelledby="shop-seller-heading">
                <h2 id="shop-seller-heading" className="pp-sectionTitle">
                  {MARKETPLACE_SELLER}
                </h2>
                <p className="pp-subtle pp-shopSellerSection__sub">{t('shopPage.productsHardwareLead')}</p>
                <div className="pp-shopProductGrid">
                  {localizedMarketplaceProducts.map((product) => (
                    <article
                      key={product.id}
                      ref={(el) => {
                        cardRefs.current[product.shopSku] = el;
                      }}
                      className={`pp-card pp-shopProductCard pp-shopProductCard--hardware${focusSku === product.shopSku ? ' pp-shopCard--focus' : ''}`}
                    >
                      {product.shopSku === 'TRACKER_HARDWARE' ? (
                        <ShopDeferredImage
                          className="pp-shopProductCard__img"
                          src={trackerImage}
                          alt={product.title}
                        />
                      ) : product.shopSku === 'NFC_TAG_HARDWARE' ? (
                        <div className="pp-shopProductCard__nfcExample">
                          <span className="pp-shopProductCard__nfcExampleLabel">
                            {t('shopPage.productsNfcExample')}
                          </span>
                          <ShopDeferredImage
                            className="pp-shopProductCard__img pp-shopProductCard__img--nfc"
                            src={nfcProductImage}
                            alt={product.title}
                          />
                        </div>
                      ) : (
                        <div className="pp-shopProductCard__emoji" aria-hidden>
                          {product.emoji}
                        </div>
                      )}
                      <p className="pp-shopProductCard__company">{product.companyName}</p>
                      <span className="pp-shopProductCard__category">{product.category}</span>
                      <h3 className="pp-shopProductCard__title">{product.title}</h3>
                      <p className="pp-subtle pp-shopProductCard__desc">{product.description}</p>
                      <div className="pp-shopProductCard__foot">
                        <strong>{formatEur(product.priceCents)}</strong>
                        <button
                          type="button"
                          className="pp-btn pp-btn--primary"
                          onClick={() => onMarketplaceProduct(product)}
                        >
                          {product.shopSku === 'NFC_TAG_HARDWARE'
                            ? t('shopPage.productsNfcCustomizeCta')
                            : t('shopPage.addToCart')}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="pp-shopEmptyProducts" role="status">
              <h2 className="pp-shopEmptyProducts__title">{t('shopPage.productsEmptyTitle')}</h2>
              <p className="pp-subtle pp-shopEmptyProducts__body">{t('shopPage.productsEmptyBody')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
