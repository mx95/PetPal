const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PAGES, PRICES, renderSpaHtml, resolveSeoPage } = require("../src/http/seoPages");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SEO_CONFIG = fs.readFileSync(path.join(REPO_ROOT, "petpal", "src", "config", "seo.js"), "utf8");
const CATALOG = fs.readFileSync(path.join(REPO_ROOT, "petpal", "src", "shop", "catalog.js"), "utf8");
const BUILT_INDEX = fs.readFileSync(path.join(REPO_ROOT, "petpal", "public", "index.html"), "utf8");

function sourceForm(text) {
  return text.replaceAll("PetPal Care Hub", "${SITE_NAME}");
}

test("hub titles and descriptions match petpal/src/config/seo.js", () => {
  for (const route of ["/nearby", "/shop", "/shop/nfc", "/lost-pet"]) {
    const page = PAGES[route];
    assert.ok(SEO_CONFIG.includes(sourceForm(page.title)), `title drift for ${route}: ${page.title}`);
    assert.ok(SEO_CONFIG.includes(page.description), `description drift for ${route}`);
  }
});

test("prices match the shop catalog", () => {
  const cents = (name) => Number(new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(CATALOG)[1]);
  assert.equal(PRICES.plusMonthlyCents, cents("PLUS_MONTHLY_CENTS"));
  assert.equal(PRICES.plusYearlyCents, cents("PLUS_YEARLY_CENTS"));
  assert.equal(PRICES.plusYearlyRenewalCents, cents("PLUS_YEARLY_RENEWAL_CENTS"));
  assert.equal(PRICES.trackerCents, cents("TRACKER_ADDON_CENTS"));
  assert.equal(PRICES.nfcCents, cents("NFC_TAG_ADDON_CENTS"));
});

test("every sitemap URL has a server-rendered indexable page", () => {
  const sitemap = fs.readFileSync(path.join(REPO_ROOT, "petpal", "public", "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  assert.ok(locs.length >= 10);
  for (const loc of locs) {
    const seo = resolveSeoPage(loc);
    assert.equal(seo.index, true, `${loc} should be indexable`);
    assert.ok(seo.page, `${loc} missing from PAGES`);
  }
  const dated = [...sitemap.matchAll(/<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)];
  assert.ok(dated.length >= 5, "hub pages should carry a lastmod");
});

test("renderSpaHtml gives each public route its own canonical, title and JSON-LD", () => {
  const shop = renderSpaHtml(BUILT_INDEX, "/shop").html;
  assert.match(shop, /<link rel="canonical" href="https:\/\/petpal\.com\.cy\/shop"/);
  assert.match(shop, /<title>Pet GPS Tracker in Cyprus \| PetPal Care Hub<\/title>/);
  assert.match(shop, /"@type":"Product"/);
  assert.match(shop, /<meta name="robots" content="index,follow"/);
  assert.equal((shop.match(/<title>/g) || []).length, 1);
  assert.equal((shop.match(/rel="canonical"/g) || []).length, 1);
  assert.equal((shop.match(/application\/ld\+json/g) || []).length, 1);
  assert.match(shop, /<noscript>[\s\S]*PetPal GPS pet trackers and Plus plans/);

  const home = renderSpaHtml(BUILT_INDEX, "/").html;
  assert.match(home, /<link rel="canonical" href="https:\/\/petpal\.com\.cy\/"/);
  assert.match(home, /"@type":"Organization"/);

  const trailing = renderSpaHtml(BUILT_INDEX, "/shop/nfc/");
  assert.match(trailing.html, /href="https:\/\/petpal\.com\.cy\/shop\/nfc"/);
});

test("private and unknown routes are noindex", () => {
  for (const route of ["/dashboard", "/shop/checkout", "/pets/abc", "/admin/users", "/does-not-exist", "/pet/xyz"]) {
    const out = renderSpaHtml(BUILT_INDEX, route);
    assert.equal(out.index, false, route);
    assert.match(out.html, /<meta name="robots" content="noindex,follow"/, route);
  }
});

test("rendered HTML keeps the app bootstrap intact", () => {
  const out = renderSpaHtml(BUILT_INDEX, "/nearby").html;
  assert.match(out, /<div id="root"><\/div>/);
  assert.match(out, /<link rel="manifest"/);
});
