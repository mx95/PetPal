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
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <g transform="translate(11.5 10.25)" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M0 .75a1.05 1.05 0 0 1 1.48 0" />
        <path d="M-1.15 -.4a2.35 2.35 0 0 1 3.32 0" />
        <path d="M-2.3 -1.55a3.65 3.65 0 0 1 5.16 0" />
        <path d="M-3.45 -2.7a4.95 4.95 0 0 1 7 0" />
      </g>
      <text
        x="12"
        y="16.85"
        textAnchor="middle"
        fill="#fff"
        fontSize="5.6"
        fontWeight="800"
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
