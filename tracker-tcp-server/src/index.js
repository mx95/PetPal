const express = require("express");

const { createMemoryStore } = require("./store/memory");
const { createTcpServer } = require("./tcp/handler");

const TCP_PORT = Number(process.env.TCP_PORT || 5001);
const HTTP_PORT = Number(process.env.HTTP_PORT || 5002);

const store = createMemoryStore();

createTcpServer({ port: TCP_PORT, store });

const app = express();

app.get("/devices", (req, res) => {
  res.json(store.list());
});

app.get("/devices/:imei", (req, res) => {
  const d = store.get(req.params.imei);
  if (!d) return res.status(404).json({ error: "not_found" });
  res.json(d);
});

app.listen(HTTP_PORT, () => {
  console.log(`HTTP API listening on port ${HTTP_PORT}`);
  console.log(`- GET http://localhost:${HTTP_PORT}/devices`);
  console.log(`- GET http://localhost:${HTTP_PORT}/devices/:imei`);
});

