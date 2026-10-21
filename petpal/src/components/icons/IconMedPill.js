import React from 'react';

/**
 * Classic capsule + round tablet (clear “pill” mark for medication UI).
 */
export default function IconMedPill({ size = 24 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* capsule */}
      <rect x="3.2" y="9.2" width="17.6" height="5.6" rx="2.8" />
      <path d="M12 9.2v5.6" />
      {/* round tablet */}
      <circle cx="17.2" cy="5.6" r="2.6" />
      <path d="M15.6 4 18.8 7.2" />
    </svg>
  );
}
