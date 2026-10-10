/**
 * Run with: node --test scripts/generate-sitemap.test.cjs
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DOMParser } = require('@xmldom/xmldom');
const { entries, siteUrl } = require('./sitemap-public-entries.cjs');

const root = path.resolve(__dirname, '..');
const sitemapPath = path.join(root, 'public', 'sitemap.xml');

describe('generate-sitemap', () => {
  it('writes parseable urlset with element-wrapped loc values', () => {
    const gen = spawnSync(process.execPath, [path.join(__dirname, 'generate-sitemap.cjs')], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(gen.status, 0, gen.stderr || gen.stdout);

    const raw = fs.readFileSync(sitemapPath, 'utf8');
    assert.match(raw, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(raw, /<\?xml-stylesheet type="text\/xsl" href="\/sitemap\.xsl"\?>/);

    let err = null;
    const doc = new DOMParser({
      onError(level, message) {
        if (level !== 'warning') err = String(message);
      },
    }).parseFromString(raw, 'application/xml');
    assert.equal(err, null, err);

    const urlset = doc.documentElement;
    assert.equal(urlset.localName, 'urlset');
    assert.equal(urlset.namespaceURI, 'http://www.sitemaps.org/schemas/sitemap/0.9');

    const urls = [...urlset.childNodes].filter((n) => n.nodeType === 1 && n.localName === 'url');
    assert.equal(urls.length, entries.length);

    for (const url of urls) {
      const loc = [...url.childNodes].find((n) => n.nodeType === 1 && n.localName === 'loc');
      assert.ok(loc, 'each url must have a <loc> element');
      assert.match(loc.textContent, /^https:\/\/petpal\.com\.cy\//);
    }

    const firstLoc = [...urls[0].childNodes].find((n) => n.localName === 'loc').textContent;
    assert.equal(firstLoc, `${siteUrl}/`);
  });
});
