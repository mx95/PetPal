import React from 'react';

/**
 * Shelters menu mark — house + paw on a soft purple chip.
 * @param {{ size?: number, variant?: 'menu' | 'plain' }} props
 */
export default function IconShelter({ size = 22, variant = 'plain' }) {
  if (variant === 'menu') {
    return (
      <img
        src={`${process.env.PUBLIC_URL || ''}/images/menu/shelters.svg`}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        className="pp-menuFeatureIcon__img"
      />
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.8 12 4.5l8 6.3V19a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19v-8.2Z" />
      <path d="M9.3 20.4V13a2.2 2.2 0 0 1 4.4 0v7.4" />
      <circle cx="17.6" cy="16.2" r="2.8" fill="currentColor" stroke="none" opacity="0.18" />
      <circle cx="16.7" cy="15.5" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="15.5" r="0.55" fill="currentColor" stroke="none" />
      <path d="M16.8 16.8c.55.65 1.45.65 2 0" strokeWidth="1.1" />
    </svg>
  );
}
