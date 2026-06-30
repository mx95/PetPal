/**
 * Parse IMEI from QR or barcode payload: plain 15 digits, URL query (?imei=…), or embedded digit run.
 * @param {string} raw
 * @returns {string|null}
 */
export function extractImeiFromQr(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;

  // Strip control chars (e.g. GS1 FNC1 in Code 128) and common label prefixes.
  s = s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/^[*+.\s-]+|[*+.\s-]+$/g, '');
  s = s.replace(/[()]/g, '');
  s = s.replace(/^(?:IMEI|imei|SN|S\/N|Serial|Device\s*ID)\s*[:#]?\s*/i, '');

  const compact = s.replace(/\s+/g, '');
  if (/^\d{15}$/.test(compact)) return compact;
  if (/^\d{14}$/.test(compact)) return `0${compact}`;

  try {
    const u = new URL(s);
    const keys = ['imei', 'IMEI', 'deviceId', 'device_id', 'id', 'sn'];
    for (const k of keys) {
      const v = u.searchParams.get(k);
      if (v) {
        const hit = findImei15(onlyDigits(v));
        if (hit) return hit;
      }
    }
    const tail = u.pathname.split('/').filter(Boolean).pop();
    if (tail) {
      const hit = findImei15(onlyDigits(tail));
      if (hit) return hit;
    }
  } catch {
    // not a URL
  }

  const digits = onlyDigits(s);
  if (digits.length >= 15) {
    const hit = findImei15(digits);
    if (hit) return hit;
  }

  const m = s.match(/\d{15}/);
  if (m) return m[0];

  return null;
}

function onlyDigits(x) {
  return String(x).replace(/\D/g, '');
}

function findImei15(digits) {
  if (digits.length === 15) return luhnValidImei(digits) ? digits : digits;
  if (digits.length < 15) return null;
  for (let i = 0; i <= digits.length - 15; i++) {
    const slice = digits.slice(i, i + 15);
    if (luhnValidImei(slice)) return slice;
  }
  return digits.slice(0, 15);
}

/** IMEI uses Luhn on the first 14 digits; 15th is check digit. */
function luhnValidImei(imei15) {
  if (!/^\d{15}$/.test(imei15)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = imei15.charCodeAt(i) - 48;
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === imei15.charCodeAt(14) - 48;
}
