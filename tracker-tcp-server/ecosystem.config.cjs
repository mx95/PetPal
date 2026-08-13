/**
 * PM2 example — use a fixed DB path so restarts never create a new empty database.
 *
 *   cd ~/PetPal/tracker-tcp-server
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * GPS history is stored OUTSIDE the git repo (/var/lib/petpal) so deploy git reset
 * cannot overwrite the live database.
 */
const fs = require("fs");
const path = require("path");

const serverRoot = __dirname;
const dbFile = process.env.PETPAL_TRACKER_DB || "/var/lib/petpal/petpal.sqlite";
const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

/** Server-only secrets (outside git): TRACKER_ADMIN_TOKEN, etc. */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const adminEnvFile = process.env.PETPAL_ADMIN_ENV || "/var/lib/petpal/tracker-admin.env";
const adminEnv = loadEnvFile(adminEnvFile);

module.exports = {
  apps: [
    {
      name: "tracker",
      cwd: serverRoot,
      script: "src/index.js",
      env: {
        PERSIST_TO_SQLITE: "1",
        SQLITE_PATH: dbFile,
        TCP_PORT: "5001",
        GPS365_TCP_PORT: "5003",
        GPS365_TCP_ENABLED: "1",
        GT06_TCP_PORT: "5004",
        GT06_TCP_ENABLED: "1",
        HTTP_PORT: "5002",
        GPSPOS_ENABLED: "1",
        GPSPOS_API_URL: "https://www.gpspos.net/AppJson.asp",
        GPSPOS_USER: "Sotiris",
        GPSPOS_PASSWORD: "1234",
        GPSPOS_DEVICE_IDS: "861397052428990,868022030670736,868022030670793",
        GPSPOS_IMEI_MAP: "861397052428990:9705242899",
        GPSPOS_POLL_INTERVAL_SEC: "60",
        ...adminEnv,
      },
    },
  ],
};
