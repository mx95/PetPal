import { BRAND } from './brand';
import {
  NFC_TAG_ADDON_CENTS,
  PLUS_MONTHLY_CENTS,
  PLUS_YEARLY_CENTS,
  PLUS_YEARLY_RENEWAL_CENTS,
  TRACKER_ADDON_CENTS,
} from '../shop/catalog';

/** Public site origin — set REACT_APP_SITE_URL in production if the domain differs. */
export const SITE_URL = (process.env.REACT_APP_SITE_URL || 'https://petpal.com.cy').replace(/\/$/, '');

export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/home-hero.jpg`;

export const SITE_NAME = BRAND.productName;

export const DEFAULT_TITLE = `${SITE_NAME} | GPS Pet Tracker & NFC Tags — Cyprus`;

export const DEFAULT_DESCRIPTION =
  'PetPal Care Hub is a pet-care technology platform for Cyprus: GPS pet trackers with live location and history, NFC ID tags with digital pet profiles, lost-pet alerts, and pet-friendly places.';

const SOCIAL_SAME_AS = [
  'https://www.instagram.com/petpalcarehub',
  'https://www.facebook.com/profile.php?id=61591283802491',
  'https://www.tiktok.com/@petpal.care.hub',
];

function eurAmount(cents) {
  return (Number(cents) / 100).toFixed(2);
}

function offerJson(priceCents, { url, sku } = {}) {
  return {
    '@type': 'Offer',
    url: url || `${SITE_URL}/shop`,
    priceCurrency: 'EUR',
    price: eurAmount(priceCents),
    availability: 'https://schema.org/InStock',
    seller: { '@id': `${SITE_URL}/#organization` },
    ...(sku ? { sku } : {}),
  };
}

/** Organization + WebSite JSON-LD for Google site name / brand recognition. */
export function buildHomeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: ['PetPal', 'PetPal Cyprus', 'PetPal GPS Tracker', 'PetPal Care Hub Cyprus'],
        url: SITE_URL,
        email: BRAND.contactEmail,
        logo: `${SITE_URL}/logo512.png`,
        image: DEFAULT_OG_IMAGE,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Nicosia',
          addressCountry: 'CY',
        },
        areaServed: {
          '@type': 'Country',
          name: 'Cyprus',
        },
        parentOrganization: {
          '@type': 'Organization',
          name: BRAND.legalName,
        },
        sameAs: SOCIAL_SAME_AS,
        contactPoint: {
          '@type': 'ContactPoint',
          email: BRAND.contactEmail,
          contactType: 'customer support',
          availableLanguage: ['English', 'Greek', 'Russian'],
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
        inLanguage: ['en', 'el', 'ru'],
      },
    ],
  };
}

/** Product + Offer JSON-LD for the shop (GPS tracker + subscription plans). Prices from catalog. */
export function buildShopJsonLd() {
  const shopUrl = `${SITE_URL}/shop`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: shopUrl },
        ],
      },
      {
        '@type': 'Product',
        '@id': `${shopUrl}#gps-tracker`,
        name: 'PetPal GPS Pet Tracker',
        description:
          'GPS collar tracker for dogs and cats in Cyprus with live location in PetPal Care Hub, location history and routes, and distance alerts. Requires an active PetPal Plus subscription for live tracking.',
        image: [`${SITE_URL}/images/shop/gps-tracker-v4.png`, DEFAULT_OG_IMAGE],
        brand: { '@type': 'Brand', name: SITE_NAME },
        sku: 'TRACKER_HARDWARE',
        category: 'Pet GPS Tracker',
        offers: offerJson(TRACKER_ADDON_CENTS, { url: shopUrl, sku: 'TRACKER_HARDWARE' }),
      },
      {
        '@type': 'Product',
        '@id': `${shopUrl}#plus-monthly`,
        name: 'PetPal Plus Monthly',
        description:
          'Monthly PetPal Plus subscription for live GPS pet tracking, location history, and related Care Hub features in Cyprus. Optional GPS tracker and NFC tag add-ons at checkout.',
        brand: { '@type': 'Brand', name: SITE_NAME },
        sku: 'PETPAL_PLUS_MONTHLY',
        offers: {
          ...offerJson(PLUS_MONTHLY_CENTS, { url: `${shopUrl}?sku=PETPAL_PLUS_MONTHLY`, sku: 'PETPAL_PLUS_MONTHLY' }),
          priceValidUntil: '2027-12-31',
        },
      },
      {
        '@type': 'Product',
        '@id': `${shopUrl}#plus-yearly`,
        name: 'PetPal Plus Yearly',
        description:
          'Yearly PetPal Plus plan for Cyprus pet owners. Includes a discounted GPS tracker and a free NFC tag with the first-year purchase; renews at a lower yearly rate.',
        brand: { '@type': 'Brand', name: SITE_NAME },
        sku: 'PETPAL_PLUS_YEARLY',
        offers: {
          ...offerJson(PLUS_YEARLY_CENTS, { url: `${shopUrl}?sku=PETPAL_PLUS_YEARLY`, sku: 'PETPAL_PLUS_YEARLY' }),
          priceValidUntil: '2027-12-31',
          description: `First year ${eurAmount(PLUS_YEARLY_CENTS)} EUR; renews at ${eurAmount(PLUS_YEARLY_RENEWAL_CENTS)} EUR/year.`,
        },
      },
    ],
  };
}

