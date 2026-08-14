#!/usr/bin/env node
/**
 * One-shot: invoke bootstrapLiveJccCredentials after it is deployed.
 * Usage: node scripts/invoke-jcc-live-bootstrap.mjs
 */
const TOKEN = process.env.JCC_BOOTSTRAP_TOKEN || '4e8cfad6836c4d3dee8bca8a3f84c3750f4e1f9c7e864bc7';
const URL =
  process.env.JCC_BOOTSTRAP_URL ||
  'https://europe-west1-petpal-aecda.cloudfunctions.net/bootstrapLiveJccCredentials';

async function main() {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { token: TOKEN } }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  console.log(JSON.stringify({ http: res.status, ...json }, null, 2));
  if (!res.ok || json?.error) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
