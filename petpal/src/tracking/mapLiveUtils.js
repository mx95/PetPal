import { useEffect, useRef, useState } from 'react';

/** @param {number} lat @param {number} lng @param {{ enabled?: boolean, durationMs?: number }} [opts] */
export function useAnimatedLatLng(lat, lng, opts = {}) {
  const { enabled = true, durationMs = 720 } = opts;
  const [pos, setPos] = useState(() => ({ lat, lng }));
  const posRef = useRef(pos);
  const animRef = useRef(null);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!enabled) {
      setPos({ lat, lng });
      return;
    }

    const from = posRef.current;
    const dLat = lat - from.lat;
    const dLng = lng - from.lng;
    if (Math.abs(dLat) < 1e-7 && Math.abs(dLng) < 1e-7) return;

    if (animRef.current) cancelAnimationFrame(animRef.current);
    const t0 = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - t0) / durationMs);
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const next = {
        lat: from.lat + dLat * ease,
        lng: from.lng + dLng * ease,
      };
      posRef.current = next;
      setPos(next);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else animRef.current = null;
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [lat, lng, enabled, durationMs]);

  return pos;
}

/** Rough accuracy ring radius (meters) for map overlay. */
export function accuracyRadiusMeters(position) {
  if (!position) return null;
  const explicit = Number(position.accuracyRadius ?? position.accuracyMeters);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(500, explicit);
  const acc = String(position.accuracy || '').toLowerCase();
  if (position.source === 'lbs' || acc === 'low') return 140;
  if (acc === 'medium') return 50;
  if (acc === 'high') return 15;
  return 28;
}
