/**
 * PM2 example — use a fixed DB path so restarts never create a new empty database.
 *
 *   cd ~/PetPal/tracker-tcp-server
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
const path = require("path");

const serverRoot = __dirname;
const dbFile = path.join(serverRoot, "data", "petpal.sqlite");

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
      },
    },
  ],
};
