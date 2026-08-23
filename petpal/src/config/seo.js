import { BRAND } from './brand';

/** Public site origin — set REACT_APP_SITE_URL in production if the domain differs. */
export const SITE_URL = (process.env.REACT_APP_SITE_URL || 'https://petpal.com.cy').replace(/\/$/, '');

export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/home-hero.png`;

export const DEFAULT_TITLE = `${BRAND.appName} — GPS Pet Tracker & Care Hub | Cyprus`;

export const DEFAULT_DESCRIPTION =
  'Track your pet with GPS collars, NFC tags, nearby vets and pet services, and online bookings. PetPal by Pomware Innovative Solutions, Cyprus.';

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
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: BRAND.appName,
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      publisher: {
        '@type': 'Organization',
        name: BRAND.legalName,
        url: SITE_URL,
        email: BRAND.contactEmail,
      },
    },
  },
  {
    match: (path) => path === '/shop' || path.startsWith('/shop/'),
    title: `NFC Pet Tags & GPS Trackers — ${BRAND.appName} Shop`,
    description:
      'Shop NFC pet ID tags and GPS trackers. Custom designs, subscriptions, and delivery across Cyprus.',
    index: (path) => path === '/shop',
  },
  {
    match: (path) => path === '/contact',
    title: `Contact — ${BRAND.appName}`,
    description: `Get in touch with ${BRAND.appName} support. Email ${BRAND.contactEmail} for help with trackers, NFC tags, and bookings.`,
  },
  {
    match: (path) => path === '/install',
    title: `Install App — ${BRAND.appName}`,
    description: `Install ${BRAND.appName} on your phone — add to home screen on iOS and Android for quick pet tracking and care.`,
  },
  {
    match: (path) => path === '/docs',
    title: `Help & Documentation — ${BRAND.appName}`,
    description: `Guides for GPS tracking, NFC tags, bookings, shop orders, and account setup on ${BRAND.appName}.`,
  },
  {
    match: (path) => path === '/discover',
    title: `Discover — ${BRAND.appName}`,
    description: `Explore pet care features, community, and services on ${BRAND.appName}.`,
  },
  {
    match: (path) => path === '/privacy',
    title: `Privacy Policy — ${BRAND.appName}`,
    description: `${BRAND.appName} privacy policy — how we handle location data, account information, and cookies.`,
  },
  {
    match: (path) => path === '/terms',
    title: `Terms of Service — ${BRAND.appName}`,
    description: `${BRAND.appName} terms of service and conditions of use.`,
  },
  {
    match: (path) => path === '/cookies',
    title: `Cookie Policy — ${BRAND.appName}`,
    description: `${BRAND.appName} cookie policy — necessary cookies and optional analytics.`,
  },
  {
    match: (path) => path.startsWith('/pet'),
    title: `Pet Profile — ${BRAND.appName}`,
    description: `View a pet profile on ${BRAND.appName}. NFC scan and emergency contact information.`,
  },
  {
    match: (path) => path === '/login',
    title: `Log in — ${BRAND.appName}`,
    description: `Sign in to your ${BRAND.appName} account to track pets, manage bookings, and shop.`,
    index: false,
  },
  {
    match: (path) => path === '/register',
    title: `Create account — ${BRAND.appName}`,
    description: `Register for ${BRAND.appName} — GPS tracking, NFC tags, and pet care in one app.`,
    index: false,
  },
  {
    match: (path) => path === '/forgot-password',
    title: `Reset password — ${BRAND.appName}`,
    description: `Reset your ${BRAND.appName} account password.`,
    index: false,
  },
];

export function resolveSeo(pathname) {
  const path = pathname.split('?')[0] || '/';
  const noindex = NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

  if (noindex) {
    return {
      title: `${BRAND.appName}`,
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
