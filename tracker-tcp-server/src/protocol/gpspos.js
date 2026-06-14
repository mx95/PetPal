/**
 * gpspos.net JSONP platform API (AppJson.asp).
 * See docs/GPSPOS_SETUP.md and vendor doc "API Interface File-Location".
 */
const { isPlausibleLatLng } = require("../geo/coords");

const DEFAULT_BASE_URL = "https://www.gpspos.net/AppJson.asp";

function encodeDataParam(parts) {
  return parts
    .map((part) => {
      const value = String(part ?? "").replace(/'/g, "''");
      return `N'${value}'`;
    })
    .join(",");
}

function buildGpsposUrl(baseUrl, cmd, dataParts, { field = "", callback = "JsonP_cb" } = {}) {
  const url = new URL(String(baseUrl || DEFAULT_BASE_URL));
  url.searchParams.set("Cmd", String(cmd));
  url.searchParams.set("Data", encodeDataParam(Array.isArray(dataParts) ? dataParts : [dataParts]));
  url.searchParams.set("Field", field);
  url.searchParams.set("Callback", callback);
  return url.toString();
}

function parseJsonpBody(text) {
  const trimmed = String(text || "").trim();
  const open = trimmed.indexOf("(");
  const close = trimmed.lastIndexOf(")");
  if (open < 0 || close <= open) {
    throw new Error("invalid_jsonp");
  }
  return JSON.parse(trimmed.slice(open + 1, close));
}

function recordToObject(fields, row) {
  const out = {};
  if (!Array.isArray(fields) || !Array.isArray(row)) return out;
  fields.forEach((field, index) => {
    out[String(field)] = row[index];
  });
  return out;
}

function parseGpsposResponse(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("invalid_response");
  }
  const ok = Number(payload.m_isResultOk) === 1;
  const fields = Array.isArray(payload.m_arrField) ? payload.m_arrField.map(String) : [];
  const rows = Array.isArray(payload.m_arrRecord) ? payload.m_arrRecord : [];
  const records = rows.map((row) => recordToObject(fields, row));
  return { ok, fields, records, raw: payload };
}

function inferSourceFromTeState(nTEState) {
  if (!Number.isFinite(nTEState)) return "gps";
  const byte2 = (nTEState >> 8) & 0xff;
  if (byte2 & 0x20) return "lbs";
  if (byte2 & 0x10) return "wifi";
  return "gps";
}

function batteryFromTeState(nTEState) {
  if (!Number.isFinite(nTEState)) return null;
  const byte3 = (nTEState >> 16) & 0xff;
  return byte3 >= 0 && byte3 <= 100 ? byte3 : null;
}

/** GPSPOS API: nTEState byte2 bit6 (0x4000) = external power / charger connected. */
function chargingFromTeState(nTEState) {
  if (!Number.isFinite(nTEState)) return null;
  return (nTEState & 0x4000) !== 0;
}

/** True when gpspos platform reports GPRS/cellular link (may differ from last GPS fix time). */
function inferGpsposPlatformOnline(nTEState, gsmSignal) {
  if (!Number.isFinite(nTEState)) return null;
  const gprsConnected = (nTEState & 0x10) !== 0;
  const gsm = Number(gsmSignal);
  const strongGsm = Number.isFinite(gsm) && gsm > 6;
  return gprsConnected || strongGsm;
}

