#!/usr/bin/env node
/**
 * Notifies IndexNow engines (Bing, Yandex, Seznam, Naver) of every URL in public/sitemap.xml.
 * The key file is served at https://petpal.com.cy/<key>.txt (petpal/public/<key>.txt).
 * Run after a deploy: node scripts/indexnow-submit.cjs
 */
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const keyFile = fs.readdirSync(publicDir).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('IndexNow key file not found in public/');
const key = keyFile.replace(/\.txt$/, '');
const sitemap = fs.readFileSync(path.join(publicDir, 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

(async () => {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'petpal.com.cy',
      key,
      keyLocation: `https://petpal.com.cy/${key}.txt`,
      urlList,
    }),
  });
  console.log(`IndexNow ${res.status} for ${urlList.length} URLs`);
  if (res.status >= 400) process.exit(1);
})();
