import React from 'react';

/**
 * Medication cluster: two scored tablets + capsule (app stroke style, purple via currentColor).
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
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* small round tablet */}
      <circle cx="7.5" cy="16.5" r="3.2" />
      <path d="M5.8 14.8l3.4 3.4" />
      {/* large round tablet */}
      <circle cx="9.5" cy="9" r="4.2" />
      <path d="M7.2 6.7l4.6 4.6" />
      {/* capsule */}
      <rect x="13.2" y="5.8" width="9.2" height="4.8" rx="2.4" transform="rotate(-32 17.8 8.2)" />
      <path d="M15.2 7.2l5.2 1.8" transform="rotate(-32 17.8 8.2)" />
    </svg>
  );
}
