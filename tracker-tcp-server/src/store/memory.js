function createMemoryStore() {
  const devices = new Map(); // imei -> latest object

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
    }
  };
}

module.exports = { createMemoryStore };

