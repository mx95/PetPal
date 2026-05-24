#!/usr/bin/env node
/**
 * Pre-commit check: protocol parse + position API shape vs PetPal client expectations.
 * Usage:
 *   node scripts/verify-tracking-alignment.js
 *   TRACKER_BASE=http://116.203.209.68:5002 node scripts/verify-tracking-alignment.js
 */
const { buildPositionPayload } = require("../src/http/positionPayload");
const { isPlausibleLatLng } = require("../src/geo/coords");
const { createMemoryStore } = require("../src/store/memory");

const ODIN = "869469088344608";
const ADONIS = "863235081917526";
const BASE = (process.env.TRACKER_BASE || "").replace(/\/$/, "");

let failed = 0;
function ok(label) {
  console.log(`  OK  ${label}`);
}
function fail(label, detail) {
  failed += 1;
  console.error(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}
function assert(cond, label, detail) {
  if (cond) ok(label);
  else fail(label, detail);
}

console.log("\n=== Unit: buildPositionPayload ===\n");

const wifiStale = {
  imei: ODIN,
  source: "wifi",
  atHomeWifi: true,
  location: { lat: 35.038345, lng: 33.907032 },
  battery: 72,
  signal: 10,
  lastUpdate: new Date().toISOString(),
  wifiBssids: ["ba:af:ca:8c:22:b1"],
};
const pWifi = buildPositionPayload(ODIN, wifiStale);
assert(pWifi.atHomeWifi === true, "wifi+stale LBS → atHomeWifi, no pin");
assert(pWifi.lat == null && pWifi.lng == null, "wifi+stale LBS → null lat/lng");
assert(pWifi.battery === 72, "wifi payload keeps battery");

const lbs = {
  imei: ADONIS,
  source: "lbs",
  location: { lat: 34.95, lng: 33.13 },
  battery: 55,
  lastUpdate: new Date().toISOString(),
};
const pLbs = buildPositionPayload(ADONIS, lbs);
assert(isPlausibleLatLng(pLbs.lat, pLbs.lng), "LBS device returns approximate coords");
assert(pLbs.source === "lbs", "LBS source preserved");

const gps = {
  imei: ADONIS,
  source: "gps",
  gpsValid: true,
  location: { lat: 34.968, lng: 33.12 },
  battery: 60,
  lastUpdate: new Date().toISOString(),
};
const pGps = buildPositionPayload(ADONIS, gps);
assert(pGps.lat === 34.968, "GPS coords returned");

console.log("\n=== Unit: memory merge (wifi must not restore stale GPS) ===\n");

const mem = createMemoryStore();
mem.upsert(ODIN, {
  imei: ODIN,
  source: "lbs",
  gps: { lat: 35.038345, lng: 33.907032 },
  receivedAt: new Date().toISOString(),
});
mem.upsert(ODIN, {
  imei: ODIN,
  source: "wifi",
  gps: { atHomeWifi: true, source: "wifi", wifiBssids: ["aa:bb:cc:dd:ee:ff"] },
  wifiBssids: ["aa:bb:cc:dd:ee:ff"],
  deviceStatus: { battery: 80 },
  receivedAt: new Date().toISOString(),
});
const live = mem.get(ODIN);
assert(live?.atHomeWifi === true, "after wifi packet, atHomeWifi set");
assert(!isPlausibleLatLng(live?.location?.lat, live?.location?.lng), "stale LBS not kept after wifi");
const pLive = buildPositionPayload(ODIN, live);
assert(pLive.atHomeWifi === true, "live memory → position atHomeWifi");

async function fetchJson(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function clientWouldAccept(body) {
  if (!body || typeof body !== "object") return false;
  const hasCoords =
    body.lat != null &&
    body.lng != null &&
    Number.isFinite(Number(body.lat)) &&
    Number.isFinite(Number(body.lng));
  const hasStatus =
    Boolean(body.atHomeWifi) ||
    body.source != null ||
    body.battery != null ||
    body.receivedAt != null ||
    body.lastUpdate != null;
  return hasCoords || hasStatus;
}

async function liveChecks() {
  if (!BASE) {
    console.log("\n=== Live API: skipped (set TRACKER_BASE to run) ===\n");
    return;
  }
  console.log(`\n=== Live API: ${BASE} ===\n`);

  for (const imei of [ODIN, ADONIS]) {
    const pos = await fetchJson(`/position?deviceId=${encodeURIComponent(imei)}`);
    const appPos = await fetchJson(`/api/app/position?deviceId=${encodeURIComponent(imei)}`);
    const dev = await fetchJson(`/devices/${encodeURIComponent(imei)}`);
    const hist = await fetchJson(`/api/app/history?deviceId=${encodeURIComponent(imei)}&limit=5`);

    console.log(`--- ${imei} ---`);
    console.log(`  /position → ${pos.status}`, JSON.stringify(pos.body).slice(0, 120));
    console.log(`  /api/app/position → ${appPos.status}`);

    if (pos.status === 200) {
      assert(clientWouldAccept(pos.body), `${imei} /position 200 is client-safe`);
      if (pos.body.source === "wifi" || pos.body.atHomeWifi) {
        assert(pos.body.lat == null && pos.body.lng == null, `${imei} wifi must not return stale pin`);
      }
    } else if (pos.status === 404) {
      console.log("  (404 — deploy latest tracker-tcp-server and pm2 restart tracker)");
    }

    if (appPos.status === 200 && pos.status === 200) {
      assert(
        Boolean(appPos.body.atHomeWifi) === Boolean(pos.body.atHomeWifi),
        `${imei} app vs legacy position agree on atHomeWifi`
      );
    }

    if (dev.status === 200) {
      if (dev.body.source === "wifi") {
        assert(
          !isPlausibleLatLng(dev.body.location?.lat, dev.body.location?.lng),
          `${imei} /devices/:imei wifi must not expose stale coords`
        );
      }
    }

    if (hist.status === 200 && Array.isArray(hist.body.history)) {
      const badWifiPin = hist.body.history.find(
        (h) => h.source === "wifi" && isPlausibleLatLng(h.lat, h.lng)
      );
      if (badWifiPin) {
        console.log(
          `  note: old history row still has wifi+coords (${badWifiPin.lat},${badWifiPin.lng}) — client ignores non-GPS`
        );
      }
    }
  }

  const list = await fetchJson("/devices");
  if (list.status === 200 && Array.isArray(list.body)) {
    const odinRow = list.body.find((d) => String(d.imei) === ODIN);
    if (odinRow?.source === "wifi" && isPlausibleLatLng(odinRow.location?.lat, odinRow.location?.lng)) {
      fail("GET /devices Odin still shows wifi+stale coords (needs deploy + live memory)");
    } else {
      ok("GET /devices Odin not advertising stale wifi pin");
    }
  }
}

(async () => {
  await liveChecks();
  console.log(failed ? `\n${failed} check(s) failed.\n` : "\nAll checks passed.\n");
  process.exit(failed ? 1 : 0);
})();
