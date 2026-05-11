import React, { useMemo } from 'react';

function categoryLabel(types, t) {
  const pt = types && typeof types === 'object' ? types : {};
  const bits = [];
  if (pt.vet) bits.push(t('bookingsHub.tabVet'));
  if (pt.saloon) bits.push(t('bookingsHub.tabGroom'));
  if (pt.hotel) bits.push(t('bookingsHub.tabHotel'));
  return bits.length ? bits.join(' · ') : t('bookingsHub.tabVet');
}

function priceTierLabel(tier, t) {
  const n = Number(tier);
  if (!Number.isFinite(n) || n < 1) return null;
  const k = Math.min(3, Math.max(1, Math.round(n)));
  return t('bookingsHub.priceFrom', { tier: '€'.repeat(k) });
}

/**
 * @param {{
 *   provider: Record<string, unknown>,
 *   distanceKm: number | null,
 *   onBook: () => void,
 *   t: (k: string, v?: object) => string,
 * }} props
 */
export function ProviderCard({ provider, distanceKm, onBook, t }) {
  const isDemo = String(provider.id || '').startsWith('example_');
  const rating = Number(provider.rating);
  const hasRating = Number.isFinite(rating) && rating > 0;
  const cat = useMemo(() => categoryLabel(provider.providerTypes, t), [provider.providerTypes, t]);
  const priceLine = useMemo(() => priceTierLabel(provider.priceTier, t), [provider.priceTier, t]);

  return (
    <article className={`pp-book-card ${isDemo ? 'pp-book-card--demo' : ''}`}>
      <div className="pp-book-card__visual" aria-hidden>
        {isDemo ? <span className="pp-book-card__placeholder">✨</span> : <span className="pp-book-card__placeholder">🏥</span>}
      </div>
      <div className="pp-book-card__body">
        <div className="pp-book-card__head">
          <h3 className="pp-book-card__title">{String(provider.displayName || 'Provider')}</h3>
          {hasRating ? (
            <span className="pp-book-card__rating" aria-label={`Rating ${rating} of 5`}>
              <span aria-hidden>⭐</span> {rating.toFixed(1)}
            </span>
          ) : (
            <span className="pp-book-card__rating pp-book-card__rating--muted">{t('bookingsHub.newOnPetpal')}</span>
          )}
        </div>
        <p className="pp-book-card__cat">{cat}</p>
        <p className="pp-book-card__addr">{String(provider.address || '')}</p>
        {distanceKm != null ? <p className="pp-book-card__dist">≈ {distanceKm.toFixed(1)} km</p> : null}
        <div className="pp-book-card__meta">
          {priceLine ? <span className="pp-book-chip">{priceLine}</span> : null}
          {isDemo ? <span className="pp-book-chip pp-book-chip--demo">{t('bookingsHub.demoNote')}</span> : null}
        </div>
      </div>
      <div className="pp-book-card__cta">
        <button type="button" className="pp-book-btn pp-book-btn--primary" onClick={onBook}>
          {t('bookingsHub.bookNow')}
        </button>
      </div>
    </article>
  );
}
