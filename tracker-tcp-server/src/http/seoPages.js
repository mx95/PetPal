"use strict";

/**
 * Server-side head/noscript injection for the React SPA so crawlers and AI scrapers that do not
 * execute JavaScript still receive per-URL title, description, canonical, robots and JSON-LD.
 * Keep titles/descriptions/prices in sync with petpal/src/config/seo.js (see test/seoPages.test.js).
 */

const SITE_URL = (process.env.REACT_APP_SITE_URL || "https://petpal.com.cy").replace(/\/$/, "");
const SITE_NAME = "PetPal Care Hub";
const CONTACT_EMAIL = "info@petpal.com.cy";
const LEGAL_NAME = "Pomware Innovative Solutions Ltd";
const OG_IMAGE = `${SITE_URL}/images/home-hero.jpg`;

const PRICES = {
  plusMonthlyCents: 499,
  plusYearlyCents: 8999,
  plusYearlyRenewalCents: 5999,
  trackerCents: 3999,
  nfcCents: 999,
};

const SOCIAL_SAME_AS = [
  "https://www.instagram.com/petpalcarehub",
  "https://www.facebook.com/profile.php?id=61591283802491",
  "https://www.tiktok.com/@petpal.care.hub",
];

const NOINDEX_PREFIXES = [
  "/admin",
  "/dashboard",
  "/tracking",
  "/profile",
  "/provider",
  "/payment",
  "/bookings",
  "/pets",
  "/premium",
  "/shelters",
  "/shelter",
  "/community",
  "/leaderboard",
  "/activity",
  "/inbox",
  "/shop/checkout",
  "/company/apply",
];

function eur(cents) {
  return (Number(cents) / 100).toFixed(2);
}

function offer(cents, { url, sku } = {}) {
  return {
    "@type": "Offer",
    url: url || `${SITE_URL}/shop`,
    priceCurrency: "EUR",
    price: eur(cents),
    availability: "https://schema.org/InStock",
    seller: { "@id": `${SITE_URL}/#organization` },
    ...(sku ? { sku } : {}),
  };
}

const DEFAULT_TITLE = `${SITE_NAME} | GPS Pet Tracker & NFC Tags — Cyprus`;
const DEFAULT_DESCRIPTION =
  "PetPal Care Hub is a pet-care technology platform for Cyprus: GPS pet trackers with live location and history, NFC ID tags with digital pet profiles, lost-pet alerts, and pet-friendly places.";

function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: ["PetPal", "PetPal Cyprus", "PetPal GPS Tracker", "PetPal Care Hub Cyprus"],
        url: SITE_URL,
        email: CONTACT_EMAIL,
        logo: `${SITE_URL}/logo512.png`,
        image: OG_IMAGE,
        address: { "@type": "PostalAddress", addressLocality: "Nicosia", addressCountry: "CY" },
        areaServed: { "@type": "Country", name: "Cyprus" },
        parentOrganization: { "@type": "Organization", name: LEGAL_NAME },
        sameAs: SOCIAL_SAME_AS,
        contactPoint: {
          "@type": "ContactPoint",
          email: CONTACT_EMAIL,
          contactType: "customer support",
          availableLanguage: ["English", "Greek", "Russian"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: ["PetPal", "PetPal Cyprus"],
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: ["en", "el", "ru"],
      },
    ],
  };
}

