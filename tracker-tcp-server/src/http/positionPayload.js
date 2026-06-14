const { isPlausibleLatLng } = require("../geo/coords");

function batteryStatusLabel(battery) {
  return typeof battery === "number" && Number.isFinite(battery)
    ? battery > 70
      ? "good"
      : battery > 30
        ? "medium"
        : "low"
    : null;
}

function signalStatusLabel(signal) {
  return typeof signal === "number" && Number.isFinite(signal)
    ? signal > 12
      ? "strong"
      : signal > 6
        ? "medium"
        : "weak"
    : null;
}

function statusFields(d) {
  const battery = d.battery ?? null;
  const signal = d.signal ?? null;
  return {
    battery,
    batteryStatus: batteryStatusLabel(battery),
    signal,
    signalStatus: signalStatusLabel(signal),
    isCharging: d.charging === true,
    steps: d.steps ?? null,
  };
}

function resolveServerReceivedAt(d) {
  return (
    d.receivedAt ||
    d.received?.latest?.receivedAt ||
    d.received?.packets?.[0]?.receivedAt ||
    d.lastUpdate ||
    d.cloudSyncedAt ||
    null
  );
}

/** Live position JSON — freshness uses server receive time; device GPS clock is separate. */
function buildPositionPayload(imei, d) {
  const loc = d.location || d.gps || {};
  const rawLat = loc.lat != null ? Number(loc.lat) : Number.NaN;
  const rawLng = loc.lng != null ? Number(loc.lng) : Number.NaN;
  const deviceFixTime = d.gps?.timestamp || d.deviceStatus?.timestamp || null;
  const serverReceivedAt = resolveServerReceivedAt(d);
  const cloudSyncedAt = d.cloudSyncedAt || serverReceivedAt || null;
  const nowMs = Date.now();
  const serverMs = serverReceivedAt ? Date.parse(serverReceivedAt) : Number.NaN;
  const secondsAgo = Number.isFinite(serverMs)
    ? Math.max(0, Math.round((nowMs - serverMs) / 1000))
    : null;
  const deviceFixMs = deviceFixTime ? Date.parse(deviceFixTime) : Number.NaN;
  const deviceClockSkewSec =
    Number.isFinite(deviceFixMs) && Number.isFinite(serverMs)
      ? Math.round((serverMs - deviceFixMs) / 1000)
      : null;
  const warningDeviceClockStale =
    deviceClockSkewSec != null && deviceClockSkewSec > 300;
  const platformOnline = d.platformOnline === true;

  const atHomeWifi = Boolean(d.atHomeWifi || d.source === "wifi");

  const useCoords =
    isPlausibleLatLng(rawLat, rawLng) && d.source !== "wifi" && !d.atHomeWifi;
  const lat = useCoords ? rawLat : Number.NaN;
  const lng = useCoords ? rawLng : Number.NaN;

  if (!isPlausibleLatLng(lat, lng)) {
    if (atHomeWifi) {
      const home = d.homeLocation || null;
      const hasHome = home && isPlausibleLatLng(home.lat, home.lng);
      const homeLat = hasHome ? Number(home.lat) : null;
      const homeLng = hasHome ? Number(home.lng) : null;
      return {
        imei,
        provider: d.provider ?? null,
        lat: homeLat,
        lng: homeLng,
        homeLat,
        homeLng,
        atHomeWifi: true,
        source: "wifi",
        accuracy: "wifi",
        locationKind: hasHome ? "home_wifi" : "wifi_status",
        ...statusFields(d),
        lastUpdate: serverReceivedAt,
        receivedAt: serverReceivedAt,
        lastUpdateServer: serverReceivedAt,
        deviceTimeUtc: deviceFixTime,
        secondsAgo,
        warningApproximate: true,
        gpsValid: false,
        wifiBssids: d.wifiBssids ?? null,
      };
    }
    if (d.battery != null || d.signal != null || d.source || d.charging != null) {
      const approxCoords =
        isPlausibleLatLng(rawLat, rawLng) && (d.source === "lbs" || d.source === "wifi");
      return {
        imei,
        provider: d.provider ?? null,
        lat: approxCoords ? rawLat : null,
        lng: approxCoords ? rawLng : null,
        source: d.source ?? null,
        accuracy: d.source === "gps" ? "high" : "low",
        ...statusFields(d),
        lastUpdate: serverReceivedAt,
        receivedAt: serverReceivedAt,
        lastUpdateServer: serverReceivedAt,
        deviceTimeUtc: deviceFixTime,
        secondsAgo,
        warningApproximate: d.source === "lbs" || d.source === "wifi",
        gpsValid: d.gpsValid === true,
      };
    }
    return { error: "no_position" };
  }

  const deviceTimeUtc = deviceFixTime;
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
  const status = statusFields(d);
  const battery = status.battery;
  const signal = status.signal;
  const batteryStatus = status.batteryStatus;
  const signalStatus = status.signalStatus;

  const freshness =
    typeof secondsAgo === "number"
      ? secondsAgo < 60
        ? "live"
        : secondsAgo < 300
          ? "recent"
          : "stale"
      : null;

  const statusText =
    warningDeviceClockStale && (freshness === "live" || freshness === "recent")
      ? "Connected now — GPS time on collar may be outdated"
      : d.provider === "gpspos" && platformOnline && freshness === "stale" && isPlausibleLatLng(lat, lng)
        ? "Connected — last location from collar"
        : freshness === "live"
          ? "Live tracking"
          : freshness === "recent"
            ? "Updated recently"
            : "Last seen a while ago";
  const accuracyText =
    source === "gps" ? "Precise GPS location" : source === "wifi" ? "Wi‑Fi location" : "Approximate location";
  const movementText = d.moving ? "Moving" : "Not moving";

  return {
    imei,
    provider: d.provider ?? null,
    lat,
    lng,
    source,
    accuracy: source === "gps" ? "high" : "low",
    battery,
    batteryStatus,
    signal,
    signalStatus,
    isCharging: status.isCharging,
    steps: status.steps,
    isMoving: d.moving === true,
    lastUpdate: serverReceivedAt,
    receivedAt: serverReceivedAt,
    secondsAgo,
    freshness,
    statusText,
    accuracyText,
    movementText,
    warningApproximate: isApproximate,
    warningStale: freshness === "stale" && !platformOnline,
    warningDeviceClockStale,
    deviceClockSkewSec,
    platformOnline,
    cloudSyncedAt,
    gpsValid: d.gpsValid === true,
    satellites: d.satellites ?? null,
    speed: d.speed != null ? Number(d.speed) : null,
    lastUpdateServer: serverReceivedAt,
    deviceTimeUtc,
    deviceTimeLocal,
    isStale,
    received: d.received ?? null,
    raw: d.raw ?? null,
  };
}

module.exports = { buildPositionPayload };