/** Product JSON-LD for the existing NFC shop page. */
export function buildNfcShopJsonLd() {
  const nfcUrl = `${SITE_URL}/shop/nfc`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
          { '@type': 'ListItem', position: 3, name: 'NFC tags', item: nfcUrl },
        ],
      },
      {
        '@type': 'Product',
        '@id': `${nfcUrl}#nfc-tag`,
        name: 'PetPal NFC Pet ID Tag',
        description:
          'NFC pet identification tag for dogs and cats. A finder taps the tag with a phone to open the pet’s public digital profile and contact the owner. NFC does not provide live GPS tracking.',
        image: [DEFAULT_OG_IMAGE],
        brand: { '@type': 'Brand', name: SITE_NAME },
        sku: 'NFC_TAG_HARDWARE',
        category: 'Pet NFC ID Tag',
        offers: offerJson(NFC_TAG_ADDON_CENTS, { url: nfcUrl, sku: 'NFC_TAG_HARDWARE' }),
      },
    ],
  };
}

export function buildNearbyJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Pet-friendly places — ${SITE_NAME}`,
    description:
      'Find pet-friendly places in Cyprus and Greece: veterinary clinics, pet shops, parks, beaches, and cafés on the PetPal Care Hub Nearby map.',
    url: `${SITE_URL}/nearby`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: {
      '@type': 'Thing',
      name: 'Pet-friendly places in Cyprus',
    },
  };
}

export function buildLostPetJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Lost pet alerts — ${SITE_NAME}`,
    description:
      'Create and browse lost-pet alerts on PetPal Care Hub. Combine photo alerts with GPS tracking and NFC identification to help finders contact owners in Cyprus.',
    url: `${SITE_URL}/lost-pet`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };
}

/**
 * Path prefixes that should never appear in search results.
 * Exact public hubs that should be indexed are handled in ROUTE_SEO (e.g. /lost-pet).
 */
export const NOINDEX_PREFIXES = [
  '/admin',
  '/dashboard',
  '/tracking',
  '/profile',
  '/provider',
  '/payment',
  '/bookings',
  '/pets',
  '/premium',
  '/shelters',
  '/shelter',
  '/community',
  '/leaderboard',
  '/activity',
  '/inbox',
  '/shop/checkout',
  '/company/apply',
];

/** Exact paths that stay noindex even when a parent hub is indexed. */
export const NOINDEX_EXACT = [];