function shopJsonLd() {
  const shopUrl = `${SITE_URL}/shop`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Shop", item: shopUrl },
        ],
      },
      {
        "@type": "Product",
        "@id": `${shopUrl}#gps-tracker`,
        name: "PetPal GPS Pet Tracker",
        description:
          "GPS collar tracker for dogs and cats in Cyprus with live location in PetPal Care Hub, location history and routes, and distance alerts. Requires an active PetPal Plus subscription for live tracking.",
        image: [`${SITE_URL}/images/shop/gps-tracker-v4.png`, OG_IMAGE],
        brand: { "@type": "Brand", name: SITE_NAME },
        sku: "TRACKER_HARDWARE",
        category: "Pet GPS Tracker",
        offers: offer(PRICES.trackerCents, { url: shopUrl, sku: "TRACKER_HARDWARE" }),
      },
      {
        "@type": "Product",
        "@id": `${shopUrl}#plus-monthly`,
        name: "PetPal Plus Monthly",
        description:
          "Monthly PetPal Plus subscription for live GPS pet tracking, location history, and related Care Hub features in Cyprus. Optional GPS tracker and NFC tag add-ons at checkout.",
        brand: { "@type": "Brand", name: SITE_NAME },
        sku: "PETPAL_PLUS_MONTHLY",
        offers: {
          ...offer(PRICES.plusMonthlyCents, {
            url: `${shopUrl}?sku=PETPAL_PLUS_MONTHLY`,
            sku: "PETPAL_PLUS_MONTHLY",
          }),
          priceValidUntil: "2027-12-31",
        },
      },
      {
        "@type": "Product",
        "@id": `${shopUrl}#plus-yearly`,
        name: "PetPal Plus Yearly",
        description:
          "Yearly PetPal Plus plan for Cyprus pet owners. Includes a discounted GPS tracker and a free NFC tag with the first-year purchase; renews at a lower yearly rate.",
        brand: { "@type": "Brand", name: SITE_NAME },
        sku: "PETPAL_PLUS_YEARLY",
        offers: {
          ...offer(PRICES.plusYearlyCents, {
            url: `${shopUrl}?sku=PETPAL_PLUS_YEARLY`,
            sku: "PETPAL_PLUS_YEARLY",
          }),
          priceValidUntil: "2027-12-31",
          description: `First year ${eur(PRICES.plusYearlyCents)} EUR; renews at ${eur(PRICES.plusYearlyRenewalCents)} EUR/year.`,
        },
      },
    ],
  };
}

function nfcJsonLd() {
  const nfcUrl = `${SITE_URL}/shop/nfc`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop` },
          { "@type": "ListItem", position: 3, name: "NFC tags", item: nfcUrl },
        ],
      },
      {
        "@type": "Product",
        "@id": `${nfcUrl}#nfc-tag`,
        name: "PetPal NFC Pet ID Tag",
        description:
          "NFC pet identification tag for dogs and cats. A finder taps the tag with a phone to open the pet’s public digital profile and contact the owner. NFC does not provide live GPS tracking.",
        image: [OG_IMAGE],
        brand: { "@type": "Brand", name: SITE_NAME },
        sku: "NFC_TAG_HARDWARE",
        category: "Pet NFC ID Tag",
        offers: offer(PRICES.nfcCents, { url: nfcUrl, sku: "NFC_TAG_HARDWARE" }),
      },
    ],
  };
}

function nearbyJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Pet-friendly places — ${SITE_NAME}`,
    description:
      "Find pet-friendly places in Cyprus and Greece: veterinary clinics, pet shops, parks, beaches, and cafés on the PetPal Care Hub Nearby map.",
    url: `${SITE_URL}/nearby`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@type": "Thing", name: "Pet-friendly places in Cyprus" },
  };
}

function lostPetJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Lost pet alerts — ${SITE_NAME}`,
    description:
      "Create and browse lost-pet alerts on PetPal Care Hub. Combine photo alerts with GPS tracking and NFC identification to help finders contact owners in Cyprus.",
    url: `${SITE_URL}/lost-pet`,
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };
}

const NAV_LINKS = [
  ["/shop", "Shop GPS trackers & plans"],
  ["/shop/nfc", "NFC tags"],
  ["/nearby", "Nearby pet-friendly places"],
  ["/lost-pet", "Lost pet alerts"],
  ["/install", "Install the app"],
  ["/contact", "Contact"],
  ["/docs", "Help"],
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
];

