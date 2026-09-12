const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applySeoToHtml,
  resolveRouteSeo,
  shouldRedirectWww,
  trailingSlashRedirectTarget,
} = require("../src/seoSpaInject");

test("resolveRouteSeo homepage is indexable with unique title", () => {
  const seo = resolveRouteSeo("/");
  assert.equal(seo.index, true);
  assert.match(seo.title, /PetPal Care Hub/);
  assert.equal(seo.canonical, "https://petpal.com.cy/");
  assert.ok(seo.crawlHtml.includes("NFC"));
});

test("resolveRouteSeo shop has self canonical and product crawl text", () => {
  const seo = resolveRouteSeo("/shop");
  assert.equal(seo.index, true);
  assert.equal(seo.canonical, "https://petpal.com.cy/shop");
  assert.match(seo.title, /Shop|NFC|GPS/i);
  assert.ok(seo.crawlHtml.includes("GPS tracker"));
});

test("legal pages are noindex", () => {
  for (const path of ["/privacy", "/terms", "/cookies"]) {
    const seo = resolveRouteSeo(path);
    assert.equal(seo.index, false, path);
  }
});

test("applySeoToHtml rewrites canonical per path", () => {
  const shell = `<!DOCTYPE html><html><head>
    <title>Old</title>
    <meta name="description" content="old" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="https://petpal.com.cy/" />
    <meta property="og:url" content="https://petpal.com.cy/" />
    <meta property="og:title" content="Old" />
  </head><body><div id="root"></div></body></html>`;
  const html = applySeoToHtml(shell, "/discover");
  assert.match(html, /rel="canonical" href="https:\/\/petpal\.com\.cy\/discover"/);
  assert.match(html, /<title>Discover Pet Care Features/);
  assert.doesNotMatch(html, /rel="canonical" href="https:\/\/petpal\.com\.cy\/"/);
  assert.match(html, /id="pp-seo-crawl"/);
});

test("www host should redirect", () => {
  assert.equal(shouldRedirectWww("www.petpal.com.cy"), true);
  assert.equal(shouldRedirectWww("petpal.com.cy"), false);
});

test("trailing slash redirect target", () => {
  assert.equal(trailingSlashRedirectTarget("/shop/", "/shop/"), "/shop");
  assert.equal(trailingSlashRedirectTarget("/shop/", "/shop/?a=1"), "/shop?a=1");
  assert.equal(trailingSlashRedirectTarget("/shop", "/shop"), null);
  assert.equal(trailingSlashRedirectTarget("/api/x/", "/api/x/"), null);
});
