const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseJsonpBody,
  parseGpsposResponse,
  mapGpsposPositionToDeviceRecord,
  buildGpsposUrl,
  encodeDataParam,
  shouldRecordPosition,
  batteryFromTeState,
} = require("../src/protocol/gpspos");
const { createMemoryStore } = require("../src/store/memory");
const { buildPositionPayload } = require("../src/http/positionPayload");

const SAMPLE_JSONP = `JsonP4({"m_isResultOk":1,"m_arrField":["nID","strTEID","nTime","dbLon","dbLat","nDirection","nSpeed","nGSMSignal","nGPSSignal","nFuel","nMileage","nTemp","nCarState","nTEState","nAlarmState","strOther"],"m_arrRecord":[["1","00012836","1414956901","113.9392","22.5700667","198","0","0","8","0","3056919","0","-1342177280","0","0","null"]]})`;

test("gpspos — parse JSONP last position from vendor doc", () => {
  const payload = parseJsonpBody(SAMPLE_JSONP);
  const parsed = parseGpsposResponse(payload);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].strTEID, "00012836");
  assert.equal(parsed.records[0].dbLat, "22.5700667");
});

test("gpspos — build AppJson.asp URL with N'…' data params", () => {
  const url = buildGpsposUrl("https://www.gpspos.net/AppJson.asp", "Proc_GetLastPosition", ["00012836"]);
  assert.match(url, /Cmd=Proc_GetLastPosition/);
  assert.match(decodeURIComponent(url), /Data=N'00012836'/);
  assert.equal(encodeDataParam(["a", "b"]), "N'a',N'b'");
});

test("gpspos — map position row to store + position API", () => {
  const payload = parseJsonpBody(SAMPLE_JSONP);
  const row = parseGpsposResponse(payload).records[0];
  const store = createMemoryStore();
  const mapped = mapGpsposPositionToDeviceRecord(row, { imei: "00012836", recordPosition: true });
  store.upsert("00012836", mapped);

  const rec = store.get("00012836");
  assert.equal(rec.provider, "gpspos");
  assert.equal(rec.location.lat, 22.5700667);
  assert.equal(rec.location.lng, 113.9392);
  assert.equal(rec.gpspos.nTime, 1414956901);

  const api = buildPositionPayload("00012836", rec);
  assert.equal(api.provider, "gpspos");
  assert.equal(api.lat, 22.5700667);
  assert.equal(api.lng, 113.9392);
});

test("gpspos — invalid location when nTEState bit 0x80 set and no coords", () => {
  const row = {
    strTEID: "00012836",
    nTime: "1414956901",
    dbLon: "0",
    dbLat: "0",
    nTEState: "128",
    nSpeed: "0",
    nGSMSignal: "3",
    nGPSSignal: "0",
  };
  const mapped = mapGpsposPositionToDeviceRecord(row);
  assert.equal(mapped.location, null);
  assert.equal(mapped.gpsValid, false);
});

test("gpspos — keeps plausible coords even when nTEState bit 0x80 set", () => {
  const row = {
    strTEID: "9705242899",
    nTime: "1779265279",
    dbLon: "113.8940648",
    dbLat: "22.5104127",
    nTEState: "3829888",
    nGSMSignal: "67",
    nGPSSignal: "0",
  };
  const mapped = mapGpsposPositionToDeviceRecord(row, { imei: "861397052428990" });
  assert.equal(mapped.location.lat, 22.5104127);
  assert.equal(mapped.source, "lbs");
});

test("gpspos — shouldRecordPosition skips duplicate nTime", () => {
  const row = parseGpsposResponse(parseJsonpBody(SAMPLE_JSONP)).records[0];
  const first = mapGpsposPositionToDeviceRecord(row, { imei: "00012836" });
  const store = createMemoryStore();
  store.upsert("00012836", { ...first, recordPosition: true });
  const prev = store.get("00012836");
  const second = mapGpsposPositionToDeviceRecord(row, { imei: "00012836" });
  assert.equal(shouldRecordPosition(prev, second), false);
});

test("gpspos — shouldRecordPosition records LBS fixes with new nTime", () => {
  const prev = mapGpsposPositionToDeviceRecord({
    strTEID: "868022030670736",
    nTime: "1781095962",
    dbLon: "33.37",
    dbLat: "35.15",
    nTEState: "4341888",
    nGSMSignal: "31",
    nGPSSignal: "0",
  });
  const next = mapGpsposPositionToDeviceRecord({
    strTEID: "868022030670736",
    nTime: "1781096000",
    dbLon: "33.38",
    dbLat: "35.16",
    nTEState: "4341888",
    nGSMSignal: "31",
    nGPSSignal: "0",
  });
  assert.equal(next.gpsValid, false);
  assert.equal(shouldRecordPosition(prev, next), true);
});

test("gpspos — platform online from GPRS / GSM signal", () => {
  const { inferGpsposPlatformOnline } = require("../src/protocol/gpspos");
  assert.equal(inferGpsposPlatformOnline(4341888, 31), true);
  assert.equal(inferGpsposPlatformOnline(0, 2), false);
});

test("gpspos — battery byte from nTEState", () => {
  assert.equal(batteryFromTeState(0x00550000), 85);
  assert.equal(batteryFromTeState(0x00ff0000), null);
});

test("gpspos — wifi source from nTEState byte2 bit 0x10", () => {
  const row = {
    strTEID: "868022030670736",
    nTime: "1781096000",
    dbLon: "33.38",
    dbLat: "35.16",
    nTEState: "4096",
    nGSMSignal: "31",
    nGPSSignal: "0",
  };
  const mapped = mapGpsposPositionToDeviceRecord(row);
  assert.equal(mapped.source, "wifi");
  assert.equal(mapped.accuracy, "wifi");
  assert.equal(mapped.gpsValid, false);
});

test("gpspos — charging not inferred from nTEState (cloud API unreliable)", () => {
  const { chargingFromTeState } = require("../src/protocol/gpspos");
  assert.equal(chargingFromTeState(4341888), null);
  assert.equal(chargingFromTeState(0x4000), null);
  assert.equal(chargingFromTeState(0), null);
  assert.equal(chargingFromTeState(Number.NaN), null);
});
