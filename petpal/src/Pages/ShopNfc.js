import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { usePets } from '../pets/PetsContext';
import { isFirebaseConfigured } from '../firebase';
import { useI18n } from '../i18n/I18nContext';
import ShopCartBar from '../components/shop/ShopCartBar';
import ShopPetPicker from '../components/shop/ShopPetPicker';
import NfcDesignSelector from '../components/shop/NfcDesignSelector';
import { useShopAssets } from '../hooks/useShopAssets';
import {
  localizeShopProduct,
  NFC_TAG_ADDON_CENTS,
  SHOP_PRODUCTS,
  formatEur,
  formatShopPrice,
} from '../shop/catalog';
import { useShopCart } from '../shop/ShopCartContext';
import { buildSubscriptionCartItem } from '../shop/shopCartHelpers';

const NFC_PRODUCT = SHOP_PRODUCTS.find((p) => p.id === 'NFC_TAG_HARDWARE');

export default function ShopNfc() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { pets } = usePets();
  const { addToCart, cartItems, setCheckoutError } = useShopCart();
  const { nfcDesigns } = useShopAssets();
  const [nfcPetIds, setNfcPetIds] = useState(/** @type {string[]} */ ([]));
  const [selectedDesignId, setSelectedDesignId] = useState(1);
  const [err, setErr] = useState('');

  const product = useMemo(
    () => (NFC_PRODUCT ? localizeShopProduct(NFC_PRODUCT, t) : null),
    [t]
  );

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
  );

  useEffect(() => {
    if (!nfcDesigns.some((d) => d.id === selectedDesignId)) {
      setSelectedDesignId(nfcDesigns[0]?.id || 1);
    }
  }, [nfcDesigns, selectedDesignId]);

  function onAddToCart() {
    if (!product) return;
    setErr('');
    if (!nfcPetIds.length) {
      setErr(t('shopPage.nfcSelectPetRequired'));
      return;
    }
    const petNames = petOptions.filter((p) => nfcPetIds.includes(p.id)).map((p) => p.name);
    addToCart(
      buildSubscriptionCartItem(product, {
        includeTracker: false,
        includeNfc: true,
        nfcPetIds,
        selectedDesignId,
        saveCard: false,
        petNames,
        t,
      })
    );
    setCheckoutError('');
    setNfcPetIds([]);
  }

  if (!isFirebaseConfigured()) {
    return (
      <div className="pp-pad">
        <h1 className="pp-pageHeader__title">{t('shopPage.needFirebaseTitle')}</h1>
        <p className="pp-subtle">{t('shopPage.needFirebaseSub')}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pp-pad">
        <p className="pp-subtle">{t('shopNfcPage.unavailable')}</p>
      </div>
    );
  }

  return (
    <div className="pp-pad pp-shopPage pp-shopNfcPage">
      {!user ? (
        <div className="pp-shopGuestBanner" role="note">
          <p className="pp-shopGuestBanner__text">{t('shopNfcPage.guestBanner')}</p>
          <div className="pp-shopGuestBanner__actions">
            <Link className="pp-btn pp-btn--primary" to="/login" state={{ from: '/shop/nfc' }}>
              {t('shopPage.guestSignInCta')}
            </Link>
          </div>
        </div>
      ) : null}

      <header className="pp-shopNfcPage__head">
        <Link className="pp-subtle pp-shopNfcPage__back" to="/shop">
          {t('shopNfcPage.backToShop')}
        </Link>
        <h1 className="pp-h1" style={{ marginTop: 8, marginBottom: 4 }}>
          {t('shopNfcPage.title')}
        </h1>
        <p className="pp-subtle">{t('shopNfcPage.lead')}</p>
      </header>

      {cartItems.length ? <ShopCartBar /> : null}
      {err ? <div className="pp-error">{err}</div> : null}

      <article className="pp-card pp-shopCard pp-shopCard--featured pp-shopNfcPage__card">
        <div className="pp-shopCard__body">
          <span className="pp-shopCard__badge">{product.badge}</span>
          <h2 className="pp-sectionTitle" style={{ margin: '6px 0 4px' }}>
            {product.title}
          </h2>
          {product.subtitle ? <p className="pp-subtle">{product.subtitle}</p> : null}
          <ShopPetPicker
            pets={petOptions}
            guest={!user}
            selectedIds={nfcPetIds}
            onChange={setNfcPetIds}
          />
          <NfcDesignSelector
            selectedDesignId={selectedDesignId}
            onChange={setSelectedDesignId}
            designs={nfcDesigns}
          />
          {nfcPetIds.length > 0 ? (
            <p className="pp-subtle pp-shopCard__nfcPerPet">
              {t('shopPage.nfcPerPetNote', {
                count: nfcPetIds.length,
                amount: formatEur(NFC_TAG_ADDON_CENTS * nfcPetIds.length),
              })}
            </p>
          ) : null}
          <div className="pp-shopCard__price">{formatShopPrice(product, t)}</div>
          <p className="pp-shopCard__highlight">{t('shopNfcPage.yearlyHint')}</p>
        </div>
        <div className="pp-shopCard__foot">
          <button type="button" className="pp-btn pp-btn--primary pp-shopCard__payBtn" onClick={onAddToCart}>
            {t('shopPage.addToCart')}
          </button>
          <Link className="pp-btn pp-btn--ghost" to="/shop?sku=PETPAL_PLUS_YEARLY">
            {t('shopNfcPage.yearlyCta')}
          </Link>
        </div>
      </article>
    </div>
  );
}
