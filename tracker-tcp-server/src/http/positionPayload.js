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

function resolveLastFixAt(d) {
  return (
    d.lastFixAt ||
    d.gps?.timestamp ||
    d.deviceStatus?.timestamp ||
    (d.heldLastKnown ? resolveServerReceivedAt(d) : null) ||
    null
  );
}

function freshnessFromSecondsAgo(secondsAgo) {
  if (typeof secondsAgo !== "number") return null;
  if (secondsAgo < 60) return "live";
  if (secondsAgo < 300) return "recent";
  return "stale";
}

/** Live position JSON — freshness uses server receive time; device GPS clock is separate. */
function buildPositionPayload(imei, d) {
  const loc = d.location || d.gps || {};
  const rawLat = loc.lat != null ? Number(loc.lat) : Number.NaN;
  const rawLng = loc.lng != null ? Number(loc.lng) : Number.NaN;
  const deviceFixTime = d.gps?.timestamp || d.deviceStatus?.timestamp || null;
  const serverReceivedAt = resolveServerReceivedAt(d);
  const lastFixAt = resolveLastFixAt(d);
  const cloudSyncedAt = d.cloudSyncedAt || serverReceivedAt || null;
  const nowMs = Date.now();
  const serverMs = serverReceivedAt ? Date.parse(serverReceivedAt) : Number.NaN;
  const lastFixMs = lastFixAt ? Date.parse(lastFixAt) : Number.NaN;
  const heldLastKnown = d.heldLastKnown === true || d.gpsLockLost === true;
  // Age the pin from when the last trusted GPS was received, not the latest lock-lost uplink.
  const pinMs =
    heldLastKnown && Number.isFinite(lastFixMs) ? lastFixMs : serverMs;
  const secondsAgo = Number.isFinite(pinMs)
    ? Math.max(0, Math.round((nowMs - pinMs) / 1000))
    : Number.isFinite(serverMs)
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
  // Only expose home when the user explicitly set it (never a live GPS copy).
  const home =
    d.homeExplicit &&
    d.homeLocation &&
    isPlausibleLatLng(d.homeLocation.lat, d.homeLocation.lng)
      ? { lat: Number(d.homeLocation.lat), lng: Number(d.homeLocation.lng) }
      : null;
  const homeLat = home ? home.lat : null;
  const homeLng = home ? home.lng : null;

  const useCoords =
    isPlausibleLatLng(rawLat, rawLng) && d.source !== "wifi" && !d.atHomeWifi;
  const lat = useCoords ? rawLat : Number.NaN;
  const lng = useCoords ? rawLng : Number.NaN;

  if (!isPlausibleLatLng(lat, lng)) {
    if (atHomeWifi) {
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
        locationKind: home ? "home_wifi" : "wifi_status",
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
      const lockLost = d.gpsLockLost === true;
      return {
        imei,
        provider: d.provider ?? null,
        lat: null,
        lng: null,
        homeLat,
        homeLng,
        source: d.source ?? null,
        accuracy: d.source === "gps" ? "high" : "low",
        ...statusFields(d),
        lastUpdate: serverReceivedAt,
        receivedAt: serverReceivedAt,
        lastUpdateServer: serverReceivedAt,
        deviceTimeUtc: deviceFixTime,
        secondsAgo,
        warningApproximate: d.source === "lbs" || d.source === "wifi",
        gpsValid: false,
        gpsLockLost: lockLost,
        heldLastKnown: false,
        statusText: lockLost
          ? "Connected — waiting for GPS lock"
          : undefined,
        accuracyText: lockLost ? "No GPS fix yet" : undefined,
        freshness: freshnessFromSecondsAgo(secondsAgo),
        lbs: d.lbs ?? null,
        staleGps: d.staleGps ?? null,
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

  const freshness = freshnessFromSecondsAgo(secondsAgo);

  const statusText =
    heldLastKnown
      ? freshness === "live" || freshness === "recent"
        ? "Last known location — waiting for GPS lock"
        : "Last known location"
      : warningDeviceClockStale && (freshness === "live" || freshness === "recent")
        ? "Connected now — GPS time on collar may be outdated"
        : d.provider === "gpspos" && platformOnline && freshness === "stale" && isPlausibleLatLng(lat, lng)
          ? "Connected — last location from collar"
          : freshness === "live"
            ? "Live tracking"
            : freshness === "recent"
              ? "Updated recently"
              : "Last seen a while ago";
  const accuracyText = heldLastKnown
    ? "Last known GPS location"
    : source === "gps"
      ? "Precise GPS location"
      : source === "wifi"
        ? "Wi‑Fi location"
        : "Approximate location";
  const movementText = d.moving ? "Moving" : "Not moving";

  return {
    imei,
    provider: d.provider ?? null,
    lat,
    lng,
    homeLat,
    homeLng,
    source,
    accuracy: source === "gps" ? "high" : "low",
    battery,
    batteryStatus,
    signal,
    signalStatus,
    isCharging: status.isCharging,
    steps: status.steps,
    isMoving: d.moving === true,
    lastUpdate: heldLastKnown && lastFixAt ? lastFixAt : serverReceivedAt,
    receivedAt: heldLastKnown && lastFixAt ? lastFixAt : serverReceivedAt,
    lastFixAt: lastFixAt || null,
    lastHeardAt: serverReceivedAt,
    secondsAgo,
    freshness,
    statusText,
    accuracyText,
    movementText,
    warningApproximate: isApproximate,
    warningStale: heldLastKnown || (freshness === "stale" && !platformOnline),
    warningDeviceClockStale,
    deviceClockSkewSec,
    platformOnline,
    cloudSyncedAt,
    gpsLockLost: d.gpsLockLost === true,
    heldLastKnown,
    // Held last-known is still a real GPS fix — mark valid so maps can plot it as lastKnown.
    gpsValid: heldLastKnown
      ? true
      : isApproximate
        ? false
        : source === "gps"
          ? true
          : d.gpsValid === true,
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
