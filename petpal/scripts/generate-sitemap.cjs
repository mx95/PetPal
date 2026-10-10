#!/usr/bin/env node
/**
 * Writes petpal/public/sitemap.xml from sitemap-public-entries.cjs.
 * Run: node scripts/generate-sitemap.cjs
 */
const fs = require('fs');
const path = require('path');
const { siteUrl, stylesheetHref, entries } = require('./sitemap-public-entries.cjs');

const CHANGEFREQ = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteLoc(pagePath) {
  if (!pagePath || pagePath === '/') return `${siteUrl}/`;
  const p = pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  return `${siteUrl}${p}`;
}

function validateEntry(entry, seen) {
  if (!entry?.path || typeof entry.path !== 'string') {
    throw new Error('sitemap entry missing path');
  }
  if (!entry.path.startsWith('/')) {
    throw new Error(`sitemap path must start with /: ${entry.path}`);
  }
  const loc = absoluteLoc(entry.path);
  if (seen.has(loc)) {
    throw new Error(`duplicate sitemap loc: ${loc}`);
  }
  seen.add(loc);
  if (entry.changefreq && !CHANGEFREQ.has(entry.changefreq)) {
    throw new Error(`invalid changefreq for ${entry.path}: ${entry.changefreq}`);
  }
  if (entry.priority != null) {
    const n = Number(entry.priority);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      throw new Error(`invalid priority for ${entry.path}: ${entry.priority}`);
    }
  }
  if (entry.lastmod != null) {
    if (!/^\d{4}-\d{2}-\d{2}(T[\d:+.-]+)?$/.test(String(entry.lastmod))) {
      throw new Error(`invalid lastmod for ${entry.path}: ${entry.lastmod}`);
    }
  }
  return loc;
}

function buildXml() {
  const seen = new Set();
  const blocks = entries.map((entry) => {
    const loc = validateEntry(entry, seen);
    const lines = ['  <url>', `    <loc>${escapeXml(loc)}</loc>`];
    if (entry.lastmod) lines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    if (entry.changefreq) lines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    if (entry.priority != null) lines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
    lines.push('  </url>');
    return lines.join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    // Browser-only stylesheet so Safari/WebKit show a table instead of stripped text nodes.
    // Search engines ignore xml-stylesheet and parse the urlset normally.
    `<?xml-stylesheet type="text/xsl" href="${escapeXml(stylesheetHref)}"?>`,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...blocks,
    '</urlset>',
    '',
  ].join('\n');
}

const outPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
const xml = buildXml();
fs.writeFileSync(outPath, xml, 'utf8');
console.log(`Wrote ${outPath} (${entries.length} URLs)`);
