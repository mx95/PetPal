import React from 'react';

/** @param {number} pct */
export function batteryTone(pct) {
  const n = Math.min(100, Math.max(0, Number(pct) || 0));
  if (n > 60) return 'high';
  if (n > 30) return 'mid';
  return 'low';
}

const TONE_FILL = {
  high: '#22c55e',
  mid: '#eab308',
  low: '#ef4444',
};

/** Horizontal battery with fill level (0–100) and optional % tone coloring. */
export default function IconBattery({ pct = 100, size = 18, className = '', charging = false, colored = false }) {
  const level = Math.max(0, Math.min(100, Number(pct) || 0));
  const fillW = 12 * (level / 100);
  const tone = batteryTone(level);
  const fill = colored ? TONE_FILL[tone] : 'currentColor';
  return (
    <svg
      className={`pp-iconBattery${charging ? ' pp-iconBattery--charging' : ''}${
        colored ? ` pp-iconBattery--${tone}` : ''
      } ${className}`.trim()}
      viewBox="0 0 22 12"
      width={size}
      height={Math.round(size * (12 / 22))}
      aria-hidden="true"
    >
      <rect x="0.5" y="1.5" width="17" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="18" y="4" width="2.5" height="4" rx="0.6" fill="currentColor" />
      {fillW > 0 ? <rect x="2" y="3" width={fillW} height="6" rx="1" fill={fill} opacity={colored ? 1 : 0.85} /> : null}
    </svg>
  );
}
