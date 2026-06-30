import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { formatEur } from '../../shop/catalog';
import { useI18n } from '../../i18n/I18nContext';
import { useShopCartOptional } from '../../shop/ShopCartContext';
import { isSubscriptionCartLine } from '../../shop/shopCartHelpers';

export default function ShopCartMobilePanel() {
  const { t } = useI18n();
  const location = useLocation();
  const cart = useShopCartOptional();
  const onShopRoute = location.pathname.startsWith('/shop');

  const lockQtyForKeys = useMemo(
    () => (cart?.cartItems || []).filter(isSubscriptionCartLine).map((row) => row.key),
    [cart?.cartItems]
  );

  if (!cart || !onShopRoute || !cart.cartItems.length || !cart.expanded) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="pp-shopCartBackdrop"
        aria-label={t('shopPage.cartHide')}
        onClick={() => cart.setExpanded(false)}
      />
      <aside className="pp-shopCart pp-shopCart--mobilePanel pp-shopCart--expanded" aria-label={t('shopPage.cartAria')}>
        <div className="pp-shopCart__mobileHead">
          <strong>{t('shopPage.cartTitle')}</strong>
          <button type="button" className="pp-shopCart__mobileClose" onClick={() => cart.setExpanded(false)}>
            {t('shopPage.cartHide')}
          </button>
        </div>
        <div className="pp-shopCart__body">
          <p className="pp-subtle pp-shopCart__hint">{t('shopPage.cartExpandedHint')}</p>
          <ul className="pp-shopCart__list">
            {cart.cartItems.map((row) => {
              const lockQty = lockQtyForKeys.includes(row.key);
              return (
                <li key={`mobile-${row.key}`} className="pp-shopCart__row">
                  <div className="pp-shopCart__rowMain">
                    <div className="pp-shopCart__rowTitle">
                      {row.title}
                      {!lockQty ? <span className="pp-shopCart__qtyBadge">×{row.qty}</span> : null}
                    </div>
                    {row.subtitle ? <div className="pp-subtle pp-shopCart__rowSub">{row.subtitle}</div> : null}
                    <div className="pp-subtle pp-shopCart__unitPrice">
                      {formatEur(row.priceCents)} {t('shopPage.cartEach')}
                    </div>
                  </div>
                  <div className="pp-shopCart__rowMeta">
                    <strong>{formatEur(row.priceCents * row.qty)}</strong>
                    <button
                      type="button"
                      className="pp-shopCart__remove"
                      onClick={() => cart.removeFromCart(row.key)}
                      aria-label={t('shopPage.cartRemove')}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="pp-shopCart__foot">
            <div className="pp-shopCart__total">
              {t('shopPage.cartTotal', { amount: formatEur(cart.totalCents) })}
            </div>
            {cart.checkoutError ? <div className="pp-error pp-shopCart__error">{cart.checkoutError}</div> : null}
            <button
              type="button"
              className="pp-btn pp-btn--primary pp-shopCart__checkout"
              disabled={!cart.cartItems.length}
              onClick={() => cart.goToCheckout()}
            >
              {t('shopPage.cartContinueCta')}
            </button>
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
