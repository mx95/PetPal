/**
 * Parse IMEI from QR payload: plain 15 digits, URL query (?imei=…), or embedded digit run.
 * @param {string} raw
 * @returns {string|null}
 */
export function extractImeiFromQr(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  const compact = s.replace(/\s+/g, '');
  if (/^\d{15}$/.test(compact)) return compact;

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

  const m = s.match(/\d{15}/);
  if (m) return m[0];

  return findImei15(onlyDigits(s));
}

function onlyDigits(x) {
  return String(x).replace(/\D/g, '');
}

function findImei15(digits) {
  if (digits.length === 15) return digits;
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