function unixSecondsToIso(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

/**
 * Map Proc_GetLastPosition / Proc_GetTrack row to PetPal store shape.
 * @param {object} rec parsed field map from platform
 * @param {{ imei?: string, receivedAt?: string, recordPosition?: boolean }} [opts]
 */
function mapGpsposPositionToDeviceRecord(rec, opts = {}) {
  const platformImei = String(rec.strTEID || rec.strDeviceID || "").trim();
  const imei = String(opts.imei || platformImei || "").trim();
  const nTime = Number(rec.nTime);
  const lat = Number(rec.dbLat);
  const lng = Number(rec.dbLon);
  const nTEState = Number(rec.nTEState);
  const hasCoords = isPlausibleLatLng(lat, lng);
  const flagInvalid = Number.isFinite(nTEState) && (nTEState & 0x80) !== 0;
  // Platform may set 0x80 while still returning usable LBS coordinates — prefer coords when plausible.
  const locationInvalid = !hasCoords && flagInvalid;
  const deviceTime = unixSecondsToIso(nTime);
  const receivedAt = opts.receivedAt || new Date().toISOString();
  const source = hasCoords ? (Number(rec.nGPSSignal) > 0 ? "gps" : "lbs") : null;
  const platformOnline = inferGpsposPlatformOnline(nTEState, rec.nGSMSignal);

  const record = {
    imei,
    provider: "gpspos",
    receivedAt,
    lastUpdate: deviceTime || receivedAt,
    source: hasCoords ? source || "gps" : source,
    gpsValid: hasCoords && source === "gps",
    platformOnline: platformOnline === true,
    location: hasCoords ? { lat, lng } : null,
    gps: hasCoords
      ? {
          lat,
          lng,
          speedKmh: Number.isFinite(Number(rec.nSpeed)) ? Number(rec.nSpeed) : null,
          timestamp: deviceTime,
          heading: Number.isFinite(Number(rec.nDirection)) ? Number(rec.nDirection) : null,
        }
      : null,
    signal: Number.isFinite(Number(rec.nGSMSignal)) ? Number(rec.nGSMSignal) : null,
    satellites: Number.isFinite(Number(rec.nGPSSignal)) ? Number(rec.nGPSSignal) : null,
    speed: Number.isFinite(Number(rec.nSpeed)) ? Number(rec.nSpeed) : null,
    heading: Number.isFinite(Number(rec.nDirection)) ? Number(rec.nDirection) : null,
    moving: Number(rec.nSpeed) > 0,
    battery: batteryFromTeState(nTEState),
    charging: chargingFromTeState(nTEState),
    gpspos: {
      platformImei,
      nTime: Number.isFinite(nTime) ? nTime : null,
      nTEState: Number.isFinite(nTEState) ? nTEState : null,
      nCarState: rec.nCarState ?? null,
      nAlarmState: rec.nAlarmState ?? null,
      nMileage: rec.nMileage ?? null,
    },
    raw: { gpspos: rec },
  };

  if (opts.recordPosition !== undefined) {
    record._recordPosition = Boolean(opts.recordPosition);
  }

  return record;
}

function resolvePlatformImei(requestedImei, mapping = {}) {
  const key = String(requestedImei || "").trim();
  if (!key) return "";
  if (mapping[key]) return String(mapping[key]).trim();
  return key;
}

function resolveStoreImei(platformImei, mapping = {}) {
  const platform = String(platformImei || "").trim();
  for (const [storeImei, mappedPlatform] of Object.entries(mapping)) {
    if (String(mappedPlatform).trim() === platform) return String(storeImei).trim();
  }
  return platform;
}

function shouldRecordPosition(prev, nextRecord) {
  if (!nextRecord.location) return false;
  const nextTime = nextRecord.gpspos?.nTime;
  const prevTime = prev?.gpspos?.nTime;
  if (Number.isFinite(nextTime) && Number.isFinite(prevTime) && nextTime === prevTime) {
    return false;
  }
  return true;
}

class GpsposClient {
  /**
   * @param {{ baseUrl?: string, user?: string|null, password?: string|null, fetchImpl?: typeof fetch }} opts
   */
  constructor(opts = {}) {
    this.baseUrl = String(opts.baseUrl || DEFAULT_BASE_URL).trim();
    this.user = opts.user != null ? String(opts.user).trim() : "";
    this.password = opts.password != null ? String(opts.password).trim() : "";
    this.fetchImpl = opts.fetchImpl || fetch;
    this.cookie = null;
    this.loggedIn = false;
  }

  async requestJsonp(cmd, dataParts, { field = "" } = {}) {
    const url = buildGpsposUrl(this.baseUrl, cmd, dataParts, { field });
    const headers = { Accept: "*/*" };
    if (this.cookie) headers.Cookie = this.cookie;

    const res = await this.fetchImpl(url, { method: "GET", headers });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }
    if (!res.ok) {
      const err = new Error(`gpspos_http_${res.status}`);
      err.status = res.status;
      throw err;
    }

    const payload = parseJsonpBody(await res.text());
    const parsed = parseGpsposResponse(payload);
    if (!parsed.ok) {
      const err = new Error("gpspos_request_failed");
      err.response = parsed.raw;
      throw err;
    }
    return parsed;
  }

  async login() {
    if (!this.user || !this.password) {
      this.loggedIn = true;
      return { ok: true, skipped: true };
    }
    const parsed = await this.requestJsonp("Proc_Login", [this.user, this.password]);
    this.loggedIn = true;
    return parsed;
  }

  async ensureLogin() {
    if (this.loggedIn) return;
    await this.login();
  }

  async getLastPosition(platformImei) {
    await this.ensureLogin();
    return this.requestJsonp("Proc_GetLastPosition", [platformImei]);
  }

  async getCarInfo(platformImei) {
    await this.ensureLogin();
    return this.requestJsonp("Proc_GetCarInfo", [platformImei]);
  }

  async getTrack(platformImei, fromUnix, toUnix, maxRows = 5000) {
    await this.ensureLogin();
    return this.requestJsonp("Proc_GetTrack", [platformImei, fromUnix, toUnix, maxRows]);
  }
}

function createGpsposClientFromEnv(env = process.env) {
  const enabled =
    String(env.GPSPOS_ENABLED ?? "0").trim() !== "0" &&
    String(env.GPSPOS_ENABLED ?? "0").trim().toLowerCase() !== "false";
  if (!enabled) return null;

  return new GpsposClient({
    baseUrl: env.GPSPOS_API_URL || env.GPSPOS_BASE_URL || DEFAULT_BASE_URL,
    user: env.GPSPOS_USER || env.GPSPOS_USERNAME || "",
    password: env.GPSPOS_PASSWORD || env.GPSPOS_PASS || "",
  });
}

function parseImeiMap(raw) {
  const out = {};
  for (const part of String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const [storeImei, platformImei] = part.split(":").map((s) => s.trim());
    if (storeImei && platformImei) out[storeImei] = platformImei;
  }
  return out;
}

function parseDeviceIdList(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  DEFAULT_BASE_URL,
  GpsposClient,
  buildGpsposUrl,
  encodeDataParam,
  parseJsonpBody,
  parseGpsposResponse,
  recordToObject,
  mapGpsposPositionToDeviceRecord,
  inferSourceFromTeState,
  inferGpsposPlatformOnline,
  batteryFromTeState,
  chargingFromTeState,
  resolvePlatformImei,
  resolveStoreImei,
  shouldRecordPosition,
  createGpsposClientFromEnv,
  parseImeiMap,
  parseDeviceIdList,
};
