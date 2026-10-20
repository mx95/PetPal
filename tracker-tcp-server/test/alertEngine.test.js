const test = require("node:test");
const assert = require("node:assert/strict");
const { createAlertEngine, extractFix, isSosRecord } = require("../src/alerts/alertEngine");
const { buildPushText } = require("../src/alerts/messages");
const { parseZone, parsePrefs } = require("../src/alerts/firebaseGateway");
const { startAlerts } = require("../src/alerts");

const ZONE = { enabled: true, lat: 34.7, lng: 33.0, radiusM: 200, notifyExit: true, notifyEnter: true };
// ~1° latitude ≈ 111,195 m
const metersNorth = (m) => 34.7 + m / 111195;

function harness({ zone = ZONE, prefs = {}, config = {}, persistence = null } = {}) {
  let clock = Date.parse("2026-01-01T12:00:00Z");
  const notifications = [];
  const pushes = [];
  const ctx = {
    uid: "u1",
    petId: "p1",
    petName: "Rex",
    imei: "111111111111111",
    zone,
    prefs: { push: true, zone: true, battery: true, sos: true, offline: true, ...prefs },
  };
  const gateway = {
    resolve: async () => ctx,
    addNotification: async (uid, payload) => notifications.push({ uid, ...payload }),
    sendPush: async (uid, payload) => pushes.push({ uid, ...payload }),
  };
  const engine = createAlertEngine({
    gateway,
    now: () => clock,
    logger: { log() {}, warn() {} },
    config,
    persistence,
  });
  const record = (extra = {}) => {
    const receivedAt = new Date(clock).toISOString();
    return { receivedAt, gps: { timestamp: receivedAt }, ...extra };
  };
  const fixAt = async (metersFromCenter, extra = {}) => {
    clock += 60 * 1000;
    const data = record({ location: { lat: metersNorth(metersFromCenter), lng: ZONE.lng }, ...extra });
    data.gps = { ...data.gps, lat: data.location.lat, lng: data.location.lng };
    await engine.onRecord("111111111111111", data, { battery: null });
  };
  return { engine, notifications, pushes, fixAt, advance: (ms) => (clock += ms), now: () => clock, ctx, record };
}

test("first observation is a silent baseline", async () => {
  const h = harness();
  await h.fixAt(500);
  assert.equal(h.notifications.length, 0);
});

test("exit requires two confirmed fixes beyond the margin", async () => {
  const h = harness();
  await h.fixAt(50);
  await h.fixAt(500);
  assert.equal(h.notifications.length, 0);
  await h.fixAt(520);
  assert.equal(h.notifications.length, 1);
  assert.equal(h.notifications[0].type, "zone_exit");
  assert.equal(h.notifications[0].params.radius, 200);
  assert.equal(h.pushes.length, 1);
});

test("single noisy fix and dead-band fixes never alert", async () => {
  const h = harness();
  await h.fixAt(50);
  await h.fixAt(500);
  await h.fixAt(60);
  await h.fixAt(500);
  await h.fixAt(205);
  await h.fixAt(210);
  assert.equal(h.notifications.length, 0);
});

test("re-entry alerts immediately once confirmed, so state never misleads", async () => {
  const h = harness();
  await h.fixAt(50);
  await h.fixAt(500);
  await h.fixAt(500);
  await h.fixAt(50);
  await h.fixAt(50);
  await h.fixAt(500);
  await h.fixAt(500);
  assert.deepEqual(h.notifications.map((n) => n.type), ["zone_exit", "zone_enter", "zone_exit"]);
});

test("notifyEnter=false suppresses only enter alerts", async () => {
  const h = harness({ zone: { ...ZONE, notifyEnter: false } });
  await h.fixAt(50);
  await h.fixAt(500);
  await h.fixAt(500);
  await h.fixAt(50);
  await h.fixAt(50);
  assert.deepEqual(h.notifications.map((n) => n.type), ["zone_exit"]);
});

test("notifyExit=false suppresses exit alerts", async () => {
  const h = harness({ zone: { ...ZONE, notifyExit: false } });
  await h.fixAt(50);
  await h.fixAt(500);
  await h.fixAt(500);
  assert.equal(h.notifications.length, 0);
});

