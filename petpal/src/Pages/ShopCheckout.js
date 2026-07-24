import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import PhoneCountryInput from '../components/PhoneCountryInput';
import { useAuth } from '../auth/AuthProvider';
import { getDb, isFirebaseConfigured } from '../firebase';
import { useI18n } from '../i18n/I18nContext';
import { formatEur } from '../shop/catalog';
import { clearPendingCheckout, readPendingCheckout } from '../shop/pendingCheckout';
import { clearShopCartItems } from '../shop/shopCartStorage';
import { localizeCartItem } from '../shop/shopCartHelpers';
import { buildShippingContact, splitPhoneForForm, validateShippingForm } from '../shop/shippingContact';
import { startJccCheckout } from '../shop/startJccCheckout';

const EMPTY_FORM = {
  country: 'CY',
  email: '',
  firstName: '',
  lastName: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  phoneCountry: 'CY',
  phone: '',
};

function RequiredLabel({ children }) {
  return <span className="pp-shopCheckout__label pp-shopCheckout__label--required">{children}</span>;
}

export default function ShopCheckout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const pending = useMemo(() => readPendingCheckout(), []);
  const [form, setForm] = useState(EMPTY_FORM);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function loadProfileDefaults() {
      const email = user.email || '';
      let firstName = '';
      let lastName = '';
      let phone = '';
      if (isFirebaseConfigured()) {
        try {
          const snap = await getDoc(doc(getDb(), 'users', user.uid));
          const d = snap.data() || {};
          firstName = String(d.firstName || '').trim();
          lastName = String(d.lastName || '').trim();
          if (!firstName && !lastName) {
            const combined = String(d.accountName || user.displayName || '').trim();
            const parts = combined.split(/\s+/).filter(Boolean);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
          }
          phone = String(d.phone || d.phone2 || '').trim();
        } catch {
          /* keep auth email only */
        }
      }
      if (!cancelled) {
        const phoneFields = splitPhoneForForm(phone, 'CY');
        setForm((prev) => ({
          ...prev,
          email: prev.email || email,
          firstName: prev.firstName || firstName,
          lastName: prev.lastName || lastName,
          phoneCountry: prev.phone ? prev.phoneCountry : phoneFields.phoneCountry,
          phone: prev.phone || phoneFields.phone,
        }));
      }
    }
    void loadProfileDefaults();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!pending?.cartItems?.length || !pending.payload) {
    return <Navigate to="/shop" replace />;
  }

  const itemCount = pending.cartItems.reduce((sum, row) => sum + (row.qty || 1), 0);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    const shipping = buildShippingContact(form);
    const validationErr = validateShippingForm(shipping, t);
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    if (!acceptedTerms) {
      setErr(t('checkoutDetails.termsError'));
      return;
    }
    setBusy(true);
    try {
      await startJccCheckout({
        ...pending.payload,
        shippingContact: shipping,
        t,
      });
      clearPendingCheckout();
      clearShopCartItems();
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="pp-shopCheckout">
      <div className="pp-shopCheckout__main">
        <div className="pp-shopCheckout__head">
          <Link className="pp-link" to="/shop">
            ← {t('checkoutDetails.backToShop')}
          </Link>
          <h1 className="pp-shopCheckout__title">{t('checkoutDetails.pageTitle')}</h1>
        </div>

        <form className="pp-shopCheckout__form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <section className="pp-shopCheckout__section" aria-labelledby="checkout-delivery-title">
            <h2 id="checkout-delivery-title" className="pp-shopCheckout__sectionTitle">
              {t('checkoutDetails.deliveryTitle')}
            </h2>

            <label className="pp-shopCheckout__field">
              <RequiredLabel>{t('checkoutDetails.country')}</RequiredLabel>
              <select
                value={form.country}
                disabled={busy}
                onChange={(e) => updateField('country', e.target.value)}
                autoComplete="country"
                required
              >
                <option value="CY">{t('checkoutDetails.countryCyprus')}</option>
              </select>
            </label>

            <label className="pp-shopCheckout__field">
              <RequiredLabel>{t('checkoutDetails.email')}</RequiredLabel>
              <input
                type="email"
                value={form.email}
                disabled={busy}
                onChange={(e) => updateField('email', e.target.value)}
                autoComplete="email"
                placeholder={t('checkoutDetails.emailPlaceholder')}
                required
              />
            </label>

            <div className="pp-shopCheckout__row pp-shopCheckout__row--compact">
              <label className="pp-shopCheckout__field">
                <RequiredLabel>{t('checkoutDetails.firstName')}</RequiredLabel>
                <input
                  type="text"
                  value={form.firstName}
                  disabled={busy}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  autoComplete="given-name"
                  placeholder={t('checkoutDetails.firstNamePlaceholder')}
                  required
                />
              </label>
              <label className="pp-shopCheckout__field">
                <RequiredLabel>{t('checkoutDetails.lastName')}</RequiredLabel>
                <input
                  type="text"
                  value={form.lastName}
                  disabled={busy}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  autoComplete="family-name"
                  placeholder={t('checkoutDetails.lastNamePlaceholder')}
                  required
                />
              </label>
            </div>

            <label className="pp-shopCheckout__field">
              <RequiredLabel>{t('checkoutDetails.addressLine1')}</RequiredLabel>
              <input
                type="text"
                value={form.addressLine1}
                disabled={busy}
                onChange={(e) => updateField('addressLine1', e.target.value)}
                autoComplete="address-line1"
                placeholder={t('checkoutDetails.addressLine1Placeholder')}
                required
              />
            </label>

            <label className="pp-shopCheckout__field">
              <span className="pp-shopCheckout__label">{t('checkoutDetails.addressLine2')}</span>
              <input
                type="text"
                value={form.addressLine2}
                disabled={busy}
                onChange={(e) => updateField('addressLine2', e.target.value)}
                autoComplete="address-line2"
                placeholder={t('checkoutDetails.addressLine2Placeholder')}
              />
            </label>

            <div className="pp-shopCheckout__row pp-shopCheckout__row--compact">
              <label className="pp-shopCheckout__field">
                <RequiredLabel>{t('checkoutDetails.postalCode')}</RequiredLabel>
                <input
                  type="text"
                  value={form.postalCode}
                  disabled={busy}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  autoComplete="postal-code"
                  placeholder={t('checkoutDetails.postalCodePlaceholder')}
                  required
                />
              </label>
              <label className="pp-shopCheckout__field">
                <RequiredLabel>{t('checkoutDetails.city')}</RequiredLabel>
                <input
                  type="text"
                  value={form.city}
                  disabled={busy}
                  onChange={(e) => updateField('city', e.target.value)}
                  autoComplete="address-level2"
                  placeholder={t('checkoutDetails.cityPlaceholder')}
                  required
                />
              </label>
            </div>

            <div className="pp-shopCheckout__field">
              <RequiredLabel>{t('checkoutDetails.phone')}</RequiredLabel>
              <PhoneCountryInput
                id="checkout-phone"
                countryCode={form.phoneCountry}
                nationalValue={form.phone}
                disabled={busy}
                required
                placeholder={t('checkoutDetails.phonePlaceholder')}
                onCountryChange={(code) => updateField('phoneCountry', code)}
                onNationalChange={(value) => updateField('phone', value)}
              />
            </div>
          </section>

          <section className="pp-shopCheckout__section pp-shopCheckout__terms" aria-labelledby="checkout-terms-title">
            <h2 id="checkout-terms-title" className="pp-shopCheckout__sectionTitle">
              {t('checkoutDetails.termsTitle')}
            </h2>
            <p className="pp-subtle pp-shopCheckout__termsIntro">
              {t('checkoutDetails.termsIntro')}{' '}
              <Link to="/terms#shop-payments" className="pp-link pp-link--inline" target="_blank" rel="noopener noreferrer">
                {t('checkoutDetails.termsReadLink')}
              </Link>
              .
            </p>
            <div className="pp-shopCheckout__delivery" role="note">
              <p className="pp-shopCheckout__deliveryText">{t('checkoutDetails.deliveryNote')}</p>
              <div className="pp-shopCheckout__couriers" aria-label={t('checkoutDetails.deliveryCouriersAria')}>
                <img
                  className="pp-shopCheckout__courierLogo pp-shopCheckout__courierLogo--boxnow"
                  src="/images/shipping/boxnow-logo.svg"
                  alt="BOX NOW"
                  width={70}
                  height={51}
                  loading="lazy"
                  decoding="async"
                />
                <img
                  className="pp-shopCheckout__courierLogo pp-shopCheckout__courierLogo--acs"
                  src="/images/shipping/acs-logo.svg"
                  alt="ACS"
                  width={96}
                  height={26}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
            <label className="pp-legalCheck pp-shopCheckout__termsCheck">
              <input
                type="checkbox"
                checked={acceptedTerms}
                disabled={busy}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                aria-describedby="checkout-terms-desc"
                required
              />
              <span id="checkout-terms-desc">
                {t('checkoutDetails.termsAccept')}{' '}
                <Link to="/terms" className="pp-link pp-link--inline" target="_blank" rel="noopener noreferrer">
                  {t('checkoutDetails.termsLink')}
                </Link>{' '}
                {t('checkoutDetails.termsAnd')}{' '}
                <Link to="/privacy" className="pp-link pp-link--inline" target="_blank" rel="noopener noreferrer">
                  {t('checkoutDetails.privacyLink')}
                </Link>
                .
              </span>
            </label>
          </section>

          {err ? <div className="pp-error">{err}</div> : null}

          <div className="pp-shopCheckout__actions">
            <Link className="pp-btn pp-btn--ghost" to="/shop">
              {t('checkoutDetails.cancel')}
            </Link>
            <button type="submit" className="pp-btn pp-btn--primary" disabled={busy || !acceptedTerms}>
              {busy ? t('checkoutDetails.busy') : t('checkoutDetails.continue')}
            </button>
          </div>
        </form>
      </div>

      <aside className="pp-shopCheckout__summary" aria-label={t('checkoutDetails.summaryAria')}>
        <div className="pp-shopCheckout__summaryCard">
          <h2 className="pp-shopCheckout__summaryTitle">{t('checkoutDetails.summaryTitle')}</h2>
          <ul className="pp-shopCheckout__summaryList">
            {pending.cartItems.map((row) => {
              const displayRow = localizeCartItem(row, t);
              return (
                <li key={row.key} className="pp-shopCheckout__summaryRow">
                  <div className="pp-shopCheckout__summaryName">
                    {displayRow.title}
                    {(row.qty || 1) > 1 ? <span className="pp-shopCheckout__summaryQty">×{row.qty}</span> : null}
                  </div>
                  <strong>{formatEur(row.priceCents * (row.qty || 1))}</strong>
                </li>
              );
            })}
          </ul>
          <div className="pp-shopCheckout__summaryTotal">
            <span>{t('checkoutDetails.summaryItems', { count: itemCount })}</span>
            <strong>{formatEur(pending.amountCents)}</strong>
          </div>
          <p className="pp-subtle pp-shopCheckout__summaryNote">{t('checkoutDetails.lead')}</p>
        </div>
      </aside>
    </div>
  );
}
