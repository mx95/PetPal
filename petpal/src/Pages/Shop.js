import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { isFirebaseConfigured } from '../firebase';
import { SHOP_PRODUCTS, formatEur } from '../shop/catalog';
import { startJccCheckout } from '../shop/startJccCheckout';

export default function Shop() {
  const { user } = useAuth();
  const { isApprovedCompany } = useCompany();
  const [searchParams] = useSearchParams();
  const checkout = searchParams.get('checkout');
  const focusSku = searchParams.get('sku');
  const cardRefs = useRef(/** @type {Record<string, HTMLElement | null>} */ ({}));

  useEffect(() => {
    if (!focusSku) return;
    const id = window.setTimeout(() => {
      const el = cardRefs.current[focusSku];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => window.clearTimeout(id);
  }, [focusSku]);
  const [saveCardById, setSaveCardById] = useState(() =>
    SHOP_PRODUCTS.reduce((acc, p) => {
      acc[p.id] = p.recurring;
      return acc;
    }, {})
  );
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  const banner = useMemo(() => {
    if (checkout === 'success') return { kind: 'ok', text: 'Payment completed. Thank you — your purchase will appear in your account shortly.' };
    if (checkout === 'fail') return { kind: 'warn', text: 'Payment was not completed. You can try again when you are ready.' };
    if (checkout === 'error') return { kind: 'warn', text: 'We could not verify the payment return. If you were charged, contact support with your receipt.' };
    return null;
  }, [checkout]);

  if (!user) {
    return (
      <div className="pp-pad pp-demoProviderPortal">
        <div className="pp-pageHeader">
          <div className="pp-pageHeader__copy">
            <div className="pp-badge">PetPal Shop</div>
            <div className="pp-pageHeader__title">Sign in to shop</div>
            <div className="pp-pageHeader__subtitle">Subscriptions and hardware checkout require an account.</div>
          </div>
        </div>
        <Link className="pp-btn pp-btn--primary" to="/login">
          Log in
        </Link>
      </div>
    );
  }

  if (!isFirebaseConfigured()) {
    return (
      <div className="pp-pad">
        <div className="pp-badge">PetPal Shop</div>
        <h1 className="pp-pageHeader__title" style={{ marginTop: 12 }}>
          Payments need Firebase
        </h1>
        <p className="pp-subtle">Configure Firebase in this build to enable secure checkout and subscriptions.</p>
      </div>
    );
  }

  async function onPay(product) {
    setErr('');
    setBusy(product.id);
    try {
      const saveCard = Boolean(saveCardById[product.id]);
      if (product.recurring && !saveCard) {
        setErr('Turn on “Save card securely” for monthly plans so JCC can store a binding token for renewals.');
        setBusy(null);
        return;
      }
      const companyId = product.id === 'STORE_BOOST_MONTHLY' ? user.uid : undefined;
      await startJccCheckout({ sku: product.id, saveCard, companyId });
    } catch (e) {
      setErr(e?.message || String(e));
      setBusy(null);
    }
  }

  return (
    <div className="pp-pad pp-shopPage">
      <header className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <span className="pp-publicHero__eyebrow">PetPal Shop</span>
          <h1 className="pp-pageHeader__title">Subscriptions &amp; hardware</h1>
          <p className="pp-pageHeader__sub">
            Secure card payments via JCC hosted checkout (
            <a href="https://gateway.jcc.com.cy/developer/" target="_blank" rel="noopener noreferrer">
              JCC docs
            </a>
            ). Your card details never touch our servers; renewals use a gateway-issued token (binding).
          </p>
        </div>
        <Link className="pp-pageHeader__back" to="/dashboard">
          Back
        </Link>
      </header>

      {banner ? (
        <div className={`pp-shopBanner pp-shopBanner--${banner.kind === 'ok' ? 'ok' : 'warn'}`} role="status">
          {banner.text}
        </div>
      ) : null}

      {err ? <div className="pp-error" style={{ marginTop: 12 }}>{err}</div> : null}

      <div className="pp-shopGrid">
        {SHOP_PRODUCTS.map((p) => (
          <article
            key={p.id}
            ref={(el) => {
              cardRefs.current[p.id] = el;
            }}
            className={`pp-card pp-shopCard${focusSku === p.id ? ' pp-shopCard--focus' : ''}`}
          >
            <span className="pp-shopCard__badge">{p.badge}</span>
            <h2 className="pp-sectionTitle" style={{ margin: '6px 0 4px' }}>
              {p.title}
            </h2>
            <p className="pp-subtle" style={{ marginTop: 0 }}>
              {p.subtitle}
            </p>
            <div className="pp-shopCard__price">{formatEur(p.amountCents)}</div>
            {p.id === 'STORE_BOOST_MONTHLY' && !isApprovedCompany ? (
              <p className="pp-subtle">Approved business accounts only. Apply from your profile flow first.</p>
            ) : null}
            <label className="pp-shopSaveRow">
              <input
                type="checkbox"
                checked={Boolean(saveCardById[p.id])}
                onChange={(e) => setSaveCardById((prev) => ({ ...prev, [p.id]: e.target.checked }))}
              />
              <span>
                Save card securely for renewals <small>(JCC binding / token)</small>
              </span>
            </label>
            <button
              type="button"
              className="pp-btn pp-btn--primary"
              disabled={Boolean(busy) || (p.id === 'STORE_BOOST_MONTHLY' && !isApprovedCompany)}
              onClick={() => void onPay(p)}
            >
              {busy === p.id ? 'Starting checkout…' : 'Pay with card'}
            </button>
          </article>
        ))}
      </div>

      <section className="pp-card pp-pad pp-shopNote" style={{ marginTop: 16 }}>
        <h3 className="pp-sectionTitle">Deployment checklist</h3>
        <ul className="pp-subtle" style={{ marginBottom: 0, lineHeight: 1.55 }}>
          <li>Deploy Cloud Functions in <code>europe-west1</code> and set config (see <code>petpal/functions/jccPayments.js</code> header).</li>
          <li>Set <code>jcc.return_url</code> to the public URL of <code>jccPaymentReturn</code> (must match what you register with JCC).</li>
          <li>Set <code>jcc.frontend_url</code> to this web app origin so customers return to PetPal after payment.</li>
          <li>Optional: <code>REACT_APP_FUNCTIONS_REGION</code> if your functions region differs.</li>
        </ul>
      </section>
    </div>
  );
}
