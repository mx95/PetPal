"use strict";

const EARTH_RADIUS_M = 6371008.8;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters between two {lat, lng} points. */
function haversineM(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

module.exports = { haversineM };
