#!/usr/bin/env node
/**
 * Offline SEO checks: robots.txt, sitemap.xml (real XML parse), seo.js, JSON-LD.
 * Run: node scripts/seo-validate.cjs
 */
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const { siteUrl, entries } = require('./sitemap-public-entries.cjs');

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

const sitemapPath = path.join(publicDir, 'sitemap.xml');
const sitemapRaw = fs.readFileSync(sitemapPath, 'utf8');
if (!sitemapRaw.includes('<?xml')) fail('sitemap.xml missing XML declaration');
else ok('sitemap.xml has XML declaration');
if (!sitemapRaw.includes('xml-stylesheet')) {
  fail('sitemap.xml missing xml-stylesheet (Safari shows text-only without it)');
} else ok('sitemap.xml has xml-stylesheet for browsers');

let parseError = null;
const parser = new DOMParser({
  onError(level, message) {
    if (level === 'warning') return;
    parseError = String(message);
  },
});
const doc = parser.parseFromString(sitemapRaw, 'application/xml');
if (parseError) fail(`sitemap.xml parse error: ${parseError}`);
else ok('sitemap.xml parses as XML');

const urlset = doc.documentElement;
if (!urlset || urlset.localName !== 'urlset') {
  fail('sitemap root element is not urlset');
} else if (urlset.namespaceURI !== 'http://www.sitemaps.org/schemas/sitemap/0.9') {
  fail(`sitemap urlset wrong namespace: ${urlset.namespaceURI}`);
} else ok('sitemap urlset namespace is sitemaps.org/0.9');

const urlNodes = [...urlset.childNodes].filter((n) => n.nodeType === 1 && n.localName === 'url');
if (urlNodes.length !== entries.length) {
  fail(`sitemap url count ${urlNodes.length} != entries ${entries.length} — run npm run sitemap:generate`);
} else ok(`sitemap has ${urlNodes.length} <url> elements`);

const locs = [];
const seen = new Set();
for (const urlNode of urlNodes) {
  const kids = [...urlNode.childNodes].filter((n) => n.nodeType === 1);
  const byName = Object.fromEntries(kids.map((n) => [n.localName, (n.textContent || '').trim()]));
  if (!byName.loc) {
    fail('sitemap <url> missing <loc>');
    continue;
  }
  if (!byName.loc.startsWith('https://petpal.com.cy')) {
    fail(`sitemap loc not absolute production HTTPS: ${byName.loc}`);
  }
  if (seen.has(byName.loc)) fail(`duplicate sitemap loc: ${byName.loc}`);
  seen.add(byName.loc);
  locs.push(byName.loc);

  // Ensure elements are real element nodes (not concatenated text-only output)
  const locEl = kids.find((n) => n.localName === 'loc');
  if (!locEl || locEl.nodeType !== 1) fail(`loc is not an element for ${byName.loc}`);
}

const expectedLocs = entries.map((e) => (e.path === '/' ? `${siteUrl}/` : `${siteUrl}${e.path}`));
for (const loc of expectedLocs) {
  if (!locs.includes(loc)) fail(`sitemap missing expected loc ${loc}`);
}
ok('sitemap locs match sitemap-public-entries.cjs');

const privateBlocked = ['/admin', '/dashboard', '/shop/checkout', '/tracking', '/profile'];
for (const p of privateBlocked) {
  if (locs.some((u) => u.includes(p))) fail(`sitemap includes private path ${p}`);
}
ok('sitemap excludes private paths');

const xslPath = path.join(publicDir, 'sitemap.xsl');
if (!fs.existsSync(xslPath)) fail('public/sitemap.xsl missing');
else {
  const xsl = fs.readFileSync(xslPath, 'utf8');
  if (!xsl.includes('xsl:stylesheet')) fail('sitemap.xsl is not an XSLT stylesheet');
  else ok('sitemap.xsl present');
}

const seoSrc = fs.readFileSync(path.join(root, 'src/config/seo.js'), 'utf8');
if (!seoSrc.includes("path === '/shop/nfc'")) fail('seo.js missing /shop/nfc route');
else ok('seo.js defines /shop/nfc');
if (!seoSrc.includes('buildShopJsonLd') || !seoSrc.includes('buildNfcShopJsonLd')) {
  fail('seo.js missing product JSON-LD builders');
} else ok('seo.js product JSON-LD builders present');
const noindexMatch = seoSrc.match(/NOINDEX_PREFIXES\s*=\s*\[([\s\S]*?)\];/);
if (noindexMatch && noindexMatch[1].includes("'/nearby'")) fail('nearby still in NOINDEX_PREFIXES');
else ok('nearby not in NOINDEX_PREFIXES');

const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
if (!indexHtml.includes('application/ld+json')) fail('index.html missing JSON-LD');
else ok('index.html has JSON-LD');

if (failed) {
  console.error(`\nseo-validate: ${failed} failure(s)`);
  process.exit(1);
}
console.log('\nseo-validate: all checks passed');
