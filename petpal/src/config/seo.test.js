import {
  NOINDEX_PREFIXES,
  SITEMAP_PUBLIC_PATHS,
  absoluteUrl,
  buildHomeJsonLd,
  buildNfcShopJsonLd,
  buildShopJsonLd,
  resolveSeo,
} from './seo';
import { NFC_TAG_ADDON_CENTS, PLUS_MONTHLY_CENTS, TRACKER_ADDON_CENTS } from '../shop/catalog';

describe('resolveSeo', () => {
  it('indexes public marketing and product hubs', () => {
    expect(resolveSeo('/').index).toBe(true);
    expect(resolveSeo('/shop').index).toBe(true);
    expect(resolveSeo('/shop/nfc').index).toBe(true);
    expect(resolveSeo('/nearby').index).toBe(true);
    expect(resolveSeo('/lost-pet').index).toBe(true);
    expect(resolveSeo('/contact').index).toBe(true);
  });

  it('keeps private and checkout routes noindex', () => {
    for (const prefix of NOINDEX_PREFIXES) {
      expect(resolveSeo(prefix).index).toBe(false);
      expect(resolveSeo(`${prefix}/x`).index).toBe(false);
    }
    expect(resolveSeo('/login').index).toBe(false);
    expect(resolveSeo('/shop/checkout').index).toBe(false);
    expect(resolveSeo('/lost-pet/alert-123').index).toBe(false);
  });

  it('uses unique titles for key public pages', () => {
    const paths = ['/', '/shop', '/shop/nfc', '/nearby', '/lost-pet', '/contact', '/docs'];
    const titles = paths.map((p) => resolveSeo(p).title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('builds absolute canonical URLs on production domain', () => {
    expect(absoluteUrl('/')).toBe('https://petpal.com.cy/');
    expect(absoluteUrl('/shop/nfc')).toBe('https://petpal.com.cy/shop/nfc');
    expect(resolveSeo('/shop/').canonicalPath).toBe('/shop');
  });

  it('exposes sitemap public paths that are indexable', () => {
    for (const p of SITEMAP_PUBLIC_PATHS) {
      expect(resolveSeo(p).index).toBe(true);
    }
  });
});

describe('structured data', () => {
  it('home Organization includes Cyprus and social sameAs', () => {
    const ld = buildHomeJsonLd();
    const org = ld['@graph'].find((n) => n['@type'] === 'Organization');
    expect(org.address.addressCountry).toBe('CY');
    expect(org.sameAs.length).toBeGreaterThan(0);
    expect(org.email).toContain('@');
  });

  it('shop Product offers use catalog prices', () => {
    const ld = buildShopJsonLd();
    const gps = ld['@graph'].find((n) => n.sku === 'TRACKER_HARDWARE');
    const monthly = ld['@graph'].find((n) => n.sku === 'PETPAL_PLUS_MONTHLY');
    expect(gps.offers.price).toBe((TRACKER_ADDON_CENTS / 100).toFixed(2));
    expect(gps.offers.priceCurrency).toBe('EUR');
    expect(monthly.offers.price).toBe((PLUS_MONTHLY_CENTS / 100).toFixed(2));
  });

  it('NFC Product offer uses catalog price and clarifies not GPS in description', () => {
    const ld = buildNfcShopJsonLd();
    const nfc = ld['@graph'].find((n) => n.sku === 'NFC_TAG_HARDWARE');
    expect(nfc.offers.price).toBe((NFC_TAG_ADDON_CENTS / 100).toFixed(2));
    expect(nfc.description.toLowerCase()).toMatch(/not.*gps|does not provide live gps/);
  });
});
