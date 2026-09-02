import { BRAND } from './brand';

/** Public site origin — set REACT_APP_SITE_URL in production if the domain differs. */
export const SITE_URL = (process.env.REACT_APP_SITE_URL || 'https://petpal.com.cy').replace(/\/$/, '');

export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/home-hero.jpg`;

export const SITE_NAME = BRAND.productName;

export const DEFAULT_TITLE = `${SITE_NAME} | GPS Pet Tracker & NFC Tags — Cyprus`;

export const DEFAULT_DESCRIPTION =
  'PetPal Care Hub — track your pet with GPS collars, NFC tags, nearby vets and pet services, and online bookings. By Pomware Innovative Solutions, Cyprus.';

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

/** Path prefixes that should never appear in search results. */
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
  '/lost-pet',
  '/shelters',
  '/community',
  '/leaderboard',
  '/activity',
  '/inbox',
  '/shop/checkout',
  '/company/apply',
];

/** Per-route SEO overrides. Keys are exact paths or pathname prefixes when ending with `*`. */
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
    title: `Pet-friendly places — ${SITE_NAME}`,
    description:
      'Find vets, pet shops, dog parks, and pet-friendly cafés near you in Cyprus and Greece on PetPal Care Hub.',
    index: true,
  },
  {
    match: (path) => path === '/shop' || path.startsWith('/shop/'),
    title: `NFC Pet Tags & GPS Trackers — ${SITE_NAME}`,
    description:
      'Shop NFC pet ID tags and GPS trackers at PetPal Care Hub. Custom designs, subscriptions, and delivery across Cyprus.',
    index: (path) => path === '/shop',
  },
  {
    match: (path) => path === '/contact',
    title: `Contact — ${SITE_NAME}`,
    description: `Contact PetPal Care Hub support at ${BRAND.contactEmail} for help with trackers, NFC tags, and bookings.`,
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
    description: `View a pet profile on PetPal Care Hub. NFC scan and emergency contact information.`,
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

  const route = ROUTE_SEO.find((entry) => entry.match(path));
  const index = route?.index === undefined ? true : typeof route.index === 'function' ? route.index(path) : route.index;

  return {
    title: route?.title || DEFAULT_TITLE,
    description: route?.description || DEFAULT_DESCRIPTION,
    canonicalPath: path === '/' ? '/' : path.replace(/\/$/, '') || '/',
    index,
    jsonLd: route?.jsonLd || null,
  };
}

export function absoluteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
