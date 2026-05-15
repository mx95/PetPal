import React from 'react';

/** Capsule pill (diagonal split) — matches pp-iconBtn stroke style (eye / pencil / trash). */
export default function IconMedPill({ size = 16 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.6 9.4l-5.2 5.2a3.1 3.1 0 1 0 4.4 4.4l5.2-5.2a3.1 3.1 0 1 0-4.4-4.4z" />
      <path d="M10.3 13.7l3.4-3.4" />
    </svg>
  );
}