const PAGES = {
  "/": {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    jsonLd: homeJsonLd,
    heading: SITE_NAME,
    body: [
      "PetPal Care Hub is a pet-care technology platform for pet owners in Cyprus. Track pets with GPS collars, identify them with NFC tags, publish lost-pet alerts, and find pet-friendly places nearby.",
      `The PetPal GPS tracker shows live location in the app, with location history and routes. Live tracking requires an active PetPal Plus subscription. Hardware is available from €${eur(PRICES.trackerCents)}; monthly Plus from €${eur(PRICES.plusMonthlyCents)}; yearly Plus from €${eur(PRICES.plusYearlyCents)} (includes a free NFC tag and discounted tracker on the first year).`,
      `NFC tags do not provide live GPS. A finder taps the tag with a smartphone to open the pet’s public digital profile and contact options set by the owner. Tags are available from €${eur(PRICES.nfcCents)}, or free with Yearly Plus.`,
    ],
  },
  "/shop": {
    title: `Pet GPS Tracker in Cyprus | ${SITE_NAME}`,
    description:
      "Buy PetPal GPS trackers for dogs and cats in Cyprus — live location, history routes, and distance alerts. Monthly from €4.99 or yearly with tracker and NFC options.",
    jsonLd: shopJsonLd,
    heading: "PetPal GPS pet trackers and Plus plans",
    body: [
      `PetPal GPS trackers for dogs and cats in Cyprus show live location in the PetPal Care Hub app, with location history, routes and distance alerts. Tracker hardware is €${eur(PRICES.trackerCents)}.`,
      `PetPal Plus is required for live tracking: Monthly €${eur(PRICES.plusMonthlyCents)}, or Yearly €${eur(PRICES.plusYearlyCents)} for the first year (renews at €${eur(PRICES.plusYearlyRenewalCents)}/year), including a free NFC tag and a discounted tracker.`,
      "Prices are in euro. Live tracking needs an active subscription; recovery of a lost pet is never guaranteed.",
    ],
  },
  "/shop/nfc": {
    title: `NFC Pet ID Tags in Cyprus | ${SITE_NAME}`,
    description:
      "PetPal NFC tags open a digital pet profile when tapped — so a finder can contact you. Not a GPS tracker. Order tags from €9.99 or get one free with Yearly Plus.",
    jsonLd: nfcJsonLd,
    heading: "PetPal NFC pet ID tags",
    body: [
      "A PetPal NFC tag opens the pet’s public digital profile when a finder taps it with a smartphone, with contact options chosen by the owner. NFC tags do not provide live GPS tracking.",
      `Tags cost €${eur(PRICES.nfcCents)}, or one is included free with Yearly Plus.`,
    ],
  },
  "/nearby": {
    title: `Pet-Friendly Places in Cyprus & Greece | ${SITE_NAME}`,
    description:
      "Find vets, pet shops, dog parks, beaches, and pet-friendly cafés near you on PetPal Care Hub. Browse the Nearby map for Cyprus and Greece.",
    jsonLd: nearbyJsonLd,
    heading: "Pet-friendly places in Cyprus and Greece",
    body: [
      "The PetPal Nearby map lists veterinary clinics, pet shops, dog parks, beaches and pet-friendly cafés near your location in Cyprus and Greece.",
    ],
  },
  "/lost-pet": {
    title: `Lost Pet Alerts in Cyprus | ${SITE_NAME}`,
    description:
      "Publish a photo-first lost-pet alert on PetPal Care Hub. Use GPS tracking and NFC ID tags together to help finders reach you — recovery is never guaranteed.",
    jsonLd: lostPetJsonLd,
    heading: "Lost pet alerts in Cyprus",
    body: [
      "Publish a photo-first lost-pet alert on PetPal Care Hub and combine it with GPS tracking and NFC identification to help finders contact you. Recovery is never guaranteed.",
    ],
  },
  "/contact": {
    title: `Contact — ${SITE_NAME}`,
    description: `Contact PetPal Care Hub support at ${CONTACT_EMAIL} for help with GPS trackers, NFC tags, subscriptions, and bookings in Cyprus.`,
    heading: "Contact PetPal Care Hub",
    body: [`Email ${CONTACT_EMAIL} for help with GPS trackers, NFC tags, subscriptions and bookings. ${LEGAL_NAME}, Nicosia, Republic of Cyprus.`],
  },
  "/install": {
    title: `Install App — ${SITE_NAME}`,
    description:
      "Install PetPal Care Hub on your phone — add to home screen on iOS and Android for quick pet tracking and care.",
    heading: "Install PetPal Care Hub",
    body: ["Add PetPal Care Hub to your home screen on iOS or Android for quick access to pet tracking and care."],
  },
  "/docs": {
    title: `Help & Documentation — ${SITE_NAME}`,
    description:
      "Guides for GPS tracking, NFC tags, bookings, shop orders, and account setup on PetPal Care Hub.",
    heading: "PetPal Care Hub help and documentation",
    body: ["Guides for GPS tracking, NFC tags, bookings, shop orders and account setup."],
  },
  "/discover": {
    title: `Discover — ${SITE_NAME}`,
    description: "Explore pet care features, community, and services on PetPal Care Hub.",
    heading: "Discover PetPal Care Hub",
    body: ["Explore pet care features, community and services on PetPal Care Hub."],
  },
  "/privacy": {
    title: `Privacy Policy — ${SITE_NAME}`,
    description:
      "PetPal Care Hub privacy policy — how we handle location data, account information, and cookies.",
    heading: "Privacy Policy",
    body: ["How PetPal Care Hub handles location data, account information and cookies."],
  },
  "/terms": {
    title: `Terms of Service — ${SITE_NAME}`,
    description: "PetPal Care Hub terms of service and conditions of use.",
    heading: "Terms of Service",
    body: ["Terms of service and conditions of use for PetPal Care Hub."],
  },
  "/cookies": {
    title: `Cookie Policy — ${SITE_NAME}`,
    description: "PetPal Care Hub cookie policy — necessary cookies and optional analytics.",
    heading: "Cookie Policy",
    body: ["Necessary cookies and optional analytics used by PetPal Care Hub."],
  },
};

