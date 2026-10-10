#!/usr/bin/env node
/**
 * Offline SEO checks: robots.txt, sitemap.xml, seo.js route uniqueness, JSON-LD.
 * Run: node scripts/seo-validate.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
let failed = 0;

function ok(msg) {
  console.log(`OK  ${msg}`);
}
function fail(msg) {
  console.error(`FAIL ${msg}`);
  failed += 1;
}

const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8');
if (!/Sitemap:\s*https:\/\/petpal\.com\.cy\/sitemap\.xml/i.test(robots)) {
  fail('robots.txt missing production Sitemap URL');
} else ok('robots.txt Sitemap URL');
if (!/User-agent:\s*OAI-SearchBot/i.test(robots)) {
  fail('robots.txt missing OAI-SearchBot block');
} else ok('robots.txt OAI-SearchBot');
if (/Disallow:\s*\/nearby\b/i.test(robots)) {
  fail('robots.txt still Disallows /nearby (public page)');
} else ok('robots.txt does not Disallow /nearby');
if (/Disallow:\s*\/shop\/nfc/i.test(robots)) {
  fail('robots.txt Disallows /shop/nfc');
} else ok('robots.txt allows /shop/nfc');

const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
if (!sitemap.includes('<?xml') || !sitemap.includes('<urlset')) {
  fail('sitemap.xml is not valid XML urlset');
} else ok('sitemap.xml has urlset');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const required = [
  'https://petpal.com.cy/',
  'https://petpal.com.cy/shop',
  'https://petpal.com.cy/shop/nfc',
  'https://petpal.com.cy/nearby',
  'https://petpal.com.cy/lost-pet',
  'https://petpal.com.cy/contact',
  'https://petpal.com.cy/privacy',
];
for (const url of required) {
  if (!locs.includes(url)) fail(`sitemap missing ${url}`);
  else ok(`sitemap has ${url}`);
}
const privateBlocked = ['/admin', '/dashboard', '/shop/checkout', '/tracking'];
for (const p of privateBlocked) {
  if (locs.some((u) => u.includes(p))) fail(`sitemap includes private path ${p}`);
}

// Load seo.js via babel-less transform: require through CRA is hard; use dynamic import via jest-less eval of built checks.
// Instead, spawn a tiny require of catalog + duplicate resolve checks by reading source patterns.
const seoSrc = fs.readFileSync(path.join(root, 'src/config/seo.js'), 'utf8');
if (!seoSrc.includes("path === '/shop/nfc'")) fail('seo.js missing /shop/nfc route');
else ok('seo.js defines /shop/nfc');
if (!seoSrc.includes("path === '/nearby'")) fail('seo.js missing /nearby route');
else ok('seo.js defines /nearby');
if (!seoSrc.includes('buildShopJsonLd') || !seoSrc.includes('buildNfcShopJsonLd')) {
  fail('seo.js missing product JSON-LD builders');
} else ok('seo.js product JSON-LD builders present');
if (seoSrc.includes("'/nearby',") && /NOINDEX_PREFIXES\s*=\s*\[[^\]]*'/s.test(seoSrc)) {
  // ensure nearby not in NOINDEX list
  const m = seoSrc.match(/NOINDEX_PREFIXES\s*=\s*\[([\s\S]*?)\];/);
  if (m && m[1].includes("'/nearby'")) fail('nearby still in NOINDEX_PREFIXES');
  else ok('nearby not in NOINDEX_PREFIXES');
}

const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
if (!indexHtml.includes('application/ld+json')) fail('index.html missing JSON-LD');
else ok('index.html has JSON-LD');
if (!indexHtml.includes('/shop/nfc')) fail('index.html noscript missing /shop/nfc link');
else ok('index.html noscript links /shop/nfc');
if (!indexHtml.includes('sameAs')) fail('index.html Organization missing sameAs');
else ok('index.html Organization sameAs');

// Title uniqueness among ROUTE_SEO title strings in source
const titles = [...seoSrc.matchAll(/title:\s*`([^`]+)`|title:\s*'([^']+)'|title:\s*DEFAULT_TITLE/g)].map(
  (m) => m[1] || m[2] || 'DEFAULT_TITLE'
);
const titleSet = new Set();
for (const t of titles) {
  if (titleSet.has(t)) fail(`duplicate SEO title literal: ${t}`);
  titleSet.add(t);
}
ok(`SEO title literals unique (${titleSet.size})`);

if (failed) {
  console.error(`\nseo-validate: ${failed} failure(s)`);
  process.exit(1);
}
console.log('\nseo-validate: all checks passed');
