import seoMeta from './seo-meta.json';
import { BRAND } from './brand';

/** Public site origin — set REACT_APP_SITE_URL in production if the domain differs. */
export const SITE_URL = (process.env.REACT_APP_SITE_URL || seoMeta.siteUrl || 'https://petpal.com.cy').replace(
  /\/$/,
  ''
);

export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/home-hero.jpg`;

export const SITE_NAME = BRAND.productName;

export const DEFAULT_TITLE = seoMeta.defaultTitle || `${SITE_NAME} | Smart Pet Safety & Care`;

export const DEFAULT_DESCRIPTION =
  seoMeta.defaultDescription ||
  'PetPal Care Hub helps pet owners keep their pets safe, connected and cared for through NFC identification, GPS tracking, digital pet profiles and related services.';

const ROUTE_BY_PATH = new Map((seoMeta.routes || []).map((route) => [route.path, route]));

/** Organization + WebSite JSON-LD for Google site name / brand recognition. */
export function buildHomeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: ['PetPal', 'PetPal Cyprus', 'PetPal GPS Tracker'],
        url: SITE_URL,
        email: BRAND.contactEmail,
        logo: `${SITE_URL}/logo512.png`,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Nicosia',
          addressCountry: 'CY',
        },
        parentOrganization: {
          '@type': 'Organization',
          name: BRAND.legalName,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: ['PetPal', 'PetPal Cyprus'],
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: ['en', 'el'],
      },
    ],
  };
}

/** Shop ItemList with factual catalog products (no invented ratings/reviews). */
export function buildShopJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'PetPal Shop — NFC tags, GPS trackers & care plans',
    url: `${SITE_URL}/shop`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: [
      { '@type': 'Thing', name: 'NFC pet tags' },
      { '@type': 'Thing', name: 'GPS pet trackers' },
      { '@type': 'Thing', name: 'Pet care subscriptions' },
    ],
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'PetPal Plus Monthly',
          url: `${SITE_URL}/shop?sku=PETPAL_PLUS_MONTHLY`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'PetPal Plus Yearly',
          url: `${SITE_URL}/shop?sku=PETPAL_PLUS_YEARLY`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'GPS tracker',
          url: `${SITE_URL}/shop?sku=TRACKER_HARDWARE`,
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'NFC tag',
          url: `${SITE_URL}/shop?sku=NFC_TAG_HARDWARE`,
        },
      ],
    },
  };
}

export function buildBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Path prefixes that should never appear in search results. */
export const NOINDEX_PREFIXES = [
  '/admin',
  '/dashboard',
  '/tracking',
  '/nearby',
  '/profile',
  '/provider',
  '/payment',
  '/bookings',
  '/pets',
  '/premium',
  '/lost-pet',
  '/shelters',
  '/community',
  '/leaderboard',
  '/activity',
  '/inbox',
  '/shop/checkout',
  '/company/apply',
  '/shelter',
];

function normalizePath(pathname) {
  const raw = (pathname || '/').split('?')[0] || '/';
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1) || '/';
  return raw || '/';
}

function jsonLdForPath(path) {
  if (path === '/') return buildHomeJsonLd();
  if (path === '/shop') return buildShopJsonLd();
  if (['/nfc-pet-tags', '/gps-pet-trackers', '/lost-pet-safety', '/pet-friendly-places'].includes(path)) {
    const route = ROUTE_BY_PATH.get(path);
    return buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: route?.h1 || route?.title || path, path },
    ]);
  }
  return null;
}

/** Per-route SEO overrides kept for RouteSeo compatibility / extras. */
export const ROUTE_SEO = [
  {
    match: (path) => path === '/nearby',
    title: `Pet-friendly places — ${SITE_NAME}`,
    description:
      'Find vets, pet shops, dog parks, and pet-friendly cafés near you on PetPal Care Hub.',
    index: false,
  },
  {
    match: (path) => path === '/shop' || path.startsWith('/shop/'),
    title: ROUTE_BY_PATH.get('/shop')?.title || `NFC Pet Tags & GPS Trackers — ${SITE_NAME}`,
    description: ROUTE_BY_PATH.get('/shop')?.description,
    index: (path) => path === '/shop',
    jsonLd: buildShopJsonLd(),
  },
  {
    match: (path) => path.startsWith('/pet'),
    title: `Pet Profile — ${SITE_NAME}`,
    description: `View a pet profile on PetPal Care Hub. NFC scan and emergency contact information.`,
    index: true,
  },
];

export function resolveSeo(pathname) {
  const path = normalizePath(pathname);
  const noindex = NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  if (noindex) {
    return {
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      canonicalPath: path,
      index: false,
      jsonLd: null,
    };
  }

  const fromMeta = ROUTE_BY_PATH.get(path);
  if (fromMeta) {
    return {
      title: fromMeta.title || DEFAULT_TITLE,
      description: fromMeta.description || DEFAULT_DESCRIPTION,
      canonicalPath: path === '/' ? '/' : path,
      index: fromMeta.index !== false,
      jsonLd: fromMeta.index === false ? null : jsonLdForPath(path),
    };
  }

  const route = ROUTE_SEO.find((entry) => entry.match(path));
  const index =
    route?.index === undefined ? true : typeof route.index === 'function' ? route.index(path) : route.index;

  return {
    title: route?.title || DEFAULT_TITLE,
    description: route?.description || DEFAULT_DESCRIPTION,
    canonicalPath: path === '/' ? '/' : path,
    index,
    jsonLd: route?.jsonLd || jsonLdForPath(path),
  };
}

export function absoluteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Paths that should appear in sitemap.xml (canonical public indexable pages). */
export function getSitemapPaths() {
  return (seoMeta.routes || [])
    .filter((route) => route.sitemap && route.index !== false)
    .map((route) => ({
      path: route.path,
      changefreq: route.changefreq || 'monthly',
      priority: route.priority ?? 0.5,
    }));
}
