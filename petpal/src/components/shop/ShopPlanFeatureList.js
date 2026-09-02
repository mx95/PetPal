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
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#3d4451" />
      <path
        d="M6.8 15.2a1.15 1.15 0 0 1 1.62 0"
        stroke="#fff"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M5.55 13.95a2.65 2.65 0 0 1 3.75 0"
        stroke="#fff"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M4.3 12.7a4.15 4.15 0 0 1 5.88 0"
        stroke="#fff"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M3.05 11.45a5.65 5.65 0 0 1 8 0"
        stroke="#fff"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <text
        x="12"
        y="20.2"
        textAnchor="middle"
        fill="#fff"
        fontSize="5.2"
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
