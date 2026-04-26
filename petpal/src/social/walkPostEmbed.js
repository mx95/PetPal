import React from 'react';

/**
 * Visual-only "route" (no real GPS) — friendly map-like graphic for a logged walk.
 */
export function WalkPostMapGraphic({ km, petName, compact = false }) {
  return (
    <div className={`pp-walkPostEmbed pp-walkPostEmbed--map ${compact ? 'pp-walkPostEmbed--mapCompact' : ''}`}>
      {petName ? <div className="pp-walkPostEmbed__tag">Walk with {petName}</div> : null}
      <svg
        className="pp-walkMapSvg"
        viewBox="0 0 320 130"
        role="img"
        aria-label={`Illustration: about ${Number(km).toFixed(1)} kilometres walked`}
      >
        <rect width="100%" height="100%" fill="#e8f0ff" rx="8" />
        <path
          d="M 16 100 Q 70 32 150 64 T 304 40"
          fill="none"
          stroke="#5b37ff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="16" cy="100" r="5" fill="#12b76a" />
        <circle cx="304" cy="40" r="5" fill="#f04438" />
        <text x="160" y="112" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1d2939">
          {Number(km).toFixed(1)} km
        </text>
      </svg>
      {!compact ? (
        <p className="pp-walkPostEmbed__hint">Stylized route (not live GPS) — from your last logged walk.</p>
      ) : null}
    </div>
  );
}

/**
 * Compact distance bar; scale to ~10 km = full.
 */
export function WalkPostBarGraphic({ km, petName, compact = false }) {
  const n = Math.max(0, Number(km) || 0);
  const pct = Math.min(100, (n / 10) * 100);
  return (
    <div className={`pp-walkPostEmbed pp-walkPostEmbed--bar ${compact ? 'pp-walkPostEmbed--barCompact' : ''}`}>
      {petName ? <div className="pp-walkPostEmbed__tag">Walk with {petName}</div> : null}
      <div className="pp-walkBar">
        <div className="pp-walkBar__row">
          <span className="pp-walkBar__value">{n.toFixed(1)} km</span>
          <span className="pp-walkBar__sub">latest logged walk</span>
        </div>
        <div className="pp-walkBar__track" role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={10}>
          <div className="pp-walkBar__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function WalkPostEmbed({ walkEmbed, compact = false }) {
  if (!walkEmbed || walkEmbed.km == null) return null;
  const { style, km, petName } = walkEmbed;
  if (style === 'bar') {
    return <WalkPostBarGraphic km={km} petName={petName} compact={compact} />;
  }
  return <WalkPostMapGraphic km={km} petName={petName} compact={compact} />;
}
