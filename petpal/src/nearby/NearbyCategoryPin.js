import React, { memo, useMemo } from 'react';
import { Marker } from '@react-google-maps/api';

/** @type {Map<string, object>} */
const ICON_CACHE = new Map();

function buildPinSvg(emoji, active) {
  const fill = active ? '#5b37ff' : '#ffffff';
  const stroke = active ? '#ffffff' : 'rgba(16,24,40,0.18)';
  const stem = active ? '#5b37ff' : '#98a2b3';
  // Keep emoji outside foreignObject when possible — text is more stable in SVG markers.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
  <path d="M18 42s-12-11.2-12-20a12 12 0 1 1 24 0c0 8.8-12 20-12 20z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  <circle cx="18" cy="16" r="9.5" fill="${active ? '#4c2fd6' : '#f8fafc'}"/>
  <text x="18" y="20.5" text-anchor="middle" font-size="12">${emoji}</text>
  <circle cx="18" cy="42" r="2.2" fill="${stem}"/>
</svg>`;
}

function markerIconForCategory(category, active) {
  const emoji = category?.icon || '📍';
  const id = category?.id || 'unknown';
  const key = `${id}:${active ? '1' : '0'}:${emoji}`;
  const cached = ICON_CACHE.get(key);
  if (cached) return cached;
  const icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildPinSvg(emoji, active))}`,
    scaledSize: { width: 36, height: 44 },
    anchor: { x: 18, y: 42 },
  };
  ICON_CACHE.set(key, icon);
  return icon;
}

/**
 * Category pin on the Nearby Google Map.
 * Uses native Marker (not OverlayView) so pins stay stable while panning/zooming.
 */
function NearbyCategoryPin({ place, category, active, onClick }) {
  const loc = place?.geometry?.location;
  const icon = useMemo(
    () => markerIconForCategory(category, Boolean(active)),
    [category?.id, category?.icon, active]
  );

  if (!loc) return null;

  return (
    <Marker
      position={loc}
      title={place.name || category.label}
      icon={icon}
      zIndex={active ? 1000 : 1}
      onClick={() => onClick?.()}
    />
  );
}

export default memo(NearbyCategoryPin);
