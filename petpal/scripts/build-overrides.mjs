#!/usr/bin/env node
/**
 * Build nested override files from flat translation maps.
 * Run after updating scripts/translations-data.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import en from '../src/i18n/locales/en.js';
import el from '../src/i18n/locales/el.js';
import ru from '../src/i18n/locales/ru.js';
import { elTranslations, ruTranslations } from './translations-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const overridesDir = path.resolve(__dirname, '../src/i18n/locales/overrides');

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

function unflatten(flat) {
  const result = {};
  for (const [p, value] of Object.entries(flat)) {
    const parts = p.split('.');
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cur)) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return result;
}

function neededKeys(localeFlat) {
  const enFlat = flatten(en);
  return Object.keys(enFlat).filter((k) => !(k in localeFlat) || localeFlat[k] === enFlat[k]);
}

function pickTranslations(needed, translations) {
  const out = {};
  const missing = [];
  for (const key of needed) {
    if (key in translations) {
      out[key] = translations[key];
    } else {
      missing.push(key);
    }
  }
  if (missing.length) {
    console.error(`Missing ${missing.length} translations:`, missing.slice(0, 20));
    process.exit(1);
  }
  return out;
}

function escapeString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

function isValidUnquotedKey(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function serializeObject(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  const inner = '  '.repeat(indent + 1);
  const lines = ['{'];
  for (const [key, value] of Object.entries(obj)) {
    const keyPart = isValidUnquotedKey(key) ? key : `'${escapeString(key)}'`;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${inner}${keyPart}: ${serializeObject(value, indent + 1)},`);
    } else if (typeof value === 'string' && (value.length > 72 || value.includes('\n'))) {
      lines.push(`${inner}${keyPart}:`);
      lines.push(`${inner}  '${escapeString(value)}',`);
    } else {
      lines.push(`${inner}${keyPart}: '${escapeString(value)}',`);
    }
  }
  lines.push(`${pad}}`);
  return lines.join('\n');
}

function writeOverride(varName, nested, filename) {
  const body = `const ${varName} = ${serializeObject(nested, 0)};\n\nexport default ${varName};\n`;
  fs.mkdirSync(overridesDir, { recursive: true });
  fs.writeFileSync(path.join(overridesDir, filename), body, 'utf8');
}

const elNeeded = neededKeys(flatten(el));
const ruNeeded = neededKeys(flatten(ru));

const elFlat = pickTranslations(elNeeded, elTranslations);
const ruFlat = pickTranslations(ruNeeded, ruTranslations);

writeOverride('el', unflatten(elFlat), 'el.js');
writeOverride('ru', unflatten(ruFlat), 'ru.js');

console.log('Built overrides — el:', Object.keys(elFlat).length, 'ru:', Object.keys(ruFlat).length);
