const express = require("express");
const cors = require("cors");
const path = require("path");

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
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

app.use(
  cors({
    origin: corsOrigin(),
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

//
// ✅ 1. API ROUTES FIRST
//
app.use("/api/tracker", createTrackerRoutes(store));
app.use("/api/app", createAppRoutes());

//
// ✅ 2. STATIC FILES
//
app.use(express.static('/root/PetPal/petpal/build'));

//
// ✅ 3. SAFE FALLBACK (NO "*")
// 
app.use((req, res) => {
  res.sendFile(path.resolve('/root/PetPal/petpal/build/index.html'));
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API listening on port ${HTTP_PORT}`);
});
