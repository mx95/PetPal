import React, { useMemo } from 'react';
import { PetIllustration, PrimaryButton } from '../../components/ui';

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
  const providerName = String(provider.displayName || 'Provider');

  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-white/75 bg-white/90 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-petpal-soft via-white to-petpal-cream" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(91,55,255,0.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(47,128,255,0.16),transparent_24%)]" />
        <PetIllustration variant={provider.providerTypes?.hotel ? 'cat' : 'pet'} className="absolute bottom-[-20px] right-6 h-40 w-40 transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute left-4 top-4 flex gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-petpal-ink shadow-soft">
            {isDemo ? 'Test ready' : 'Verified'}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 shadow-soft">
            Available
          </span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-black tracking-[-0.03em] text-petpal-ink">{providerName}</h3>
          {hasRating ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-700" aria-label={`Rating ${rating} of 5`}>
              <span aria-hidden>Star</span> {rating.toFixed(1)}
            </span>
          ) : (
            <span className="rounded-full bg-petpal-soft px-3 py-1 text-sm font-black text-petpal-lilac">{t('bookingsHub.newOnPetpal')}</span>
          )}
        </div>
        <p className="mt-2 text-sm font-bold text-petpal-lilac">{cat}</p>
        <p className="mt-2 min-h-[2.5rem] text-sm leading-6 text-petpal-muted">{String(provider.address || '')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {priceLine ? <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">{priceLine}</span> : null}
          {distanceKm != null ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">About {distanceKm.toFixed(1)} km</span> : null}
          {isDemo ? <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">Demo slots</span> : null}
        </div>
        <div className="mt-5">
          <PrimaryButton onClick={onBook} className="w-full">
            {t('bookingsHub.bookNow')}
          </PrimaryButton>
        </div>
      </div>
    </article>
  );
}
