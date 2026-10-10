/**
 * Single source of truth for public sitemap URLs.
 * Keep paths aligned with SITEMAP_PUBLIC_PATHS in src/config/seo.js (indexable hubs only).
 * lastmod is optional — set only when page content genuinely changed; never invent dates.
 */
module.exports = {
  siteUrl: 'https://petpal.com.cy',
  stylesheetHref: '/sitemap.xsl',
  /** @type {{ path: string, changefreq?: string, priority?: string, lastmod?: string }[]} */
  entries: [
    { path: '/', changefreq: 'weekly', priority: '1.0', lastmod: '2026-10-10' },
    { path: '/shop', changefreq: 'weekly', priority: '0.9', lastmod: '2026-10-10' },
    { path: '/shop/nfc', changefreq: 'weekly', priority: '0.85', lastmod: '2026-10-10' },
    { path: '/nearby', changefreq: 'weekly', priority: '0.8' },
    { path: '/lost-pet', changefreq: 'weekly', priority: '0.75' },
    { path: '/contact', changefreq: 'monthly', priority: '0.7' },
    { path: '/install', changefreq: 'monthly', priority: '0.7' },
    { path: '/docs', changefreq: 'monthly', priority: '0.6' },
    { path: '/discover', changefreq: 'monthly', priority: '0.5' },
    { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
    { path: '/terms', changefreq: 'yearly', priority: '0.3' },
    { path: '/cookies', changefreq: 'yearly', priority: '0.3' },
  ],
};
