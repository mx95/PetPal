import React from 'react';

const VIEW = '0 0 16 16';

function trackSourceImgSrc(kind) {
  return `${process.env.PUBLIC_URL || ''}/ui-icons/source-${kind}.png`;
}

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

  return (
    <img
      className={cls}
      src={trackSourceImgSrc(kind === 'lbs' ? 'lbs' : 'gps')}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      decoding="async"
    />
  );
}

/** Inline SVG for Leaflet divIcon HTML (escaped, no React). */
export function trackSourceIconSvg(kind, size = 12) {
  const s = Number(size) || 12;
  if (kind === 'wifi') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${s}" height="${s}" aria-hidden="true"><path fill="currentColor" d="M8 1.5a7.2 7.2 0 0 0-5.1 2.1l1.1 1.1A5.7 5.7 0 0 1 8 3.5c1.5 0 2.9.6 3.9 1.6l1.1-1.1A7.2 7.2 0 0 0 8 1.5Zm0 3.5a3.7 3.7 0 0 0-2.6 1.1l1.1 1.1c.4-.4 1-.7 1.5-.7s1.1.3 1.5.7l1.1-1.1A3.7 3.7 0 0 0 8 5Zm0 3.2c-.6 0-1.1.2-1.5.6L8 11.2l1.5-2.4c-.4-.4-.9-.6-1.5-.6Z"/></svg>`;
  }
  const file = kind === 'lbs' ? 'lbs' : 'gps';
  return `<img src="${trackSourceImgSrc(file)}" width="${s}" height="${s}" alt="" aria-hidden="true" decoding="async" style="display:block;width:${s}px;height:${s}px;max-width:none;border-radius:6px;object-fit:cover" />`;
}
