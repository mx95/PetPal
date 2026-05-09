import React from 'react';

export function OpeningScreen({ title = 'PetPal', subtitle = 'Checking your session…' }) {
  return (
    <div className="pp-opening" role="status" aria-live="polite" aria-label={subtitle}>
      <div className="pp-openingCard">
        <div className="pp-openingBrand">
          <img className="pp-openingLogo" src={`${process.env.PUBLIC_URL}/logo192.png`} alt="" />
          <div className="pp-openingTitle">{title}</div>
        </div>
        <div className="pp-openingSubtitle">{subtitle}</div>
        <div className="pp-openingSpinner" aria-hidden="true" />
      </div>
    </div>
  );
}

