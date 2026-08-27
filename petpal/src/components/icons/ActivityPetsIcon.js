import React from 'react';

/** Minimal cat + dog walking — used for Activity menu and bottom nav. */
export default function ActivityPetsIcon({ size = 18 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7.5" cy="8.2" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12.8" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.2" r="1.5" fill="currentColor" stroke="none" />
      <ellipse cx="11.5" cy="11.8" rx="3.6" ry="2.6" />
      <path d="M8.5 14.2c-1.2 1.4-2 3-2 4.8M14.5 14.2c1.2 1.4 2 3 2 4.8" />
      <path d="M16.8 17.2c1.6 1 2.8 2.4 3.4 4.2" />
      <circle cx="18.8" cy="15.2" r="1.1" fill="currentColor" stroke="none" />
      <path d="M17.6 16.4c-.4.8-.6 1.6-.6 2.4" />
    </svg>
  );
}