function normalizePath(rawPath) {
  const path = String(rawPath || "/").split("?")[0].split("#")[0] || "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function isNoindexPath(path) {
  return NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Returns { page, index, canonicalPath } for a request path. */
function resolveSeoPage(rawPath) {
  const path = normalizePath(rawPath);
  const page = PAGES[path] || null;
  if (page && !isNoindexPath(path)) {
    return { path, page, index: true, canonicalPath: path };
  }
  return { path, page: null, index: false, canonicalPath: isNoindexPath(path) ? path : "/" };
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function absoluteUrl(path) {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}

function buildHead({ title, description, canonicalUrl, robots, jsonLd }) {
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const u = escapeAttr(canonicalUrl);
  const m = (attr, key, content) =>
    `<meta ${attr}="${key}" content="${content}" data-pp-seo="true"/>`;
  return [
    `<title>${escapeText(title)}</title>`,
    m("name", "description", d),
    m("name", "robots", robots),
    `<link rel="canonical" href="${u}" data-pp-seo="true"/>`,
    m("property", "og:type", "website"),
    m("property", "og:url", u),
    m("property", "og:title", t),
    m("property", "og:description", d),
    m("property", "og:image", escapeAttr(OG_IMAGE)),
    m("property", "og:site_name", escapeAttr(SITE_NAME)),
    m("property", "og:locale", "en_CY"),
    m("name", "twitter:card", "summary_large_image"),
    m("name", "twitter:title", t),
    m("name", "twitter:description", d),
    m("name", "twitter:image", escapeAttr(OG_IMAGE)),
    jsonLd
      ? `<script type="application/ld+json" data-pp-seo="true" data-pp-seo-jsonld="true">${safeJsonLd(jsonLd)}</script>`
      : "",
  ].join("");
}

function buildNoscript(page) {
  const paragraphs = page.body.map((text) => `<p>${escapeText(text)}</p>`).join("");
  const links = NAV_LINKS.map(([href, label]) => `<a href="${href}">${escapeText(label)}</a>`).join(" · ");
  return (
    `<noscript><div style="max-width:720px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.5">` +
    `<h1>${escapeText(page.heading)}</h1>${paragraphs}<p>${links}</p>` +
    `<p>By ${escapeText(LEGAL_NAME)} · Nicosia, Republic of Cyprus · ${escapeText(CONTACT_EMAIL)}</p></div></noscript>`
  );
}

const HEAD_STRIP_PATTERNS = [
  /<title>[\s\S]*?<\/title>/gi,
  /<meta\s+name="description"[^>]*>/gi,
  /<meta\s+name="robots"[^>]*>/gi,
  /<link\s+rel="canonical"[^>]*>/gi,
  /<meta\s+property="og:(?:type|url|title|description|image|site_name|locale)"[^>]*>/gi,
  /<meta\s+name="twitter:(?:card|title|description|image)"[^>]*>/gi,
  /<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,
];

/** Rewrites the built index.html head (and noscript) for the requested path. */
function renderSpaHtml(html, rawPath) {
  const { page, index, canonicalPath } = resolveSeoPage(rawPath);
  const effective = page || {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    heading: SITE_NAME,
    body: PAGES["/"].body,
    jsonLd: null,
  };
  const head = buildHead({
    title: effective.title,
    description: effective.description,
    canonicalUrl: absoluteUrl(canonicalPath),
    robots: index ? "index,follow" : "noindex,follow",
    jsonLd: typeof effective.jsonLd === "function" ? effective.jsonLd() : null,
  });

  let out = html;
  for (const pattern of HEAD_STRIP_PATTERNS) out = out.replace(pattern, "");
  out = out.replace("</head>", `${head}</head>`);
  if (page) {
    out = out.replace(/<noscript>[\s\S]*?<\/noscript>/i, () => buildNoscript(page));
  }
  return { html: out, index };
}

module.exports = {
  PAGES,
  PRICES,
  SITE_URL,
  renderSpaHtml,
  resolveSeoPage,
  normalizePath,
};
