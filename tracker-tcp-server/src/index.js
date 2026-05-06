const express = require("express");
const cors = require("cors");

const { createMemoryStore } = require("./store/memory");
const { createTcpServer } = require("./tcp/handler");
const { createTrackerRoutes } = require("./routes/trackerRoutes");
const { createAppRoutes } = require("./routes/appRoutes");

const TCP_PORT = Number(process.env.TCP_PORT || 5001);
const HTTP_PORT = Number(process.env.HTTP_PORT || 5002);

const store = createMemoryStore();

createTcpServer({ port: TCP_PORT, store });

const app = express();
app.use(express.json({ limit: "64kb" }));

function corsOrigin() {
  const raw = process.env.HTTP_CORS_ORIGIN;
  if (!raw || String(raw).trim() === "" || String(raw).trim() === "*") return true;
  const list = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return true;
  return list;
}

app.use(
  cors({
    origin: corsOrigin(),
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use("/api/tracker", createTrackerRoutes(store));
app.use("/api/app", createAppRoutes());

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API listening on port ${HTTP_PORT}`);
  console.log(`- GET  http://localhost:${HTTP_PORT}/api/app/position?deviceId=…`);
  console.log(`- GET  http://localhost:${HTTP_PORT}/api/app/devices`);
  console.log(`- POST http://localhost:${HTTP_PORT}/api/tracker/commands/ip-transfer …`);
});
