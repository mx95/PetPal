#!/usr/bin/env node
/**
 * One-shot: invoke bootstrapLiveJccCredentials after it is deployed.
 * Usage: node scripts/invoke-jcc-live-bootstrap.mjs
 * Remove this script (and the callable) after a successful run.
 */
const TOKEN = process.env.JCC_BOOTSTRAP_TOKEN || '4e8cfad6836c4d3dee8bca8a3f84c3750f4e1f9c7e864bc7';
const URL =
  process.env.JCC_BOOTSTRAP_URL ||
  'https://europe-west1-petpal-aecda.cloudfunctions.net/bootstrapLiveJccCredentials';

const payload = {
  token: TOKEN,
  user: process.env.JCC_LIVE_USER || '0054705017_powareltd-api',
  pass: process.env.JCC_LIVE_PASS || 'H.gkBvH8wmpc',
  restBase: process.env.JCC_LIVE_REST_BASE || 'https://gateway.jcc.com.cy/payment/rest',
};

async function main() {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  // Never print password
  console.log(
    JSON.stringify(
      {
        http: res.status,
        result: json?.result || json,
        error: json?.error || null,
      },
      null,
      2
    )
  );
  if (!res.ok || json?.error) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
