import React from 'react';

/**
 * Lost Pets menu mark — paw with alert badge on a soft red chip.
 * @param {{ size?: number, variant?: 'menu' | 'plain' }} props
 */
export default function IconLostPet({ size = 22, variant = 'plain' }) {
  if (variant === 'menu') {
    return (
      <img
        src={`${process.env.PUBLIC_URL || ''}/images/menu/lost-pets.svg`}
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
      <circle cx="8.3" cy="8.8" r="2" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="8.8" r="2" fill="currentColor" stroke="none" />
      <circle cx="5.8" cy="13.3" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18.2" cy="13.3" r="1.7" fill="currentColor" stroke="none" />
      <path d="M9.8 17.2c1.1 2 3.4 2 4.5 0" />
      <circle cx="18.8" cy="5.4" r="3.1" fill="#F04438" stroke="none" />
      <path d="M18.8 3.6v3.6M17 5.4h3.6" stroke="#fff" strokeWidth="1.2" />
    </svg>
  );
}
