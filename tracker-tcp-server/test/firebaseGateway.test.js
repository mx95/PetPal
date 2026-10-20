const test = require("node:test");
const assert = require("node:assert/strict");
const { createFirebaseGateway } = require("../src/alerts/firebaseGateway");

function fakeAdmin({ tokens, sendResults }) {
  const added = [];
  const deleted = [];
  const sent = [];
  const tokenDocs = tokens.map((t, i) => ({
    data: () => t,
    ref: { delete: async () => deleted.push(i) },
  }));
  const userDoc = {
    collection: (name) => ({
      add: async (doc) => added.push({ name, doc }),
      get: async () => ({ empty: tokenDocs.length === 0, docs: tokenDocs }),
      doc: (id) => ({
        get: async () => {
          if (name === "pets") return { exists: true, data: () => ({ name: "Rex" }) };
          if (name === "safeZones") return { exists: true, data: () => ({ lat: 34.7, lng: 33, radiusM: 150 }) };
          return { exists: false, data: () => undefined };
        },
      }),
    }),
  };
  const db = {
    collection: (name) => {
      if (name === "trackerImeiIndex") {
        return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ uid: "u1", petId: "p1", petName: "Rexy" }) }) }) };
      }
      return { doc: () => userDoc };
    },
  };
  const firestore = () => db;
  firestore.FieldValue = { serverTimestamp: () => "TS" };
  return {
    added,
    deleted,
    sent,
    admin: {
      firestore,
      messaging: () => ({
        sendEach: async (messages) => {
          sent.push(messages);
          return { responses: messages.map((_, i) => sendResults[i] || { success: true }) };
        },
      }),
    },
  };
}

const quiet = { log() {}, warn() {} };

test("resolve merges pet, zone and default prefs, and caches", async () => {
  const fake = fakeAdmin({ tokens: [], sendResults: [] });
  const gateway = createFirebaseGateway({ admin: fake.admin, logger: quiet });
  const ctx = await gateway.resolve("111111111111111");
  assert.equal(ctx.uid, "u1");
  assert.equal(ctx.petName, "Rex");
  assert.equal(ctx.zone.radiusM, 150);
  assert.equal(ctx.prefs.push, true);
  assert.equal(await gateway.resolve("111111111111111"), ctx);
});

test("addNotification stores type/params unread", async () => {
  const fake = fakeAdmin({ tokens: [], sendResults: [] });
  const gateway = createFirebaseGateway({ admin: fake.admin, logger: quiet });
  await gateway.addNotification("u1", { type: "sos", imei: "1", petId: "p1", petName: "Rex", params: { pet: "Rex" }, lat: 1, lng: 2 });
  assert.equal(fake.added[0].name, "notifications");
  assert.equal(fake.added[0].doc.read, false);
  assert.equal(fake.added[0].doc.createdAt, "TS");
});

test("sendPush localises per token and prunes dead tokens", async () => {
  const fake = fakeAdmin({
    tokens: [{ token: "a", lang: "el" }, { token: "b", lang: "ru" }, { token: "c", lang: "xx" }],
    sendResults: [{ success: true }],
  });
  const gateway = createFirebaseGateway({ admin: fake.admin, logger: quiet });
  await gateway.sendPush("u1", { type: "sos", petId: "p1", params: { pet: "Rex" } });
  assert.equal(fake.sent.length, 3);
  const titles = fake.sent.map((batch) => batch[0].data.title);
  assert.notEqual(titles[0], titles[2]);
  assert.match(fake.sent[0][0].data.link, /\/tracking$/);

  const dead = fakeAdmin({
    tokens: [{ token: "a", lang: "en" }, { token: "b", lang: "en" }],
    sendResults: [{ success: false, error: { code: "messaging/registration-token-not-registered" } }, { success: true }],
  });
  const g2 = createFirebaseGateway({ admin: dead.admin, logger: quiet });
  await g2.sendPush("u1", { type: "sos", petId: "p1", params: { pet: "Rex" } });
  assert.deepEqual(dead.deleted, [0]);
});
