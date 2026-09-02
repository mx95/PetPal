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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.4" fill="#fff" stroke="currentColor" strokeWidth="2.35" />
      <path
        d="M8 11.15a4 4 0 0 1 8 0"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M9.6 11.15a2.4 2.4 0 0 1 4.8 0"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <text
        x="12"
        y="14.35"
        textAnchor="middle"
        fill="currentColor"
        fontSize="6"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        NFC
      </text>
      <path
        d="M9.6 16.85a2.4 2.4 0 0 0 4.8 0"
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
