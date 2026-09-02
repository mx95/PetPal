import React from 'react';
import { useI18n } from '../../i18n/I18nContext';

function LocationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

const NFC_PLAN_BADGE_SRC = '/images/shop/nfc-plan-badge-v2.jpg';

function NfcIcon() {
  return (
    <img
      src={NFC_PLAN_BADGE_SRC}
      alt=""
      aria-hidden
      className="pp-shopPlanFeatures__nfcLogo"
      width={28}
      height={28}
      decoding="async"
    />
  );
}

/** Shared subscription plan feature bullets (GPS + NFC). */
export default function ShopPlanFeatureList({ className = '' }) {
  const { t } = useI18n();
  return (
    <ul className={`pp-shopPlanFeatures${className ? ` ${className}` : ''}`}>
      <li className="pp-shopPlanFeatures__item">
        <span className="pp-shopPlanFeatures__icon pp-shopPlanFeatures__icon--gps">
          <LocationIcon />
        </span>
        <span>{t('shopPage.planFeatureLiveLocation')}</span>
      </li>
      <li className="pp-shopPlanFeatures__item">
        <span className="pp-shopPlanFeatures__icon pp-shopPlanFeatures__icon--nfc">
          <NfcIcon />
        </span>
        <span>{t('shopPage.planFeatureNfcProfile')}</span>
      </li>
    </ul>
  );
}
