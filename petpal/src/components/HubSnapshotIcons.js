import React from 'react';

/** Small header icons + large card decorations for Today snapshot. */

export function SnapPinIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none">
      <path
        d="M12 22s7-6.2 7-12.2A7 7 0 0 0 5 9.8C5 15.8 12 22 12 22z"
        fill="#2F80FF"
      />
      <circle cx="12" cy="9.5" r="2.6" fill="#fff" />
    </svg>
  );
}

export function SnapFlameIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none">
      <path
        d="M12.2 2.4c.4 2.2-.2 3.8-1.4 5.2-1.1 1.2-1.7 2.3-1.5 3.7.1.8.5 1.5 1.1 2-.8-.1-1.5-.6-1.9-1.4-.6-1.1-.5-2.6.3-4.1C7.1 9.8 6 12 6 14.4 6 18.1 8.7 21 12.2 21S18.4 18.1 18.4 14.4c0-2.9-1.4-5-3.2-7.1-.7-.8-1.4-1.7-1.6-2.8-.1-.6-.2-1.3-.2-2.1z"
        fill="#F97316"
      />
      <path
        d="M12.1 11.2c.9 1 .9 2.1.5 3.1-.3.7-.9 1.2-1.6 1.5.9 0 1.8-.4 2.4-1.1.8-1 .9-2.4.3-3.5-.2-.4-.7-.5-1.1-.4-.2.1-.4.2-.5.4z"
        fill="#FBBF24"
      />
    </svg>
  );
}

export function SnapTrophyIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none">
      <path
        d="M7 4h10v3.2c0 2.8-1.9 5.2-4.5 5.9L12 14l-.5-.9C9 12.4 7 10 7 7.2V4z"
        fill="#F59E0B"
      />
      <path d="M7 5.2H4.8C4.3 5.2 4 5.6 4 6.1c0 2 1.3 3.5 3 3.9V5.2z" fill="#FBBF24" />
      <path d="M17 5.2h2.2c.5 0 .8.4.8.9 0 2-1.3 3.5-3 3.9V5.2z" fill="#FBBF24" />
      <rect x="10.2" y="14" width="3.6" height="2.2" rx="0.6" fill="#D97706" />
      <rect x="8.2" y="16.4" width="7.6" height="2.4" rx="1" fill="#B45309" />
    </svg>
  );
}

export function SnapBarsIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none">
      <rect x="4" y="13" width="4" height="7" rx="1.2" fill="#60A5FA" />
      <rect x="10" y="9" width="4" height="11" rx="1.2" fill="#818CF8" />
      <rect x="16" y="5" width="4" height="15" rx="1.2" fill="#7C5CFF" />
    </svg>
  );
}

export function SnapDualPawIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none">
      <ellipse cx="8.2" cy="15.2" rx="3.2" ry="2.6" fill="#2F80FF" />
      <circle cx="5.6" cy="11.4" r="1.15" fill="#2F80FF" />
      <circle cx="7.6" cy="10.2" r="1.15" fill="#2F80FF" />
      <circle cx="9.8" cy="10.4" r="1.15" fill="#2F80FF" />
      <circle cx="11.2" cy="12.2" r="1.05" fill="#2F80FF" />
      <ellipse cx="16.4" cy="10.6" rx="3.2" ry="2.6" fill="#56A0FF" />
      <circle cx="13.8" cy="6.8" r="1.15" fill="#56A0FF" />
      <circle cx="15.8" cy="5.6" r="1.15" fill="#56A0FF" />
      <circle cx="18" cy="5.8" r="1.15" fill="#56A0FF" />
      <circle cx="19.4" cy="7.6" r="1.05" fill="#56A0FF" />
    </svg>
  );
}

