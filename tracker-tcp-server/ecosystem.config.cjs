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
        HTTP_PORT: "5002",
        GPSPOS_ENABLED: "1",
        GPSPOS_API_URL: "https://www.gpspos.net/AppJson.asp",
        GPSPOS_USER: "Sotiris",
        GPSPOS_PASSWORD: "1234",
        GPSPOS_DEVICE_IDS: "861397052428990",
        GPSPOS_IMEI_MAP: "861397052428990:9705242899",
        GPSPOS_POLL_INTERVAL_SEC: "60",
      },
    },
  ],
};
