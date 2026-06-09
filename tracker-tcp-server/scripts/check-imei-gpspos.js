#!/usr/bin/env node
/** One-off: query gpspos.net for an IMEI (full ID + common platform ID variants). */
const { GpsposClient } = require("../src/protocol/gpspos");

const imei = process.argv[2] || "868022030670736";
const ids = [...new Set([
  imei,
  imei.slice(2),
  imei.slice(1),
  imei.slice(-10),
  imei.replace(/^86/, ""),
])];

const client = new GpsposClient({
  baseUrl: process.env.GPSPOS_API_URL || "https://www.gpspos.net/AppJson.asp",
  user: process.env.GPSPOS_USER || "Sotiris",
  password: process.env.GPSPOS_PASSWORD || "1234",
});

async function main() {
  await client.login();
  console.log("Logged in. Probing IDs for IMEI", imei);
  for (const id of ids) {
    try {
      const pos = await client.getLastPosition(id);
      const row = pos.records[0];
      if (!row) {
        console.log(id, "-> no records");
        continue;
      }
      console.log(JSON.stringify({
        queriedId: id,
        platformId: row.strTEID,
        lat: row.dbLat,
        lng: row.dbLon,
        nTime: row.nTime,
        nSpeed: row.nSpeed,
        nGPSSignal: row.nGPSSignal,
        nGSMSignal: row.nGSMSignal,
        nTEState: row.nTEState,
      }, null, 2));
    } catch (e) {
      console.log(id, "->", e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
