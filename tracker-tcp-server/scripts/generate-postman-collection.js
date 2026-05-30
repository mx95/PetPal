const fs = require("fs");
const path = require("path");

const jsonHeaders = [{ key: "Accept", value: "application/json" }];
const postHeaders = [
  { key: "Content-Type", value: "application/json" },
  { key: "Accept", value: "application/json" }
];

function get(urlPath, name, query) {
  const item = {
    name,
    request: {
      method: "GET",
      header: jsonHeaders,
      url: {
        raw: "{{baseUrl}}" + urlPath,
        host: ["{{baseUrl}}"],
        path: urlPath.replace(/^\//, "").split("/")
      }
    }
  };
  if (query) {
    item.request.url.query = query;
    item.request.url.raw += "?" + query.map((q) => `${q.key}=${q.value}`).join("&");
  }
  return item;
}

function post(urlPath, name, body) {
  return {
    name,
    request: {
      method: "POST",
      header: postHeaders,
      body: { mode: "raw", raw: body },
      url: {
        raw: "{{baseUrl}}" + urlPath,
        host: ["{{baseUrl}}"],
        path: urlPath.replace(/^\//, "").split("/")
      }
    }
  };
}

function xexunFolder(prefix, label) {
  const base = "/" + prefix;
  return {
    name: label,
    description:
      prefix === "commands"
        ? "Queued on next Xexun TCP uplink (port {{xexunTcpPort}}). Same handlers at /api/tracker/commands/*."
        : "Mirror of /commands/* — identical request bodies.",
    item: [
      get(`${base}/pending/{{imei}}`, `GET ${base}/pending/:imei`),
      post(
        `${base}/queue`,
        `POST ${base}/queue (raw)`,
        JSON.stringify({ imei: "{{imei}}", command: "ip={{deviceHostOrDomain}}:{{xexunTcpPort}}" }, null, 2)
      ),
      post(
        `${base}/ip-transfer`,
        `POST ${base}/ip-transfer`,
        JSON.stringify({ imei: "{{imei}}", host: "{{deviceHostOrDomain}}", port: "{{xexunTcpPort}}" }, null, 2).replace(
          '"{{xexunTcpPort}}"',
          "{{xexunTcpPort}}"
        )
      ),
      post(`${base}/ip/query`, `POST ${base}/ip/query`, JSON.stringify({ imei: "{{imei}}" }, null, 2)),
      post(`${base}/apn`, `POST ${base}/apn`, JSON.stringify({ imei: "{{imei}}", apn: "{{apn}}" }, null, 2)),
      post(
        `${base}/tracking`,
        `POST ${base}/tracking (tk string)`,
        JSON.stringify({ imei: "{{imei}}", tk: "2,60,2,3600,0,0,20" }, null, 2)
      ),
      post(
        `${base}/tracking`,
        `POST ${base}/tracking (p1-p7)`,
        JSON.stringify({ imei: "{{imei}}", p1: 2, p2: 60, p3: 2, p4: 3600, p5: 0, p6: 0, p7: 20 }, null, 2)
      ),
      post(`${base}/tracking/query`, `POST ${base}/tracking/query`, JSON.stringify({ imei: "{{imei}}" }, null, 2)),
      post(`${base}/power-off`, `POST ${base}/power-off`, JSON.stringify({ imei: "{{imei}}" }, null, 2)),
      post(`${base}/restart`, `POST ${base}/restart`, JSON.stringify({ imei: "{{imei}}" }, null, 2)),
      post(
        `${base}/message`,
        `POST ${base}/message`,
        JSON.stringify({ imei: "{{imei}}", text: "{{messageText}}" }, null, 2)
      ),
      post(`${base}/timezone`, `POST ${base}/timezone`, JSON.stringify({ imei: "{{imei}}", tz: "{{tz}}" }, null, 2)),
      post(`${base}/timezone/query`, `POST ${base}/timezone/query`, JSON.stringify({ imei: "{{imei}}" }, null, 2)),
      post(
        `${base}/ble`,
        `POST ${base}/ble (set BSSIDs)`,
        JSON.stringify({ imei: "{{imei}}", bssid_list: ["aa:bb:cc:dd:ee:ff"] }, null, 2)
      ),
      post(`${base}/ble`, `POST ${base}/ble (query)`, JSON.stringify({ imei: "{{imei}}", query: true }, null, 2)),
      post(`${base}/ble`, `POST ${base}/ble (clear)`, JSON.stringify({ imei: "{{imei}}", clear: true }, null, 2)),
      post(
        `${base}/wifi`,
        `POST ${base}/wifi (set BSSIDs)`,
        JSON.stringify({ imei: "{{imei}}", bssid_list: ["aa:bb:cc:dd:ee:ff"] }, null, 2)
      ),
      post(`${base}/wifi`, `POST ${base}/wifi (query)`, JSON.stringify({ imei: "{{imei}}", query: true }, null, 2)),
      post(`${base}/wifi`, `POST ${base}/wifi (clear)`, JSON.stringify({ imei: "{{imei}}", clear: true }, null, 2))
    ]
  };
}

const g365 = {
  name: "365GPS Commands — /api/g365",
  description:
    "Immediate binary frames on active 365GPS TCP session (port {{g365TcpPort}}). See docs/G365_PROTOCOL.md.",
  item: [
    get("/api/g365", "GET /api/g365 (discovery)"),
    post(
      "/api/g365/commands/server-redirect",
      "POST server-redirect (0x66)",
      JSON.stringify({ imei: "{{imei}}", host: "{{deviceHostOrDomain}}", port: "{{g365TcpPort}}" }, null, 2).replace(
        '"{{g365TcpPort}}"',
        "{{g365TcpPort}}"
      )
    ),
    post(
      "/api/g365/commands/manual-position",
      "POST manual-position GPS (0x80)",
      JSON.stringify({ imei: "{{imei}}", mode: "gps" }, null, 2)
    ),
    post(
      "/api/g365/commands/manual-position",
      "POST manual-position WiFi (0x80)",
      JSON.stringify({ imei: "{{imei}}", mode: "wifi" }, null, 2)
    ),
    post(
      "/api/g365/commands/upload-interval",
      "POST upload-interval (0x97)",
      JSON.stringify({ imei: "{{imei}}", seconds: 60 }, null, 2)
    ),
    post(
      "/api/g365/commands/status-interval",
      "POST status-interval (0x13)",
      JSON.stringify({ imei: "{{imei}}", minutes: 30 }, null, 2)
    ),
    post(
      "/api/g365/commands/heartbeat-interval",
      "POST heartbeat-interval (0x13)",
      JSON.stringify({ imei: "{{imei}}", seconds: 300 }, null, 2)
    ),
    post(
      "/api/g365/commands/prohibit-lbs",
      "POST prohibit-lbs on (0x33)",
      JSON.stringify({ imei: "{{imei}}", enabled: true }, null, 2)
    ),
    post(
      "/api/g365/commands/prohibit-lbs",
      "POST prohibit-lbs off (0x33)",
      JSON.stringify({ imei: "{{imei}}", enabled: false }, null, 2)
    ),
    post(
      "/api/g365/commands/power",
      "POST power restart (0x48)",
      JSON.stringify({ imei: "{{imei}}", operation: "restart" }, null, 2)
    ),
    post(
      "/api/g365/commands/power",
      "POST power shutdown (0x48)",
      JSON.stringify({ imei: "{{imei}}", operation: "shutdown" }, null, 2)
    ),
    post(
      "/api/g365/commands/find",
      "POST find start (0x49)",
      JSON.stringify({ imei: "{{imei}}", start: true }, null, 2)
    ),
    post(
      "/api/g365/commands/find",
      "POST find stop (0x49)",
      JSON.stringify({ imei: "{{imei}}", start: false }, null, 2)
    ),
    post(
      "/api/g365/commands/overspeed",
      "POST overspeed (0x86)",
      JSON.stringify({ imei: "{{imei}}", kmh: 80 }, null, 2)
    ),
    post(
      "/api/g365/commands/phone",
      "POST phone SOS (0x41)",
      JSON.stringify({ imei: "{{imei}}", role: "sos", number: "+35799123456" }, null, 2)
    ),
    post(
      "/api/g365/commands/expiry-date",
      "POST expiry-date (0x30)",
      JSON.stringify({ imei: "{{imei}}", yyyymmdd: "20271231" }, null, 2)
    ),
    post(
      "/api/g365/commands/raw",
      "POST raw hex frame",
      JSON.stringify({ imei: "{{imei}}", hex: "78780101000100020D0A" }, null, 2)
    )
  ]
};

const collection = {
  info: {
    _postman_id: "f2d7a7a6-8d18-4a3b-9b6f-6f6a0d2b4a31",
    name: "PetPal Tracker API",
    description:
      "HTTP API for tracker-tcp-server. Import PetPal-Tracker-API.postman_environment.json and set host/imei. Full reference: docs/API_REFERENCE.md",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  variable: [
    { key: "host", value: "116.203.209.68" },
    { key: "httpPort", value: "5002" },
    { key: "baseUrl", value: "http://{{host}}:{{httpPort}}" },
    { key: "imei", value: "863235081917526" },
    { key: "xexunTcpPort", value: "5001" },
    { key: "g365TcpPort", value: "5003" },
    { key: "deviceHostOrDomain", value: "116.203.209.68" },
    { key: "historyLimit", value: "15000" },
    { key: "historyFrom", value: "2026-05-30T00:00:00.000Z" },
    { key: "historyTo", value: "2026-05-30T23:59:59.999Z" },
    { key: "homeLat", value: "34.96475" },
    { key: "homeLng", value: "33.12669" },
    { key: "apn", value: "internet" },
    { key: "tz", value: "2" },
    { key: "messageText", value: "Hello from PetPal" }
  ],
  item: [
    {
      name: "Discovery",
      item: [get("/api", "GET /api (Xexun index)"), get("/api/g365", "GET /api/g365 (365GPS index)")]
    },
    {
      name: "App API (PetPal UI)",
      description: "Routes used by the React tracking UI. Data from SQLite.",
      item: [
        get("/api/app/devices", "GET /api/app/devices"),
        get("/api/app/devices/{{imei}}", "GET /api/app/devices/:imei"),
        get("/api/app/position", "GET /api/app/position", [{ key: "deviceId", value: "{{imei}}" }]),
        get("/api/app/history", "GET /api/app/history (latest)", [
          { key: "deviceId", value: "{{imei}}" },
          { key: "limit", value: "100" }
        ]),
        get("/api/app/history", "GET /api/app/history (date range)", [
          { key: "deviceId", value: "{{imei}}" },
          { key: "from", value: "{{historyFrom}}" },
          { key: "to", value: "{{historyTo}}" },
          { key: "limit", value: "{{historyLimit}}" }
        ]),
        post(
          "/api/app/home",
          "POST /api/app/home",
          JSON.stringify({ deviceId: "{{imei}}", lat: "{{homeLat}}", lng: "{{homeLng}}" }, null, 2)
            .replace('"{{homeLat}}"', "{{homeLat}}")
            .replace('"{{homeLng}}"', "{{homeLng}}")
        )
      ]
    },
    {
      name: "Legacy HTTP",
      item: [
        get("/devices", "GET /devices"),
        get("/devices/{{imei}}", "GET /devices/:imei"),
        get("/devices/{{imei}}/status", "GET /devices/:imei/status"),
        get("/position", "GET /position", [{ key: "deviceId", value: "{{imei}}" }])
      ]
    },
    xexunFolder("commands", "Xexun Commands — /commands"),
    xexunFolder("api/tracker/commands", "Xexun Commands — /api/tracker/commands"),
    g365
  ]
};

const out = path.join(__dirname, "../postman/PetPal-Tracker-API.postman_collection.json");
fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log("Wrote", out);
