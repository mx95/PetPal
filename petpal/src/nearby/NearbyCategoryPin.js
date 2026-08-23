import React, { memo, useMemo } from 'react';
import { Marker } from '@react-google-maps/api';

/** @type {Map<string, object>} */
const ICON_CACHE = new Map();

function mapsSize(w, h) {
  if (typeof window !== 'undefined' && window.google?.maps?.Size) {
    return new window.google.maps.Size(w, h);
  }
  return { width: w, height: h };
}

function mapsPoint(x, y) {
  if (typeof window !== 'undefined' && window.google?.maps?.Point) {
    return new window.google.maps.Point(x, y);
  }
  return { x, y };
}

/**
 * Static SVG pins under /nearby-pins — real URLs (not canvas data-URLs) so iOS
 * Maps renders them, without Marker emoji labels that Google strokes/doubles.
 */
function iconForCategory(categoryId, active) {
  const id = categoryId || 'more';
  const key = `${id}:${active ? '1' : '0'}`;
  const cached = ICON_CACHE.get(key);
  if (cached) return cached;

  const file = active ? `${id}-active.svg` : `${id}.svg`;
  const icon = {
    url: `${process.env.PUBLIC_URL || ''}/nearby-pins/${file}`,
    scaledSize: mapsSize(48, 55),
    size: mapsSize(56, 64),
    anchor: mapsPoint(24, 55),
  };
  ICON_CACHE.set(key, icon);
  return icon;
}

function NearbyCategoryPin({ place, category, active, onClick }) {
  const loc = place?.geometry?.location;
  const icon = useMemo(
    () => iconForCategory(category?.id, Boolean(active)),
    [category?.id, active]
  );

  if (!loc) return null;

  return (
    <Marker
      position={loc}
      title={place.name || category?.label}
      icon={icon}
      zIndex={active ? 1000 : 1}
      clickable
      onClick={() => onClick?.()}
      optimized
    />
  );
}

export default memo(NearbyCategoryPin, (prev, next) => {
  return (
    prev.place?.place_id === next.place?.place_id &&
    prev.active === next.active &&
    prev.category?.id === next.category?.id &&
    prev.place?.geometry?.location === next.place?.geometry?.location
  );
});
