import React from 'react';
import { useI18n } from '../i18n/I18nContext';

const LOGO_SRC = `${process.env.PUBLIC_URL || ''}/logo192.png`;

/**
 * Centered auth/session splash — calm gradient, glass card, orbit + pulse loaders
 * (pattern similar to modern app shells: content stacked dead-center in the viewport).
 */
export function OpeningScreen({ title = 'PetPal', subtitle }) {
  const { t } = useI18n();
  const resolvedSubtitle = subtitle || t('openingScreen.checkingSession');

  return (
    <div className="pp-opening" role="status" aria-live="polite" aria-label={resolvedSubtitle}>
      <div className="pp-openingInner">
        <div className="pp-openingGlow" aria-hidden />
        <div className="pp-openingCard">
          <div className="pp-openingBrand">
            <img className="pp-openingLogo" src={LOGO_SRC} alt="" width="44" height="44" />
            <div className="pp-openingTitle">{title}</div>
          </div>
          <p className="pp-openingSubtitle">{resolvedSubtitle}</p>
          <div className="pp-openingLoader" aria-hidden="true">
            <span className="pp-openingOrbit">
              <span className="pp-openingOrbit__dot" />
            </span>
            <span className="pp-openingDots">
              <span className="pp-openingDots__b" />
              <span className="pp-openingDots__b" />
              <span className="pp-openingDots__b" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

