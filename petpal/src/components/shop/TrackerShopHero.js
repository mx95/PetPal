import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { formatEur, TRACKER_ADDON_CENTS, NFC_TAG_ADDON_CENTS } from '../../shop/catalog';

/**
 * GPS tracker hero — matches marketing layout (device photo + feature pills + price bar).
 *
 * @param {{ trackerImage: string }} props
 */
export default function TrackerShopHero({ trackerImage }) {
  const { t } = useI18n();

  return (
    <section className="pp-trackerShowcase" aria-labelledby="tracker-showcase-title">
      <div className="pp-trackerShowcase__layout">
        <div className="pp-trackerShowcase__media">
          <img src={trackerImage} alt={t('shopPage.trackerShowcaseImgAlt')} loading="lazy" />
        </div>
        <ul className="pp-trackerShowcase__features">
          <li>
            <span className="pp-trackerShowcase__featIcon pp-trackerShowcase__featIcon--battery" aria-hidden>
              🔋
            </span>
            <div>
              <strong>{t('shopPage.trackerFeatBatteryTitle')}</strong>
              <span>{t('shopPage.trackerFeatBatterySub')}</span>
            </div>
          </li>
          <li>
            <span className="pp-trackerShowcase__featIcon pp-trackerShowcase__featIcon--endurance" aria-hidden>
              ⏱
            </span>
            <div>
              <strong>{t('shopPage.trackerFeatEnduranceTitle')}</strong>
              <span>{t('shopPage.trackerFeatEnduranceSub')}</span>
            </div>
          </li>
          <li>
            <span className="pp-trackerShowcase__featIcon pp-trackerShowcase__featIcon--water" aria-hidden>
              💧
            </span>
            <div>
              <strong>{t('shopPage.trackerFeatWaterTitle')}</strong>
              <span>{t('shopPage.trackerFeatWaterSub')}</span>
            </div>
          </li>
        </ul>
      </div>
      <div className="pp-trackerShowcase__priceBar">
        <div className="pp-trackerShowcase__priceMain">
          <span className="pp-trackerShowcase__priceLabel">{t('shopPage.trackerShowcaseDevice')}</span>
          <strong>{formatEur(TRACKER_ADDON_CENTS)}</strong>
          <span className="pp-trackerShowcase__priceSub">{t('shopPage.trackerShowcaseMonthlySub')}</span>
        </div>
        <div className="pp-trackerShowcase__nfcGift">
          <img src="/images/nfc-tags/nfc-tag-01.png" alt="" aria-hidden />
          <div>
            <strong>{t('shopPage.trackerShowcaseNfcGift')}</strong>
            <span>{formatEur(NFC_TAG_ADDON_CENTS)} {t('shopPage.trackerShowcaseNfcValue')}</span>
          </div>
        </div>
      </div>
      <p id="tracker-showcase-title" className="pp-trackerShowcase__tagline">
        {t('shopPage.trackerShowcaseTagline')}
      </p>
    </section>
  );
}
