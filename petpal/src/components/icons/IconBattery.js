import React from 'react';

/** Horizontal battery with fill level (0–100). */
export default function IconBattery({ pct = 100, size = 18, className = '' }) {
  const level = Math.max(0, Math.min(100, Number(pct) || 0));
  const fillW = 12 * (level / 100);
  return (
    <svg
      className={`pp-iconBattery ${className}`.trim()}
      viewBox="0 0 22 12"
      width={size}
      height={Math.round(size * (12 / 22))}
      aria-hidden="true"
    >
      <rect x="0.5" y="1.5" width="17" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="18" y="4" width="2.5" height="4" rx="0.6" fill="currentColor" />
      {fillW > 0 ? (
        <rect x="2" y="3" width={fillW} height="6" rx="1" fill="currentColor" opacity="0.85" />
      ) : null}
    </svg>
  );
}
