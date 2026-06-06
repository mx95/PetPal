#!/usr/bin/env node
/** Quick check: login + Proc_GetLastPosition for configured device. */
const { createMemoryStore } = require("../src/store/memory");
const { GpsposClient } = require("../src/protocol/gpspos");
const { syncGpsposLastPosition } = require("../src/http/gpsposApiRoutes");

const IMEI = process.env.GPSPOS_DEVICE_IDS?.split(",")[0]?.trim() || "861397052428990";
const PLATFORM_ID = process.env.GPSPOS_IMEI_MAP?.split(":")[1]?.trim() || "9705242899";

async function main() {
  const client = new GpsposClient({
    baseUrl: process.env.GPSPOS_API_URL || "https://www.gpspos.net/AppJson.asp",
    user: process.env.GPSPOS_USER || "Sotiris",
    password: process.env.GPSPOS_PASSWORD || "1234",
  });
  const store = createMemoryStore();
  const result = await syncGpsposLastPosition(store, client, IMEI, {
    imeiMap: { [IMEI]: PLATFORM_ID },
  });
  const p = result.position;
  console.log(JSON.stringify({
    ok: true,
    imei: IMEI,
    platformId: PLATFORM_ID,
    lat: p.lat,
    lng: p.lng,
    provider: p.provider,
    signal: p.signal,
    lastUpdate: p.lastUpdate,
  }, null, 2));
}

main().catch((e) => {
  console.error("gpspos sync test failed:", e.message || e);
  process.exit(1);
});
