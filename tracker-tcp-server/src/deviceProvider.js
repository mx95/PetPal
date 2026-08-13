const KNOWN_PROVIDERS = new Set(["g365", "gpspos", "gt06", "xexun"]);

/** Infer tracker protocol from stored device fields (TCP ingest or cloud sync). */
function inferDeviceProvider(d) {
  if (!d || typeof d !== "object") return null;
  if (KNOWN_PROVIDERS.has(d.provider)) return d.provider;
  if (d.gpspos && typeof d.gpspos === "object") return "gpspos";
  // GT06 location/status protocol numbers differ from 365GPS (0x10/0x11 GPS).
  const proto = d.protocol != null ? Number(d.protocol) : NaN;
  if (proto === 0x12 || proto === 0x13 || proto === 0x16) return "gt06";
  if (Number.isFinite(proto)) return "g365";
  const raw = String(d.raw || d.rawHex || d.received || "")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (raw.startsWith("7878")) return "g365";
  if (raw.startsWith("FC")) return "xexun";
  return null;
}

/** Admin override wins; otherwise infer from last ingest. */
function effectiveProvider(d, providerOverride) {
  const o = providerOverride != null ? String(providerOverride).trim().toLowerCase() : "";
  if (KNOWN_PROVIDERS.has(o)) return o;
  return inferDeviceProvider(d);
}

module.exports = { inferDeviceProvider, effectiveProvider };
