import React from 'react';

const VIEW = '0 0 16 16';

/** GPS / Wi‑Fi / cell (LBS) source icons for tracker status and map pins. */
export default function IconTrackSource({ kind = 'gps', size = 14, className = '' }) {
  const cls = `pp-iconTrackSource pp-iconTrackSource--${kind} ${className}`.trim();

  if (kind === 'wifi') {
    return (
      <svg className={cls} viewBox={VIEW} width={size} height={size} aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 1.5a7.2 7.2 0 0 0-5.1 2.1l1.1 1.1A5.7 5.7 0 0 1 8 3.5c1.5 0 2.9.6 3.9 1.6l1.1-1.1A7.2 7.2 0 0 0 8 1.5Zm0 3.5a3.7 3.7 0 0 0-2.6 1.1l1.1 1.1c.4-.4 1-.7 1.5-.7s1.1.3 1.5.7l1.1-1.1A3.7 3.7 0 0 0 8 5Zm0 3.2c-.6 0-1.1.2-1.5.6L8 11.2l1.5-2.4c-.4-.4-.9-.6-1.5-.6Z"
        />
      </svg>
    );
  }

  if (kind === 'lbs') {
    return (
      <svg className={cls} viewBox={VIEW} width={size} height={size} aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 1.2 4.2 14h1.4l.8-2.8h3.2l.8 2.8h1.4L8 1.2Zm0 4.2 1.1 3.8H6.9L8 5.4Z"
        />
        <circle cx="8" cy="13.2" r="1.1" fill="currentColor" />
        <path
          fill="currentColor"
          opacity="0.55"
          d="M3.2 7.2h1v1.6H3.2V7.2Zm9.6 0h1v1.6h-1V7.2ZM1.8 9h1v1.4h-1V9Zm12.2 0h1v1.4h-1V9Z"
        />
      </svg>
    );
  }

  return (
    <svg className={cls} viewBox={VIEW} width={size} height={size} aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        d="M8 2.2v1.6M8 12.2v1.6M2.2 8h1.6M12.2 8h1.6M4.1 4.1l1.1 1.1M10.8 10.8l1.1 1.1M4.1 11.9l1.1-1.1M10.8 5.2l1.1-1.1"
      />
    </svg>
  );
}

/** Inline SVG for Leaflet divIcon HTML (escaped, no React). */
export function trackSourceIconSvg(kind, size = 12) {
  const s = Number(size) || 12;
  if (kind === 'wifi') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="M8 1.5a7.2 7.2 0 0 0-5.1 2.1l1.1 1.1A5.7 5.7 0 0 1 8 3.5c1.5 0 2.9.6 3.9 1.6l1.1-1.1A7.2 7.2 0 0 0 8 1.5Zm0 3.5a3.7 3.7 0 0 0-2.6 1.1l1.1 1.1c.4-.4 1-.7 1.5-.7s1.1.3 1.5.7l1.1-1.1A3.7 3.7 0 0 0 8 5Zm0 3.2c-.6 0-1.1.2-1.5.6L8 11.2l1.5-2.4c-.4-.4-.9-.6-1.5-.6Z"/></svg>`;
  }
  if (kind === 'lbs') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="M8 1.2 4.2 14h1.4l.8-2.8h3.2l.8 2.8h1.4L8 1.2Zm0 4.2 1.1 3.8H6.9L8 5.4Z"/><circle cx="8" cy="13.2" r="1.1" fill="currentColor"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${s}" height="${s}" aria-hidden="true"><circle cx="8" cy="8" r="2.2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" d="M8 2.2v1.6M8 12.2v1.6M2.2 8h1.6M12.2 8h1.6M4.1 4.1l1.1 1.1M10.8 10.8l1.1 1.1M4.1 11.9l1.1-1.1M10.8 5.2l1.1-1.1"/></svg>`;
}
