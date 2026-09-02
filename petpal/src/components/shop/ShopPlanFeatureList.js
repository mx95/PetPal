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
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9.1 10.35A1.05 1.05 0 0 1 9.1 8.3"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M10.3 10.75A1.45 1.45 0 0 1 10.3 7.85"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M11.5 11.15A1.85 1.85 0 0 1 11.5 7.45"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <path
        d="M12.7 11.55A2.25 2.25 0 0 1 12.7 7.05"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <text
        x="12"
        y="16.1"
        textAnchor="middle"
        fill="currentColor"
        fontSize="4.4"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        NFC
      </text>
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
