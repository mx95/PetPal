import React from 'react';

/** Paw + alert badge for Lost Pets menu item. */
export default function IconLostPet({ size = 22 }) {
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
      <circle cx="8.5" cy="7.5" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="7.5" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12.5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12.5" r="1.8" fill="currentColor" stroke="none" />
      <path d="M10.5 16.5c1.2 2.2 3.8 2.2 5 0" />
      <path d="M17.5 3.5 21 7" />
      <circle cx="19.2" cy="4.8" r="2.4" />
    </svg>
  );
}
