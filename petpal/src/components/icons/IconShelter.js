import React from 'react';

/** Shelter / home with heart for Shelters menu item. */
export default function IconShelter({ size = 22 }) {
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
      <path d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z" />
      <path d="M9.5 21.5V14a2.5 2.5 0 0 1 5 0v7.5" />
      <path d="M12 11.2c-.6-.8-1.8-.8-2.4 0-.6.8-.1 2 1.2 2s1.8-1.2 1.2-2Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
