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

function NfcIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.55" />
      <circle cx="9.25" cy="12" r="1.1" fill="currentColor" />
      <path
        d="M10.6 10.65a1.65 1.65 0 0 1 2.33 0"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M9.15 9.2a3.35 3.35 0 0 1 4.74 0"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M7.7 7.75a5.05 5.05 0 0 1 7.14 0"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </svg>
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
