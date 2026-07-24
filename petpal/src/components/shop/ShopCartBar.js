import React, { useMemo } from 'react';
import { formatEur } from '../../shop/catalog';
import { useI18n } from '../../i18n/I18nContext';
import { useShopCart } from '../../shop/ShopCartContext';
import { isSubscriptionCartLine, localizeCartItem } from '../../shop/shopCartHelpers';

export default function ShopCartBar() {
  const { t } = useI18n();
  const {
    cartItems,
    itemCount,
    totalCents,
    expanded,
    setExpanded,
    removeFromCart,
    updateCartQty,
    goToCheckout,
    checkoutError,
  } = useShopCart();

  const lockQtyForKeys = useMemo(
    () => cartItems.filter(isSubscriptionCartLine).map((row) => row.key),
    [cartItems]
  );

  if (!cartItems.length) return null;

  return (
    <>
      <aside
        className={`pp-shopCart pp-shopCart--pageBar${expanded ? ' pp-shopCart--expanded' : ''}`}
        aria-label={t('shopPage.cartAria')}
      >
        <div className="pp-shopCart__bar">
          <button
            type="button"
            className="pp-btn pp-btn--primary pp-shopCart__viewBtn"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? t('shopPage.cartHide')
              : t('shopPage.cartView', { count: itemCount, amount: formatEur(totalCents) })}
          </button>
        </div>

        {expanded ? (
          <div className="pp-shopCart__body">
            <p className="pp-subtle pp-shopCart__hint">{t('shopPage.cartExpandedHint')}</p>
            <ul className="pp-shopCart__list">
              {cartItems.map((row) => {
                const lockQty = lockQtyForKeys.includes(row.key);
                const displayRow = localizeCartItem(row, t);
                return (
                  <li key={row.key} className="pp-shopCart__row">
                    <div className="pp-shopCart__rowMain">
                      <div className="pp-shopCart__rowTitle">
                        {displayRow.title}
                        {!lockQty ? <span className="pp-shopCart__qtyBadge">×{row.qty}</span> : null}
                      </div>
                      {displayRow.subtitle ? <div className="pp-subtle pp-shopCart__rowSub">{displayRow.subtitle}</div> : null}
                      <div className="pp-subtle pp-shopCart__unitPrice">
                        {formatEur(row.priceCents)} {t('shopPage.cartEach')}
                      </div>
                      {!lockQty ? (
                        <div className="pp-shopCart__qtyControls">
                          <button
                            type="button"
                            className="pp-shopCart__qtyBtn"
                            aria-label={t('shopPage.cartDecrease')}
                            disabled={row.qty <= 1}
                            onClick={() => updateCartQty(row.key, row.qty - 1)}
                          >
                            −
                          </button>
                          <span className="pp-shopCart__qtyValue">{row.qty}</span>
                          <button
                            type="button"
                            className="pp-shopCart__qtyBtn"
                            aria-label={t('shopPage.cartIncrease')}
                            onClick={() => updateCartQty(row.key, row.qty + 1)}
                          >
                            +
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="pp-shopCart__rowMeta">
                      <strong>{formatEur(row.priceCents * row.qty)}</strong>
                      <button
                        type="button"
                        className="pp-shopCart__remove"
                        onClick={() => removeFromCart(row.key)}
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
              <div className="pp-shopCart__total">{t('shopPage.cartTotal', { amount: formatEur(totalCents) })}</div>
              {checkoutError ? <div className="pp-error pp-shopCart__error">{checkoutError}</div> : null}
              <button
                type="button"
                className="pp-btn pp-btn--primary pp-shopCart__checkout"
                disabled={!cartItems.length}
                onClick={() => goToCheckout()}
              >
                {t('shopPage.cartContinueCta')}
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
