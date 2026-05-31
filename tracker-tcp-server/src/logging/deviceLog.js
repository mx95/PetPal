const { logPrefix } = require("./time");

/** @readonly */
const DEVICE = {
  XEXUN: "Xexun",
  G365: "365GPS",
};

const DEVICE_META = {
  [DEVICE.XEXUN]: {
    tag: "Xexun",
    portEnv: "TCP_PORT",
    defaultPort: 5001,
    frameHint: "FC…CF",
    label: "Xexun collar (FC…CF frames, port 5001)",
  },
  [DEVICE.G365]: {
    tag: "365GPS",
    portEnv: "GPS365_TCP_PORT",
    defaultPort: 5003,
    frameHint: "7878…0D0A",
    label: "365GPS collar (7878…0D0A frames, port 5003)",
  },
};

function deviceTag(type) {
  return DEVICE_META[type]?.tag || String(type);
}

function logListenerReady(type, port) {
  const meta = DEVICE_META[type];
  console.log(
    `[listen] ${meta.label} — TCP port ${port} (env ${meta.portEnv}, frames ${meta.frameHint})`
  );
}

function logDeviceConnect(type, socket, port) {
  const meta = DEVICE_META[type];
  console.log(
    `${logPrefix({ dir: "in", tag: meta.tag })} NEW CONNECTION ${meta.tag} ` +
      `from ${socket.remoteAddress}:${socket.remotePort} (listener port ${port})`
  );
}

function logDeviceIdentified(type, { imei, message, port }) {
  const meta = DEVICE_META[type];
  const imeiPart = imei ? ` imei=${imei}` : "";
  const msgPart = message ? ` ${message}` : "";
  console.log(
    `${logPrefix({ dir: "in", tag: meta.tag })} DEVICE TYPE=${meta.tag}${imeiPart}${msgPart} (port ${port})`
  );
}

module.exports = {
  DEVICE,
  DEVICE_META,
  deviceTag,
  logListenerReady,
  logDeviceConnect,
  logDeviceIdentified,
};
