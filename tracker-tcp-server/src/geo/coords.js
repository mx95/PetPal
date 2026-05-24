/** Reject unset collar coordinates (0,0) and out-of-range values. */
function isPlausibleLatLng(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return false;
  if (Math.abs(la) < 0.00001 && Math.abs(lo) < 0.00001) return false;
  if (Math.abs(la) < 0.001 || Math.abs(lo) < 0.001) return false;
  return true;
}

function parsedCoordsUsable(parsed) {
  return (
    parsed &&
    parsed.lat != null &&
    parsed.lng != null &&
    isPlausibleLatLng(parsed.lat, parsed.lng)
  );
}

module.exports = { isPlausibleLatLng, parsedCoordsUsable };
