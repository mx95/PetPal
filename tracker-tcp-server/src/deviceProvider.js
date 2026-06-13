/** Infer tracker protocol from stored device fields (TCP ingest or cloud sync). */
function inferDeviceProvider(d) {
  if (!d || typeof d !== "object") return null;
  if (d.provider === "g365" || d.provider === "gpspos") return d.provider;
  if (d.gpspos && typeof d.gpspos === "object") return "gpspos";
  if (d.protocol != null && Number.isFinite(Number(d.protocol))) return "g365";
  const raw = String(d.raw || d.rawHex || d.received || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (raw.startsWith("7878")) return "g365";
  return null;
}

/** Admin override wins; otherwise infer from last ingest. */
function effectiveProvider(d, providerOverride) {
  const o = providerOverride != null ? String(providerOverride).trim().toLowerCase() : "";
  if (o === "g365" || o === "gpspos") return o;
  return inferDeviceProvider(d);
}

module.exports = { inferDeviceProvider, effectiveProvider };
