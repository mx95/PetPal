function createMemoryStore() {
  const devices = new Map(); // imei -> latest object
  const commandQueues = new Map(); // imei -> string[]
  const seqByImei = new Map();
  const socketsByImei = new Map();

  return {
    upsert(imei, data) {
      if (!imei) return;
      devices.set(String(imei), data);
    },
    list() {
      return Array.from(devices.values());
    },
    get(imei) {
      return devices.get(String(imei)) || null;
    },
    /** Queue a 0x21 command string (e.g. ip=host:port) for the next uplink. */
    enqueueCommand(imei, command, { atFront = false } = {}) {
      const k = String(imei);
      const q = commandQueues.get(k) || [];
      if (atFront) q.unshift(String(command).trim());
      else q.push(String(command).trim());
      commandQueues.set(k, q);
    },
    dequeueCommand(imei) {
      const k = String(imei);
      const q = commandQueues.get(k);
      if (!q || q.length === 0) return null;
      const cmd = q.shift();
      if (q.length === 0) commandQueues.delete(k);
      return cmd;
    },
    pendingCommands(imei) {
      return [...(commandQueues.get(String(imei)) || [])];
    },
    nextSequence(imei) {
      const k = String(imei);
      let n = (seqByImei.get(k) || 0) + 1;
      if (n > 255) n = 1;
      seqByImei.set(k, n);
      return n;
    },
    bindSocket(imei, socket) {
      if (!imei || !socket) return;
      socketsByImei.set(String(imei), socket);
    },
    releaseSocket(socket) {
      for (const [imei, s] of socketsByImei.entries()) {
        if (s === socket) socketsByImei.delete(imei);
      }
    },
    getSocket(imei) {
      return socketsByImei.get(String(imei)) || null;
    }
  };
}

module.exports = { createMemoryStore };

