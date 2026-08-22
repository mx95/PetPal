import React, { memo, useMemo } from 'react';
import { Marker } from '@react-google-maps/api';

/**
 * Material-style map pin path (24×24). Tip at bottom center.
 * Used as a vector Symbol — no image URLs (canvas data-URLs break on iOS Maps).
 */
const PIN_PATH =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z';

/** @type {Map<string, object>} */
const ICON_CACHE = new Map();
/** @type {Map<string, object>} */
const LABEL_CACHE = new Map();

function mapsPoint(x, y) {
  if (typeof window !== 'undefined' && window.google?.maps?.Point) {
    return new window.google.maps.Point(x, y);
  }
  return { x, y };
}

function symbolIconForCategory(active) {
  const key = active ? 'active' : 'idle';
  const cached = ICON_CACHE.get(key);
  if (cached) return cached;

  const icon = {
    path: PIN_PATH,
    fillColor: active ? '#5b37ff' : '#ffffff',
    fillOpacity: 1,
    strokeColor: active ? '#2f14b8' : '#5b37ff',
    strokeWeight: 2.5,
    // ~48px tall on screen — readable without OverlayView flicker.
    scale: 2.15,
    anchor: mapsPoint(12, 22),
    labelOrigin: mapsPoint(12, 9),
  };
  ICON_CACHE.set(key, icon);
  return icon;
}

function labelForCategory(category, active) {
  const emoji = category?.icon || '📍';
  const key = `${category?.id || 'x'}:${active ? '1' : '0'}:${emoji}`;
  const cached = LABEL_CACHE.get(key);
  if (cached) return cached;
  const label = {
    text: emoji,
    fontSize: '16px',
    fontWeight: '700',
    color: active ? '#ffffff' : '#101828',
    className: active ? 'pp-nearby-markerLabel is-active' : 'pp-nearby-markerLabel',
  };
  LABEL_CACHE.set(key, label);
  return label;
}

/**
 * Large category pin via native Marker Symbol + emoji label.
 * Avoids OverlayView pan flicker and broken canvas/SVG image icons on iOS.
 */
function NearbyCategoryPin({ place, category, active, onClick }) {
  const loc = place?.geometry?.location;
  const icon = useMemo(() => symbolIconForCategory(Boolean(active)), [active]);
  const label = useMemo(
    () => labelForCategory(category, Boolean(active)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category?.id, category?.icon, active]
  );

  if (!loc) return null;

  return (
    <Marker
      position={loc}
      title={place.name || category.label}
      icon={icon}
      label={label}
      zIndex={active ? 1000 : 1}
      clickable
      onClick={() => onClick?.()}
    />
  );
}

export default memo(NearbyCategoryPin, (prev, next) => {
  return (
    prev.place?.place_id === next.place?.place_id &&
    prev.active === next.active &&
    prev.category?.id === next.category?.id &&
    prev.category?.icon === next.category?.icon &&
    prev.place?.geometry?.location === next.place?.geometry?.location
  );
});
