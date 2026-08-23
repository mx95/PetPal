import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { formatEur, NFC_TAG_ADDON_CENTS } from '../../shop/catalog';
import NfcDesignCard from './NfcDesignCard';

/**
 * Marketing-style NFC showcase — grid, pricing banner, feature strip.
 *
 * @param {{
 *   designs: Array<{ id: number, name: string, image: string }>,
 *   selectedDesignId?: number,
 *   onSelectDesign?: (id: number) => void,
 *   selectable?: boolean,
 * }} props
 */
export default function NfcShopShowcase({
  designs,
  selectedDesignId,
  onSelectDesign,
  selectable = false,
}) {
  const { t } = useI18n();

  if (!designs?.length) return null;

  return (
    <section className="pp-nfcShowcase" aria-labelledby="nfc-showcase-title">
      <header className="pp-nfcShowcase__head">
        <div className="pp-nfcShowcase__brand" aria-hidden>
          <span className="pp-nfcShowcase__brandMark">🐾</span>
          <span className="pp-nfcShowcase__brandText">PetPal CARE HUB</span>
        </div>
        <h2 id="nfc-showcase-title" className="pp-nfcShowcase__title">
          <span className="pp-nfcShowcase__signal" aria-hidden>((·))</span>
          {t('shopPage.nfcShowcaseTitle')}
          <span className="pp-nfcShowcase__signal" aria-hidden>((·))</span>
        </h2>
        <div className="pp-nfcShowcase__priceBanner">
          <span className="pp-nfcShowcase__priceMain">
            {t('shopPage.nfcShowcasePriceOnly', { amount: formatEur(NFC_TAG_ADDON_CENTS) })}
          </span>
          <span className="pp-nfcShowcase__priceOr">{t('shopPage.nfcShowcaseOr')}</span>
          <span className="pp-nfcShowcase__priceFree">{t('shopPage.nfcShowcaseYearlyFree')}</span>
        </div>
      </header>

      <ul className="pp-nfcShowcase__grid">
        {designs.map((design) => (
          <li key={design.id} className="pp-nfcShowcase__cell">
            {selectable && onSelectDesign ? (
              <NfcDesignCard
                design={design}
                selected={design.id === selectedDesignId}
                onSelect={onSelectDesign}
              />
            ) : (
              <div className="pp-nfcShowcase__tile">
                <img src={design.image} alt={design.name} loading="lazy" />
                <span className="pp-nfcShowcase__tileNum">{design.id}</span>
                <span className="pp-nfcShowcase__tileName">{design.name}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <ul className="pp-nfcShowcase__features">
        <li>
          <span className="pp-nfcShowcase__featIcon pp-nfcShowcase__featIcon--tap" aria-hidden>
            ((·))
          </span>
          <div>
            <strong>{t('shopPage.nfcFeatTapTitle')}</strong>
            <span>{t('shopPage.nfcFeatTapSub')}</span>
          </div>
        </li>
        <li>
          <span className="pp-nfcShowcase__featIcon pp-nfcShowcase__featIcon--connect" aria-hidden>
            👤
          </span>
          <div>
            <strong>{t('shopPage.nfcFeatConnectTitle')}</strong>
            <span>{t('shopPage.nfcFeatConnectSub')}</span>
          </div>
        </li>
        <li>
          <span className="pp-nfcShowcase__featIcon pp-nfcShowcase__featIcon--care" aria-hidden>
            🛡
          </span>
          <div>
            <strong>{t('shopPage.nfcFeatCareTitle')}</strong>
            <span>{t('shopPage.nfcFeatCareSub')}</span>
          </div>
        </li>
        <li>
          <span className="pp-nfcShowcase__featIcon pp-nfcShowcase__featIcon--durable" aria-hidden>
            💧
          </span>
          <div>
            <strong>{t('shopPage.nfcFeatDurableTitle')}</strong>
            <span>{t('shopPage.nfcFeatDurableSub')}</span>
          </div>
        </li>
      </ul>
    </section>
  );
}
