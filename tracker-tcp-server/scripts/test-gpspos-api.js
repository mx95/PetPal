const { GpsposClient, buildGpsposUrl, parseJsonpBody } = require("../src/protocol/gpspos");

const BASES = [
  "http://www.gpspos.net/Interface/AppJson.asp",
  "https://www.gpspos.net/Interface/AppJson.asp",
  "http://gpspos.net/Interface/AppJson.asp",
  "https://gpspos.net/Interface/AppJson.asp",
];

async function probe(base) {
  const url = buildGpsposUrl(base, "Proc_Login", ["Sotiris", "1234"]);
  const res = await fetch(url, { headers: { Accept: "*/*" } });
  const text = await res.text();
  return { status: res.status, base, preview: text.slice(0, 200) };
}

async function main() {
  for (const base of BASES) {
    try {
      const r = await probe(base);
      console.log(r.status, r.base);
      console.log(r.preview.replace(/\s+/g, " "));
      console.log("---");
    } catch (e) {
      console.log("ERR", base, e.message);
    }
  }

  const client = new GpsposClient({
    baseUrl: "https://www.gpspos.net/Interface/AppJson.asp",
    user: "Sotiris",
    password: "1234",
  });
  try {
    await client.login();
    const pos = await client.getLastPosition("9705242899");
    console.log("HTTPS login+position ok, records:", pos.records.length);
    if (pos.records[0]) console.log(pos.records[0]);
  } catch (e) {
    console.log("HTTPS client failed:", e.message);
    client.baseUrl = "http://www.gpspos.net/Interface/AppJson.asp";
    client.loggedIn = false;
    await client.login();
    const pos = await client.getLastPosition("9705242899");
    console.log("HTTP login+position ok, records:", pos.records.length);
    if (pos.records[0]) console.log(pos.records[0]);
  }
}

main().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