test("zone pref off suppresses alerts; push pref off keeps inbox only", async () => {
  const off = harness({ prefs: { zone: false } });
  await off.fixAt(50);
  await off.fixAt(500);
  await off.fixAt(500);
  assert.equal(off.notifications.length, 0);

  const inboxOnly = harness({ prefs: { push: false } });
  await inboxOnly.fixAt(50);
  await inboxOnly.fixAt(500);
  await inboxOnly.fixAt(500);
  assert.equal(inboxOnly.notifications.length, 1);
  assert.equal(inboxOnly.pushes.length, 0);
});

test("LBS, lost-lock and stale fixes are ignored", async () => {
  assert.equal(extractFix({ location: { lat: 34.7, lng: 33 }, source: "lbs" }, Date.now(), 1e6), null);
  assert.equal(extractFix({ gps: { lat: 34.7, lng: 33 }, gpsLockLost: true }, Date.now(), 1e6), null);
  assert.equal(extractFix({ gps: { lat: 34.7, lng: 33 }, heldLastKnown: true }, Date.now(), 1e6), null);
  const now = Date.parse("2026-01-01T12:00:00Z");
  const stale = { receivedAt: new Date(now).toISOString(), gps: { lat: 34.7, lng: 33, timestamp: new Date(now - 3600e3).toISOString() } };
  assert.equal(extractFix(stale, now, 30 * 60 * 1000), null);
  assert.ok(extractFix({ gps: { lat: 34.7, lng: 33 } }, now, 1e6));
});

test("out-of-order fixes are skipped", async () => {
  const h = harness();
  await h.fixAt(50);
  const older = h.record({ gps: { lat: metersNorth(900), lng: ZONE.lng, timestamp: new Date(h.now() - 5 * 60e3).toISOString() } });
  await h.engine.onRecord("111111111111111", { ...older, location: older.gps }, { battery: null });
  await h.engine.onRecord("111111111111111", { ...older, location: older.gps }, { battery: null });
  assert.equal(h.notifications.length, 0);
});

test("changing the zone resets state without alerting", async () => {
  const h = harness();
  await h.fixAt(50);
  h.ctx.zone = { ...ZONE, lat: ZONE.lat + 0.01 };
  await h.fixAt(50);
  await h.fixAt(50);
  assert.equal(h.notifications.length, 0);
});

test("battery alert fires once on the falling edge and re-arms after recovery", async () => {
  const h = harness();
  const send = (battery, charging = false) => h.engine.onRecord("111111111111111", h.record({}), { battery, charging });
  await send(50);
  await send(19);
  assert.deepEqual(h.notifications.map((n) => n.type), ["battery_low"]);
  assert.equal(h.notifications[0].params.battery, 19);
  await send(15);
  assert.equal(h.notifications.length, 1);
  await send(35);
  h.advance(7 * 3600e3);
  await send(18);
  assert.equal(h.notifications.length, 2);
});

test("already-low battery on first sight is silent; charging never alerts", async () => {
  const h = harness();
  await h.engine.onRecord("111111111111111", h.record({}), { battery: 10, charging: false });
  assert.equal(h.notifications.length, 0);
  const c = harness();
  await c.engine.onRecord("111111111111111", c.record({}), { battery: 60, charging: false });
  await c.engine.onRecord("111111111111111", c.record({}), { battery: 5, charging: true });
  assert.equal(c.notifications.length, 0);
});

test("SOS alerts immediately with a cooldown", async () => {
  const h = harness();
  const sos = () => h.engine.onRecord("111111111111111", h.record({ deviceStatus: { alarm: "sos" } }), { battery: null });
  await sos();
  await sos();
  assert.equal(h.notifications.length, 1);
  assert.equal(h.notifications[0].type, "sos");
  h.advance(3 * 60e3);
  await sos();
  assert.equal(h.notifications.length, 2);
  assert.equal(isSosRecord({ deviceStatus: { alarm: "sos" } }), true);
  assert.equal(isSosRecord({ deviceStatus: { alarm: null } }), false);
});

