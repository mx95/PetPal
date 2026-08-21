import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useToast } from '../components/Toast';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
import { formatMaskedCard, startJccUpdateCard } from '../shop/startJccUpdateCard';

/**
 * Account payment method: show current JCC masked card + update via hosted checkout.
 */
export default function ProfilePaymentMethod() {
  const { user, initializing } = useAuth();
  const { t } = useI18n();
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [method, setMethod] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (initializing) return undefined;
    if (!user?.uid || !isFirebaseConfigured()) {
      setMethod(null);
      setLoaded(true);
      return undefined;
    }
    setLoaded(false);
    const ref = doc(getDb(), 'users', user.uid, 'billing', 'defaultMethod');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setMethod(snap.exists() ? snap.data() : null);
        setLoaded(true);
      },
      () => {
        setMethod(null);
        setLoaded(true);
      }
    );
    return () => unsub();
  }, [user?.uid, initializing]);

  useEffect(() => {
    if (searchParams.get('card') !== 'updated') return;
    show(t('profile.payment.toastUpdated'));
    const next = new URLSearchParams(searchParams);
    next.delete('card');
    next.delete('orderNumber');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, show, t]);

  async function onUpdateCard() {
    setErr('');
    setBusy(true);
    try {
      const { formUrl } = await startJccUpdateCard({ t });
      window.location.assign(formUrl);
    } catch (e) {
      setBusy(false);
      setErr(e?.message || t('profile.payment.errGeneric'));
    }
  }

  const masked = formatMaskedCard(method?.maskedPan);
  const hasCard = Boolean(method?.bindingId);
  const showLoader = initializing || !loaded;

  return (
    <section className="pp-card pp-pad pp-shopPayment" aria-label={t('profile.payment.aria')}>
      {showLoader ? (
        <div className="pp-shopPayment__loading" role="status" aria-live="polite">
          <span className="pp-shopPayment__spinner" aria-hidden />
          <span className="pp-subtle">{t('profile.payment.loading')}</span>
        </div>
      ) : (
        <>
          <div className="pp-shopPayment__copy">
            <strong className="pp-shopPayment__title">{t('profile.payment.title')}</strong>
            {hasCard ? (
              <>
                <p className="pp-shopPayment__card" aria-live="polite">
                  <span className="pp-shopPayment__brand" aria-hidden>
                    💳
                  </span>
                  <span className="pp-shopPayment__pan">{masked || t('profile.payment.cardOnFile')}</span>
                </p>
                <span className="pp-subtle pp-shopPayment__hint">{t('profile.payment.hintUpdate')}</span>
              </>
            ) : (
              <span className="pp-subtle pp-shopPayment__hint">{t('profile.payment.hintEmpty')}</span>
            )}
            {err ? (
              <div className="pp-error" style={{ marginTop: 8 }}>
                {err}
              </div>
            ) : null}
            <p className="pp-subtle pp-shopPayment__note">{t('profile.payment.note')}</p>
          </div>
          <button
            type="button"
            className="pp-btn pp-btn--primary"
            disabled={busy}
            onClick={onUpdateCard}
          >
            {busy
              ? t('profile.payment.updating')
              : hasCard
                ? t('profile.payment.updateCta')
                : t('profile.payment.addCta')}
          </button>
        </>
      )}
    </section>
  );
}
