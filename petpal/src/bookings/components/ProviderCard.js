import React, { useMemo } from 'react';
import { PrimaryButton } from '../../components/ui';
import petpalLogo from '../../logo.png';
import { providerBoostIsActive } from '../bookingBrowseUtils';
import { useI18n } from '../../i18n/I18nContext';

function categoryLabel(types, t) {
  const pt = types && typeof types === 'object' ? types : {};
  const bits = [];
  if (pt.vet) bits.push(t('bookingsHub.tabVet'));
  if (pt.bath) bits.push(t('bookingsHub.tabBath'));
  if (pt.saloon) bits.push(t('bookingsHub.tabGroom'));
  if (pt.hotel) bits.push(t('bookingsHub.tabHotel'));
  if (pt.walker) bits.push(t('bookingsHub.tabWalker'));
  return bits.length ? bits.join(' · ') : t('bookingsHub.tabVet');
}

/**
 * @param {{
 *   provider: Record<string, unknown>,
 *   distanceKm: number | null,
 *   onBook: () => void,
 * }} props
 */
export function ProviderCard({ provider, distanceKm, onBook }) {
  const { t } = useI18n();
  const rating = Number(provider.rating);
  const hasRating = Number.isFinite(rating) && rating > 0;
  const cat = useMemo(() => categoryLabel(provider.providerTypes, t), [provider.providerTypes, t]);
  const providerName = String(provider.displayName || t('bookConfirm.providerLabel'));
  const sponsored = providerBoostIsActive(provider);
  const hours = provider.workingHours || t('providerPortal.openToday');
  const nextSlot = provider.nextAvailable || t('bookingsHub.nextSlotsToday');
  const servicesPreview = provider.servicesPreview || cat;

  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-white/75 bg-white/90 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-petpal-soft via-white to-petpal-cream" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(91,55,255,0.18),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(47,128,255,0.16),transparent_24%)]" />
        <img
          src={petpalLogo}
          alt=""
          className="absolute bottom-3 right-5 h-28 w-28 object-contain opacity-95 transition-transform duration-500 group-hover:scale-105 drop-shadow-md"
        />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {sponsored ? (
            <span className="rounded-full bg-gradient-to-r from-petpal-lilac to-petpal-blue px-3 py-1 text-xs font-black text-white shadow-glow">
              {t('bookingsHub.recommendedTitle')}
            </span>
          ) : null}
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-petpal-ink shadow-soft">
            {t('discover.feed.verified')}
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 shadow-soft">
            {t('providerPortal.statusAvailable')}
          </span>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-black tracking-[-0.03em] text-petpal-ink">{providerName}</h3>
          {hasRating ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-black text-amber-700" aria-label={t('bookingsHub.ratingAria', { rating: rating.toFixed(1) })}>
              <span aria-hidden>{t('bookingsHub.ratingStar')}</span> {rating.toFixed(1)}
            </span>
          ) : (
            <span className="rounded-full bg-petpal-soft px-3 py-1 text-sm font-black text-petpal-lilac">{t('bookingsHub.newOnPetpal')}</span>
          )}
        </div>
        <p className="mt-2 text-sm font-bold text-petpal-lilac">{servicesPreview}</p>
        <p className="mt-2 min-h-[2.5rem] text-sm leading-6 text-petpal-muted">{String(provider.address || '')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {distanceKm != null ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{t('bookingsHub.distanceAbout', { km: distanceKm.toFixed(1) })}</span> : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-petpal-muted">
          <span className="rounded-2xl bg-slate-50 px-3 py-2">{t('bookingsHub.hoursSummary', { hours })}</span>
          <span className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-700">{nextSlot}</span>
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
