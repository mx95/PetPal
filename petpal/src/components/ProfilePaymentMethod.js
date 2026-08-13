import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useToast } from '../components/Toast';
import { getDb, isFirebaseConfigured } from '../firebase';
import { formatMaskedCard, startJccUpdateCard } from '../shop/startJccUpdateCard';

/**
 * Account payment method: show current JCC masked card + update via hosted checkout.
 */
export default function ProfilePaymentMethod() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [method, setMethod] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured()) {
      setMethod(null);
      setLoaded(true);
      return undefined;
    }
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
  }, [user?.uid]);

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

  return (
    <section className="pp-heroCard pp-profilePayment" aria-label={t('profile.payment.aria')}>
      <div className="pp-heroCard__copy" style={{ flex: 1, minWidth: 0 }}>
        <span className="pp-heroCard__eyebrow">{t('profile.payment.eyebrow')}</span>
        <h2 className="pp-heroCard__title" style={{ fontSize: '1.15rem' }}>
          {t('profile.payment.title')}
        </h2>
        {!loaded ? (
          <p className="pp-heroCard__sub">{t('profile.payment.loading')}</p>
        ) : hasCard ? (
          <>
            <p className="pp-profilePayment__card" aria-live="polite">
              <span className="pp-profilePayment__brand" aria-hidden>
                💳
              </span>
              <span className="pp-profilePayment__pan">{masked || t('profile.payment.cardOnFile')}</span>
            </p>
            <p className="pp-heroCard__sub">{t('profile.payment.hintUpdate')}</p>
          </>
        ) : (
          <p className="pp-heroCard__sub">{t('profile.payment.hintEmpty')}</p>
        )}
        {err ? <div className="pp-error" style={{ marginTop: 10 }}>{err}</div> : null}
        <div className="pp-profilePayment__actions">
          <button
            type="button"
            className="pp-btn pp-btnPrimary"
            disabled={busy || !loaded}
            onClick={onUpdateCard}
          >
            {busy
              ? t('profile.payment.updating')
              : hasCard
                ? t('profile.payment.updateCta')
                : t('profile.payment.addCta')}
          </button>
        </div>
        <p className="pp-subtle pp-profilePayment__note">{t('profile.payment.note')}</p>
      </div>
    </section>
  );
}
