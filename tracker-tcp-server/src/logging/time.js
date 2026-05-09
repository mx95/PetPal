function pad2(n) {
  return String(n).padStart(2, "0");
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

/**
 * Format a timestamp in Cyprus local time (Europe/Nicosia).
 * Output example: 2026-05-09 14:28:12.345 EEST
 */
function formatCyprusTime(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Nicosia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).formatToParts(d);

  const map = Object.create(null);
  for (const p of parts) map[p.type] = p.value;
  const ms = d.getMilliseconds();
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}.${pad3(ms)} ${map.timeZoneName}`;
}

function logPrefix({ dir, tag = "TCP", at = new Date() }) {
  const cy = formatCyprusTime(at);
  const direction =
    dir === "in"
      ? "DEVICE → SERVER"
      : dir === "out"
        ? "SERVER → DEVICE"
        : dir === "http_in"
          ? "HTTP → SERVER"
          : dir === "http_out"
            ? "SERVER → HTTP"
            : "—";
  return `[${cy}] [${tag}] [${direction}]`;
}

module.exports = { formatCyprusTime, logPrefix };

