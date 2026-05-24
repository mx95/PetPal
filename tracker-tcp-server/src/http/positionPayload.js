const { isPlausibleLatLng } = require("../geo/coords");

/** Live position JSON — freshness and sorting use server receive time, not the collar clock. */
function buildPositionPayload(imei, d) {
  const loc = d.location || d.gps || {};
  const rawLat = loc.lat != null ? Number(loc.lat) : Number.NaN;
  const rawLng = loc.lng != null ? Number(loc.lng) : Number.NaN;
  const receivedAt = d.lastUpdate || d.receivedAt || null;
  const nowMs = Date.now();
  const baseTs = receivedAt ? Date.parse(receivedAt) : Number.NaN;
  const secondsAgo = Number.isFinite(baseTs) ? Math.max(0, Math.round((nowMs - baseTs) / 1000)) : null;

  const atHomeWifi = Boolean(
    d.atHomeWifi ||
      d.source === "wifi" ||
      (Array.isArray(d.wifiBssids) && d.wifiBssids.length > 0)
  );

  const useCoords = isPlausibleLatLng(rawLat, rawLng) && !atHomeWifi && d.source !== "wifi";
  const lat = useCoords ? rawLat : Number.NaN;
  const lng = useCoords ? rawLng : Number.NaN;

  if (!isPlausibleLatLng(lat, lng)) {
    if (atHomeWifi) {
      return {
        imei,
        lat: null,
        lng: null,
        atHomeWifi: true,
        source: "wifi",
        accuracy: "wifi",
        battery: d.battery ?? null,
        signal: d.signal ?? null,
        lastUpdate: receivedAt,
        receivedAt,
        secondsAgo,
        warningApproximate: true,
        gpsValid: false,
        wifiBssids: d.wifiBssids ?? null,
      };
    }
    if (d.battery != null || d.signal != null || d.source) {
      return {
        imei,
        lat: null,
        lng: null,
        source: d.source ?? null,
        accuracy: d.source === "gps" ? "high" : "low",
        battery: d.battery ?? null,
        signal: d.signal ?? null,
        lastUpdate: receivedAt,
        receivedAt,
        secondsAgo,
        warningApproximate: d.source === "lbs" || d.source === "wifi",
        gpsValid: false,
      };
    }
    return { error: "no_position" };
  }

  const deviceTimeUtc = d.gps?.timestamp || null;
  const deviceTimeLocal = deviceTimeUtc
    ? new Date(deviceTimeUtc).toLocaleString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : null;
  const isStale = secondsAgo != null ? secondsAgo > 120 : null;

  const source = d.source ?? null;
  const isApproximate = source === "lbs" || source === "wifi";
  const battery = d.battery ?? null;
  const signal = d.signal ?? null;

  const batteryStatus =
    typeof battery === "number" && Number.isFinite(battery)
      ? battery > 70
        ? "good"
        : battery > 30
          ? "medium"
          : "low"
      : null;
  const signalStatus =
    typeof signal === "number" && Number.isFinite(signal)
      ? signal > 12
        ? "strong"
        : signal > 6
          ? "medium"
          : "weak"
      : null;

  const freshness =
    typeof secondsAgo === "number"
      ? secondsAgo < 60
        ? "live"
        : secondsAgo < 300
          ? "recent"
          : "stale"
      : null;

  const statusText =
    freshness === "live" ? "Live tracking" : freshness === "recent" ? "Updated recently" : "Last seen a while ago";
  const accuracyText =
    source === "gps" ? "Precise GPS location" : source === "wifi" ? "Wi‑Fi location" : "Approximate location";
  const movementText = d.moving ? "Moving" : "Not moving";

  return {
    imei,
    lat,
    lng,
    source,
    accuracy: source === "gps" ? "high" : "low",
    battery,
    batteryStatus,
    signal,
    signalStatus,
    isCharging: d.charging === true,
    steps: d.steps ?? null,
    isMoving: d.moving === true,
    lastUpdate: receivedAt,
    receivedAt,
    secondsAgo,
    freshness,
    statusText,
    accuracyText,
    movementText,
    warningApproximate: isApproximate,
    warningStale: freshness === "stale",
    gpsValid: d.gpsValid === true,
    satellites: d.satellites ?? null,
    speed: d.speed != null ? Number(d.speed) : null,
    lastUpdateServer: receivedAt,
    deviceTimeUtc,
    deviceTimeLocal,
    isStale,
    received: d.received ?? null,
    raw: d.raw ?? null,
  };
}

module.exports = { buildPositionPayload };
