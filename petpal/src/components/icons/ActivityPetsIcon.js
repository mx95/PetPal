import React from 'react';

/**
 * Activity menu mark — dog + cat in a trail circle with paw steps.
 * Menu only; bottom nav keeps the house icon.
 * @param {{ size?: number, variant?: 'menu' | 'plain' }} props
 */
export default function ActivityPetsIcon({ size = 18, variant = 'plain' }) {
  if (variant === 'menu') {
    return (
      <img
        src={`${process.env.PUBLIC_URL || ''}/images/menu/activity.png`}
        alt=""
        aria-hidden="true"
        className="pp-menuActionIcon__img"
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
      strokeWidth="1.35"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.2 17.2a8.2 8.2 0 1 1 11.1-11.1" />
      <circle cx="16.8" cy="6.8" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="18.3" cy="5.6" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="19.8" cy="4.6" r="0.55" fill="currentColor" stroke="none" />
      <ellipse cx="20.4" cy="3.1" rx="1.1" ry="1.35" fill="currentColor" stroke="none" />
      <circle cx="19.5" cy="1.9" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="20.4" cy="1.7" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="21.3" cy="1.9" r="0.35" fill="currentColor" stroke="none" />
      <circle cx="20.8" cy="2.5" r="0.35" fill="currentColor" stroke="none" />
      <path d="M8.4 11.2c.8-1.1 2.4-1.5 3.6-.8.6.4 1 .9 1.2 1.5" />
      <path d="M11.8 12.1c.5 1.4-.2 2.8-1.4 3.5" />
      <path d="M7.6 9.4c-.9-.3-1.6-1-1.9-1.9" />
      <path d="M9.8 14.6c1 .9 2.3 1.1 3.4.5" />
      <path d="M10.6 13.8c-.2.9-.1 1.8.3 2.6" />
      <path d="M12.4 14.9c.4-.6.5-1.3.3-2" />
      <path d="M11.2 12.6c-.5-.2-.9-.6-1.1-1.1" />
    </svg>
  );
}
