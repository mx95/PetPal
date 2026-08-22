import React, { memo, useMemo } from 'react';
import { Marker } from '@react-google-maps/api';

/** @type {Map<string, { url: string, scaledSize: { width: number, height: number }, anchor: { x: number, y: number } }>} */
const ICON_CACHE = new Map();

const PIN_W = 52;
const PIN_H = 64;

/**
 * Build a retina PNG pin once per category/active state.
 * Canvas emoji renders reliably on iOS/Android; OverlayView DOM pins flicker while panning.
 */
function markerIconForCategory(category, active) {
  const emoji = category?.icon || '📍';
  const id = category?.id || 'unknown';
  const key = `${id}:${active ? '1' : '0'}:${emoji}`;
  const cached = ICON_CACHE.get(key);
  if (cached) return cached;

  if (typeof document === 'undefined') {
    return {
      url: '',
      scaledSize: { width: PIN_W, height: PIN_H },
      anchor: { x: PIN_W / 2, y: PIN_H },
    };
  }

  const dpr = 2;
  const canvas = document.createElement('canvas');
  canvas.width = PIN_W * dpr;
  canvas.height = PIN_H * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      url: '',
      scaledSize: { width: PIN_W, height: PIN_H },
      anchor: { x: PIN_W / 2, y: PIN_H },
    };
  }
  ctx.scale(dpr, dpr);

  const cx = PIN_W / 2;
  const cy = 24;
  const r = 22;
  const tipY = PIN_H - 2;

  // Drop shadow
  ctx.save();
  ctx.fillStyle = 'rgba(16, 24, 40, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, tipY - 1, 10, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Pin body (rounded head + tip)
  const fill = active ? '#5b37ff' : '#ffffff';
  const stroke = active ? '#3d1fd4' : '#5b37ff';
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.quadraticCurveTo(cx - 4, tipY - 10, cx - r + 2, cy + 8);
  ctx.arc(cx, cy, r, Math.PI * 0.85, Math.PI * 0.15, true);
  ctx.quadraticCurveTo(cx + 4, tipY - 10, cx, tipY);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  // Inner circle for emoji contrast
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.fillStyle = active ? '#4c2fd6' : '#f8fafc';
  ctx.fill();

  // Emoji
  ctx.font = '24px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, cy + 1);

  if (active) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(91, 55, 255, 0.35)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  const icon = {
    url: canvas.toDataURL('image/png'),
    scaledSize: { width: PIN_W, height: PIN_H },
    anchor: { x: PIN_W / 2, y: PIN_H },
  };
  ICON_CACHE.set(key, icon);
  return icon;
}

/**
 * Category pin using a native Google Maps Marker (no OverlayView).
 * Native markers track the map while panning without DOM flicker.
 */
function NearbyCategoryPin({ place, category, active, onClick }) {
  const loc = place?.geometry?.location;
  const icon = useMemo(
    () => markerIconForCategory(category, Boolean(active)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category?.id, category?.icon, active]
  );

  if (!loc) return null;

  return (
    <Marker
      position={loc}
      title={place.name || category.label}
      icon={icon}
      zIndex={active ? 1000 : undefined}
      clickable
      optimized
      onClick={() => onClick?.()}
    />
  );
}

export default memo(NearbyCategoryPin, (prev, next) => {
  // Ignore onClick identity — parent creates a new arrow each render.
  return (
    prev.place?.place_id === next.place?.place_id &&
    prev.active === next.active &&
    prev.category?.id === next.category?.id &&
    prev.category?.icon === next.category?.icon &&
    prev.place?.geometry?.location === next.place?.geometry?.location
  );
});
