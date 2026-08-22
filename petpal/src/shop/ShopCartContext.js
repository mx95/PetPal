import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { marketplaceCartTotalCents, PLUS_SKUS, BOOST_SKUS } from './catalog';
import { clearShopCartItems, readShopCartItems, writeShopCartItems } from './shopCartStorage';
import { isSubscriptionCartLine, validateCartForCheckout } from './shopCartHelpers';
import { clearPendingCheckout, readPendingCheckout, savePendingCheckout } from './pendingCheckout';

/** @typedef {import('./shopCartHelpers').CartItem} CartItem */

const ShopCartContext = createContext(null);

function initialCartItems() {
  const stored = readShopCartItems();
  if (stored.length) return stored;
  return readPendingCheckout()?.cartItems ?? [];
}

export function ShopCartProvider({ children }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const [cartItems, setCartItemsState] = useState(initialCartItems);
  const [expanded, setExpanded] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const setCartItems = useCallback((updater) => {
    setCartItemsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      writeShopCartItems(next);
      return next;
    });
  }, []);

  const itemCount = useMemo(
    () => cartItems.reduce((sum, row) => sum + (row.qty || 1), 0),
    [cartItems]
  );
  const totalCents = useMemo(() => marketplaceCartTotalCents(cartItems), [cartItems]);

  const addToCart = useCallback(
    (item) => {
      setCheckoutError('');
      setCartItems((prev) => {
        if (isSubscriptionCartLine(item)) {
          return [...prev, { ...item, qty: 1 }];
        }
        const existing = prev.find((x) => x.key === item.key && !isSubscriptionCartLine(x));
        if (existing) {
          return prev.map((x) => (x.key === item.key ? { ...x, qty: x.qty + 1 } : x));
        }
        return [...prev, { ...item, qty: item.qty || 1 }];
      });
    },
    [setCartItems]
  );

  const removeFromCart = useCallback(
    (key) => {
      setCartItems((prev) => prev.filter((x) => x.key !== key));
    },
    [setCartItems]
  );

  const updateCartQty = useCallback(
    (key, qty) => {
      if (qty < 1) {
        removeFromCart(key);
        return;
      }
      setCartItems((prev) =>
        prev.map((x) => {
          if (x.key !== key) return x;
          if (isSubscriptionCartLine(x)) return x;
          return { ...x, qty };
        })
      );
    },
    [removeFromCart, setCartItems]
  );

  const clearCart = useCallback(() => {
    setCartItems([]);
    clearShopCartItems();
    setCheckoutError('');
  }, [setCartItems]);

  const goToCheckout = useCallback(() => {
    if (!cartItems.length) return;
    setCheckoutError('');
    const validationErr = validateCartForCheckout(cartItems, t);
    if (validationErr) {
      setCheckoutError(validationErr);
      setExpanded(true);
      return;
    }
    if (!user) {
      navigate('/login', { state: { from: '/shop/checkout' } });
      return;
    }
    const hasRecurring = cartItems.some(
      (row) => row.recurring || PLUS_SKUS.includes(row.sku || '') || BOOST_SKUS.includes(row.sku || '')
    );
    const hasBoost = cartItems.some((row) => BOOST_SKUS.includes(row.sku || ''));
    savePendingCheckout({
      cartItems,
      amountCents: totalCents,
      payload: {
        sku: 'MARKETPLACE_CART',
        saveCard: hasRecurring,
        cartItems,
        ...(hasBoost && user?.uid ? { companyId: user.uid } : {}),
      },
    });
    setExpanded(false);
    navigate('/shop/checkout');
  }, [cartItems, navigate, t, totalCents, user]);

  const value = useMemo(
    () => ({
      cartItems,
      itemCount,
      totalCents,
      expanded,
      setExpanded,
      checkoutError,
      setCheckoutError,
      addToCart,
      removeFromCart,
      updateCartQty,
      clearCart,
      goToCheckout,
      clearAfterOrder: () => {
        setCartItems([]);
        clearShopCartItems();
        clearPendingCheckout();
        setExpanded(false);
        setCheckoutError('');
      },
    }),
    [
      cartItems,
      itemCount,
      totalCents,
      expanded,
      checkoutError,
      addToCart,
      removeFromCart,
      updateCartQty,
      clearCart,
      goToCheckout,
      setCartItems,
    ]
  );

  return <ShopCartContext.Provider value={value}>{children}</ShopCartContext.Provider>;
}

export function useShopCart() {
  const ctx = useContext(ShopCartContext);
  if (!ctx) {
    throw new Error('useShopCart must be used within ShopCartProvider');
  }
  return ctx;
}

/** Safe hook for TopNav — returns null when provider is absent. */
export function useShopCartOptional() {
  return useContext(ShopCartContext);
}
