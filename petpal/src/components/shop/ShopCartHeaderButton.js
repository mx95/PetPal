import React from 'react';
import { useLocation } from 'react-router-dom';
import { formatEur } from '../../shop/catalog';
import { useShopCartOptional } from '../../shop/ShopCartContext';
import { useI18n } from '../../i18n/I18nContext';

export default function ShopCartHeaderButton() {
  const { t } = useI18n();
  const location = useLocation();
  const cart = useShopCartOptional();
  const onShopRoute = location.pathname.startsWith('/shop');

  if (!cart || !onShopRoute || !cart.itemCount) return null;

  return (
    <button
      type="button"
      className="pp-shopCartHeaderBtn lg:hidden"
      aria-expanded={cart.expanded}
      aria-label={t('shopPage.cartView', { count: cart.itemCount, amount: formatEur(cart.totalCents) })}
      onClick={() => cart.setExpanded(true)}
    >
      <span className="pp-shopCartHeaderBtn__icon" aria-hidden>
        🛒
      </span>
      <span className="pp-shopCartHeaderBtn__meta">
        <span className="pp-shopCartHeaderBtn__count">{cart.itemCount}</span>
        <span className="pp-shopCartHeaderBtn__amount">{formatEur(cart.totalCents)}</span>
      </span>
    </button>
  );
}