/** Per-route SEO overrides. */
export const ROUTE_SEO = [
  {
    match: (path) => path === '/',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    index: true,
    jsonLd: buildHomeJsonLd(),
  },
  {
    match: (path) => path === '/nearby',
    title: `Pet-Friendly Places in Cyprus & Greece | ${SITE_NAME}`,
    description:
      'Find vets, pet shops, dog parks, beaches, and pet-friendly cafés near you on PetPal Care Hub. Browse the Nearby map for Cyprus and Greece.',
    index: true,
    jsonLd: buildNearbyJsonLd(),
  },
  {
    match: (path) => path === '/shop',
    title: `Pet GPS Tracker in Cyprus | ${SITE_NAME}`,
    description:
      'Buy PetPal GPS trackers for dogs and cats in Cyprus — live location, history routes, and distance alerts. Monthly from €4.99 or yearly with tracker and NFC options.',
    index: true,
    jsonLd: buildShopJsonLd(),
  },
  {
    match: (path) => path === '/shop/nfc',
    title: `NFC Pet ID Tags in Cyprus | ${SITE_NAME}`,
    description:
      'PetPal NFC tags open a digital pet profile when tapped — so a finder can contact you. Not a GPS tracker. Order tags from €9.99 or get one free with Yearly Plus.',
    index: true,
    jsonLd: buildNfcShopJsonLd(),
  },
  {
    match: (path) => path.startsWith('/shop/'),
    title: `Shop — ${SITE_NAME}`,
    description: `Shop NFC pet ID tags and GPS trackers at ${SITE_NAME}.`,
    index: false,
  },
  {
    match: (path) => path === '/lost-pet',
    title: `Lost Pet Alerts in Cyprus | ${SITE_NAME}`,
    description:
      'Publish a photo-first lost-pet alert on PetPal Care Hub. Use GPS tracking and NFC ID tags together to help finders reach you — recovery is never guaranteed.',
    index: true,
    jsonLd: buildLostPetJsonLd(),
  },
  {
    match: (path) => path.startsWith('/lost-pet/'),
    title: `Lost pet alert — ${SITE_NAME}`,
    description: `View a lost-pet alert on ${SITE_NAME}. Contact details and last-seen information are provided by the pet’s owner.`,
    index: false,
  },
  {
    match: (path) => path === '/contact',
    title: `Contact — ${SITE_NAME}`,
    description: `Contact PetPal Care Hub support at ${BRAND.contactEmail} for help with GPS trackers, NFC tags, subscriptions, and bookings in Cyprus.`,
  },
  {
    match: (path) => path === '/install',
    title: `Install App — ${SITE_NAME}`,
    description: `Install PetPal Care Hub on your phone — add to home screen on iOS and Android for quick pet tracking and care.`,
  },
  {
    match: (path) => path === '/docs',
    title: `Help & Documentation — ${SITE_NAME}`,
    description: `Guides for GPS tracking, NFC tags, bookings, shop orders, and account setup on PetPal Care Hub.`,
  },
  {
    match: (path) => path === '/discover',
    title: `Discover — ${SITE_NAME}`,
    description: `Explore pet care features, community, and services on PetPal Care Hub.`,
  },
  {
    match: (path) => path === '/privacy',
    title: `Privacy Policy — ${SITE_NAME}`,
    description: `PetPal Care Hub privacy policy — how we handle location data, account information, and cookies.`,
  },
  {
    match: (path) => path === '/terms',
    title: `Terms of Service — ${SITE_NAME}`,
    description: `PetPal Care Hub terms of service and conditions of use.`,
  },
  {
    match: (path) => path === '/cookies',
    title: `Cookie Policy — ${SITE_NAME}`,
    description: `PetPal Care Hub cookie policy — necessary cookies and optional analytics.`,
  },
  {
    match: (path) => path.startsWith('/pet'),
    title: `Pet Profile — ${SITE_NAME}`,
    description: `Public pet profile on PetPal Care Hub — opened from an NFC tag scan with owner contact options when the owner has enabled them.`,
  },
  {
    match: (path) => path === '/login',
    title: `Log in — ${SITE_NAME}`,
    description: `Sign in to your PetPal Care Hub account to track pets, manage bookings, and shop.`,
    index: false,
  },
  {
    match: (path) => path === '/register',
    title: `Create account — ${SITE_NAME}`,
    description: `Register for PetPal Care Hub — GPS tracking, NFC tags, and pet care in one app.`,
    index: false,
  },
  {
    match: (path) => path === '/forgot-password',
    title: `Reset password — ${SITE_NAME}`,
    description: `Reset your PetPal Care Hub account password.`,
    index: false,
  },
];

export function resolveSeo(pathname) {
  const path = pathname.split('?')[0] || '/';
  const noindexExact = NOINDEX_EXACT.includes(path);
  const noindexPrefix = NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  if (noindexExact || noindexPrefix) {
    return {
      title: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      canonicalPath: path === '/' ? '/' : path.replace(/\/$/, '') || '/',
      index: false,
      jsonLd: null,
    };
  }

  const route = ROUTE_SEO.find((entry) => entry.match(path));
  const index = route?.index === undefined ? true : typeof route.index === 'function' ? route.index(path) : route.index;

  return {
    title: route?.title || DEFAULT_TITLE,
    description: route?.description || DEFAULT_DESCRIPTION,
    canonicalPath: path === '/' ? '/' : path.replace(/\/$/, '') || '/',
    index,
    jsonLd: typeof route?.jsonLd === 'function' ? route.jsonLd(path) : route?.jsonLd || null,
  };
}

export function absoluteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Canonical public URLs for sitemap generation / validation. */
export const SITEMAP_PUBLIC_PATHS = [
  '/',
  '/shop',
  '/shop/nfc',
  '/nearby',
  '/lost-pet',
  '/contact',
  '/install',
  '/docs',
  '/discover',
  '/privacy',
  '/terms',
  '/cookies',
];