test("offline alert fires once after quiet period, only inside the window", async () => {
  const h = harness();
  await h.engine.onRecord("111111111111111", h.record({}), { battery: null });
  const device = { imei: "111111111111111" };
  await h.engine.sweepOffline([device]);
  assert.equal(h.notifications.length, 0);
  h.advance(4 * 3600e3);
  await h.engine.sweepOffline([device]);
  await h.engine.sweepOffline([device]);
  assert.deepEqual(h.notifications.map((n) => n.type), ["offline"]);
  assert.equal(h.notifications[0].params.hours, 4);

  const ancient = harness();
  await ancient.engine.sweepOffline([{ imei: "222222222222222", receivedAt: new Date(ancient.now() - 90 * 24 * 3600e3).toISOString() }]);
  assert.equal(ancient.notifications.length, 0);
});

test("state persists across restarts (no duplicate baseline or offline alerts)", async () => {
  let saved = null;
  const persistence = { load: () => saved, save: (obj) => (saved = JSON.parse(JSON.stringify(obj))) };
  const first = harness({ persistence });
  await first.fixAt(50);
  first.advance(4 * 3600e3);
  await first.engine.sweepOffline([{ imei: "111111111111111", receivedAt: new Date(first.now() - 4 * 3600e3).toISOString() }]);
  first.engine.flush();
  assert.ok(saved["111111111111111"].zoneState === "inside");

  const second = harness({ persistence });
  await second.fixAt(500);
  await second.fixAt(500);
  assert.deepEqual(second.notifications.map((n) => n.type), ["zone_exit"], "restored 'inside' state turns the first outside fixes into an exit");
  await second.engine.sweepOffline([{ imei: "111111111111111", receivedAt: new Date(second.now() - 5 * 3600e3).toISOString() }]);
});

test("push text exists in en/el/ru and falls back to English", () => {
  for (const lang of ["en", "el", "ru"]) {
    for (const type of ["zone_exit", "zone_enter", "battery_low", "sos", "offline"]) {
      const { title, body } = buildPushText(type, lang, { pet: "Rex", radius: 200, battery: 15, hours: 4 });
      assert.ok(title && body, `${lang}/${type}`);
      assert.ok(!/\{\w+\}/.test(`${title} ${body}`), `unfilled placeholder in ${lang}/${type}`);
    }
  }
  assert.equal(buildPushText("sos", "fr", { pet: "Rex" }).title, buildPushText("sos", "en", { pet: "Rex" }).title);
});

test("parseZone / parsePrefs validate stored docs", () => {
  assert.equal(parseZone({ lat: "x", lng: 1, radiusM: 100 }), null);
  assert.equal(parseZone({ lat: 1, lng: 1, radiusM: 0 }), null);
  assert.deepEqual(parseZone({ lat: 1, lng: 2, radiusM: 150 }), { enabled: true, lat: 1, lng: 2, radiusM: 150, notifyExit: true, notifyEnter: true });
  assert.equal(parseZone({ lat: 1, lng: 2, radiusM: 150, enabled: false }).enabled, false);
  assert.deepEqual(parsePrefs(null), { push: true, zone: true, battery: true, sos: true, offline: true });
  assert.equal(parsePrefs({ sos: false }).sos, false);
});

test("startAlerts wraps store.upsert and never breaks ingest", async () => {
  const seen = [];
  const store = {
    upsert: (imei, data) => { seen.push(imei); return "ok"; },
    get: () => { throw new Error("boom"); },
    list: () => [],
  };
  const gateway = { resolve: async () => null, addNotification: async () => {}, sendPush: async () => {} };
  const handle = startAlerts({ store, gateway, logger: { log() {}, warn() {} }, env: { ALERTS_STATE_PATH: "/tmp/petpal-alerts-test-state.json" } });
  assert.equal(store.upsert("1", { a: 1 }), "ok");
  assert.deepEqual(seen, ["1"]);
  handle.stop();
  assert.equal(startAlerts({ store, env: { ALERTS_ENABLED: "0" }, logger: { log() {}, warn() {} } }), null);
});