export function DecoPathTrail() {
  return (
    <svg className="pp-hubSnap__decoSvg" viewBox="0 0 72 72" aria-hidden fill="none">
      <path
        d="M8 48c10-2 14-14 22-18 8-4 14 2 20-2 5-3 8-10 14-12"
        stroke="#7EB6FF"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M10 54c9-1 13-11 20-15 8-4 15 1 21-2"
        stroke="#A9D0FF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.4"
      />
      <ellipse cx="56" cy="48" rx="8" ry="6.5" fill="#7EB6FF" opacity="0.45" />
      <circle cx="50.5" cy="40.5" r="2.4" fill="#7EB6FF" opacity="0.45" />
      <circle cx="55.2" cy="38.2" r="2.5" fill="#7EB6FF" opacity="0.45" />
      <circle cx="60.2" cy="39" r="2.4" fill="#7EB6FF" opacity="0.45" />
      <circle cx="63.2" cy="43.2" r="2.2" fill="#7EB6FF" opacity="0.45" />
    </svg>
  );
}

export function DecoFlameWatermark() {
  return (
    <svg className="pp-hubSnap__decoSvg pp-hubSnap__decoSvg--lg" viewBox="0 0 72 72" aria-hidden fill="none">
      <path
        d="M38 6c1.2 6.2-.4 10.4-3.6 14.2-3 3.4-4.6 6.2-4 9.8.4 2.2 1.4 4 3 5.2-2.2-.2-4-1.6-5.2-3.6-1.6-2.8-1.4-6.6.8-10.4C25.4 26 22 32 22 38.4 22 49.2 30 58 39.2 58S56.4 49.2 56.4 38.4c0-8-3.8-13.6-8.6-19.2-2-2.4-4-4.8-4.6-7.8C42.6 9 41.8 7.2 41.2 5.2L38 6z"
        fill="#FDBA74"
        opacity="0.55"
      />
      <path
        d="M38.2 30c2.4 2.6 2.4 5.6 1.2 8.2-.8 1.8-2.4 3.2-4.2 4 2.4 0 4.8-1 6.4-3 2.2-2.6 2.4-6.2.8-9-.6-1-1.8-1.2-2.8-1-.6.2-1 .6-1.4 1z"
        fill="#FED7AA"
        opacity="0.7"
      />
    </svg>
  );
}

export function DecoCalendarBadge() {
  return (
    <svg className="pp-hubSnap__decoSvg" viewBox="0 0 72 72" aria-hidden fill="none">
      <circle cx="40" cy="40" r="22" fill="#D1FAE5" opacity="0.95" />
      <rect x="28" y="30" width="24" height="22" rx="4" fill="#fff" />
      <rect x="28" y="30" width="24" height="7" rx="3.5" fill="#34D399" />
      <rect x="33" y="27.5" width="2.4" height="6" rx="1.2" fill="#059669" />
      <rect x="44.5" y="27.5" width="2.4" height="6" rx="1.2" fill="#059669" />
      <circle cx="34.5" cy="43" r="1.6" fill="#6EE7B7" />
      <circle cx="40" cy="43" r="1.6" fill="#34D399" />
      <circle cx="45.5" cy="43" r="1.6" fill="#6EE7B7" />
      <circle cx="34.5" cy="48.2" r="1.6" fill="#A7F3D0" />
      <circle cx="40" cy="48.2" r="1.6" fill="#6EE7B7" />
    </svg>
  );
}

export function DecoPawBadge() {
  return (
    <svg className="pp-hubSnap__decoSvg" viewBox="0 0 72 72" aria-hidden fill="none">
      <circle cx="40" cy="40" r="22" fill="#E9E0FF" opacity="0.95" />
      <ellipse cx="40" cy="46" rx="9" ry="7.2" fill="#8B6CFF" opacity="0.85" />
      <circle cx="31.5" cy="36" r="3.2" fill="#8B6CFF" opacity="0.85" />
      <circle cx="37.5" cy="32.5" r="3.3" fill="#8B6CFF" opacity="0.85" />
      <circle cx="44.5" cy="32.5" r="3.3" fill="#8B6CFF" opacity="0.85" />
      <circle cx="49.5" cy="37" r="3.1" fill="#8B6CFF" opacity="0.85" />
    </svg>
  );
}
