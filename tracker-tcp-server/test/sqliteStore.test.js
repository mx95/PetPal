const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createSqliteStore } = require("../src/store/sqliteStore");
const { parseG365Packet } = require("../src/protocol/g365");

function hex(buf) {
  return Buffer.from(String(buf).replace(/\s+/g, ""), "hex");
}

function tempDbPath() {
  return path.join(os.tmpdir(), `petpal-tracker-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
}

function cleanupStore(store, dbPath) {
  store.close();
  try {
    fs.unlinkSync(dbPath);
  } catch {
    /* Windows may still hold the WAL briefly */
  }
}

test("sqlite store — status-only upsert does not append history rows", () => {
  const dbPath = tempDbPath();
  const store = createSqliteStore({ dbPath });

  const imeiA = "861991080050311";
  const imeiB = "863235081917526";

  store.upsert(imeiB, {
    imei: imeiB,
    provider: "xexun",
    receivedAt: new Date().toISOString(),
    gps: { lat: 34.966688, lng: 33.128693, source: "gps", timestamp: new Date().toISOString() },
    source: "gps",
    gpsValid: true,
  });

  const gpsRowsB = store.history(imeiB, { limit: 10 });
  assert.equal(gpsRowsB.length, 1);

  const statusParsed = parseG365Packet(hex("7878071355230803640D0A"), imeiA);
  store.upsert(imeiA, {
    ...statusParsed,
    imei: imeiA,
    provider: "g365",
    receivedAt: new Date().toISOString(),
  });

  const chargingParsed = parseG365Packet(hex("787801820D0A"), imeiA);
  store.upsert(imeiA, {
    ...chargingParsed,
    imei: imeiA,
    provider: "g365",
    receivedAt: new Date().toISOString(),
  });

  const historyA = store.history(imeiA, { limit: 20 });
  assert.equal(historyA.length, 0, "device A should have no GPS history yet");

  const historyB = store.history(imeiB, { limit: 20 });
  assert.equal(historyB.length, 1);
  assert.ok(Math.abs(historyB[0].lat - 34.966688) < 0.0001);

  cleanupStore(store, dbPath);
});

test("sqlite store — upsert key is canonical IMEI even when payload omits it", () => {
  const dbPath = tempDbPath();
  const store = createSqliteStore({ dbPath });
  const imei = "861991080050311";

  store.upsert(imei, {
    provider: "g365",
    receivedAt: new Date().toISOString(),
    deviceStatus: { battery: 90, signal: 66, chargingStatus: 1 },
  });

  const rec = store.get(imei);
  assert.equal(rec.imei, imei);
  assert.equal(rec.battery, 90);

  cleanupStore(store, dbPath);
});
