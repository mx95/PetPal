import React from 'react';
import petpalLogo from '../logo.png';

/**
 * Centered auth/session splash — calm gradient, glass card, orbit + pulse loaders
 * (pattern similar to modern app shells: content stacked dead-center in the viewport).
 */
export function OpeningScreen({ title = 'PetPal', subtitle = 'Checking your session…' }) {
  return (
    <div className="pp-opening" role="status" aria-live="polite" aria-label={subtitle}>
      <div className="pp-openingInner">
        <div className="pp-openingGlow" aria-hidden />
        <div className="pp-openingCard">
          <div className="pp-openingBrand">
            <img className="pp-openingLogo" src={petpalLogo} alt="" />
            <div className="pp-openingTitle">{title}</div>
          </div>
          <p className="pp-openingSubtitle">{subtitle}</p>
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

