#!/usr/bin/env node
/**
 * Merge en (source) + existing locale + overrides → write el.js / ru.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import en from '../src/i18n/locales/en.js';
import el from '../src/i18n/locales/el.js';
import ru from '../src/i18n/locales/ru.js';
import elOverrides from '../src/i18n/locales/overrides/el.js';
import ruOverrides from '../src/i18n/locales/overrides/ru.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '../src/i18n/locales');

function deepClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = deepClone(v);
  return out;
}

function deepMerge(base, ...layers) {
  const result = deepClone(base);
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    for (const [key, value] of Object.entries(layer)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        result[key] &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = deepClone(value);
      }
    }
  }
  return result;
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function isValidUnquotedKey(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function serializeValue(value, baseIndent) {
  if (typeof value === 'string') {
    return `'${escapeString(value)}'`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null) return 'null';
  throw new Error(`Unsupported value type: ${typeof value}`);
}

function serializeObject(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);
  const entries = Object.entries(obj);
  if (!entries.length) return '{}';

  const lines = ['{'];
  for (const [key, value] of entries) {
    const keyPart = isValidUnquotedKey(key) ? key : `'${escapeString(key)}'`;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${inner}${keyPart}: ${serializeObject(value, indent + 1)},`);
      continue;
    }

    if (typeof value === 'string' && (value.length > 72 || value.includes('\n'))) {
      lines.push(`${inner}${keyPart}:`);
      lines.push(`${inner}  '${escapeString(value)}',`);
      continue;
    }

    lines.push(`${inner}${keyPart}: ${serializeValue(value, indent + 1)},`);
  }
  lines.push(`${pad}}`);
  return lines.join('\n');
}

function writeLocaleFile(varName, data, filename) {
  const body = `const ${varName} = ${serializeObject(data, 0)};\n\nexport default ${varName};\n`;
  fs.writeFileSync(path.join(localesDir, filename), body, 'utf8');
}

function countMissing(enFlat, localeFlat) {
  return Object.keys(enFlat).filter((k) => !(k in localeFlat));
}

const mergedEl = deepMerge(en, el, elOverrides);
const mergedRu = deepMerge(en, ru, ruOverrides);

writeLocaleFile('el', mergedEl, 'el.js');
writeLocaleFile('ru', mergedRu, 'ru.js');

const enFlat = flatten(en);
const elFlat = flatten(mergedEl);
const ruFlat = flatten(mergedRu);
const elOverrideFlat = flatten(elOverrides);
const ruOverrideFlat = flatten(ruOverrides);

const missingEl = countMissing(enFlat, elFlat);
const missingRu = countMissing(enFlat, ruFlat);

console.log('Override keys — el:', Object.keys(elOverrideFlat).length);
console.log('Override keys — ru:', Object.keys(ruOverrideFlat).length);
console.log('Merged keys — el:', Object.keys(elFlat).length, '/ en:', Object.keys(enFlat).length);
console.log('Merged keys — ru:', Object.keys(ruFlat).length, '/ en:', Object.keys(enFlat).length);

if (missingEl.length || missingRu.length) {
  console.error('Missing keys vs en:');
  if (missingEl.length) console.error('  el:', missingEl.length, missingEl.slice(0, 10));
  if (missingRu.length) console.error('  ru:', missingRu.length, missingRu.slice(0, 10));
  process.exit(1);
}

console.log('Sync complete — 0 missing keys vs en.');
