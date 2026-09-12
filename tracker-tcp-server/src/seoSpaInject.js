/**
 * Server-side SPA SEO helpers: per-route meta injection + crawlable HTML.
 * Keeps Google from seeing every URL as a duplicate of the homepage shell.
 */
const fs = require("fs");
const path = require("path");

const CANONICAL_HOST = "petpal.com.cy";
const SITE_URL = `https://${CANONICAL_HOST}`;

const META_CANDIDATES = [
  path.resolve(__dirname, "..", "..", "petpal", "src", "config", "seo-meta.json"),
  path.resolve(__dirname, "..", "..", "petpal", "build", "seo-meta.json"),
  path.resolve(__dirname, "..", "..", "petpal", "public", "seo-meta.json"),
];

let cachedMeta = null;
let cachedMetaMtime = null;

function loadSeoMeta() {
  for (const filePath of META_CANDIDATES) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const stat = fs.statSync(filePath);
      if (cachedMeta && cachedMetaMtime === stat.mtimeMs && cachedMeta.__file === filePath) {
        return cachedMeta;
      }
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      parsed.__file = filePath;
      cachedMeta = parsed;
      cachedMetaMtime = stat.mtimeMs;
      return parsed;
    } catch (err) {
      console.warn(`[seo] Failed to read ${filePath}: ${err.message || err}`);
    }
  }
  return {
    siteUrl: SITE_URL,
    siteName: "PetPal Care Hub",
    defaultTitle: "PetPal Care Hub | Smart Pet Safety & Care",
    defaultDescription:
      "PetPal Care Hub helps pet owners keep their pets safe, connected and cared for through NFC identification, GPS tracking, digital pet profiles and related services.",
    defaultOgImage: `${SITE_URL}/images/home-hero.jpg`,
    routes: [],
  };
}

const NOINDEX_PREFIXES = [
  "/admin",
  "/dashboard",
  "/tracking",
  "/nearby",
  "/profile",
  "/provider",
  "/payment",
  "/bookings",
  "/pets",
  "/premium",
  "/lost-pet",
  "/shelters",
  "/community",
  "/leaderboard",
  "/activity",
  "/inbox",
  "/shop/checkout",
  "/company/apply",
  "/shelter",
];

function normalizePathname(pathname) {
  let p = String(pathname || "/").split("?")[0] || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1) || "/";
  return p || "/";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absoluteUrl(pathname) {
  const p = normalizePathname(pathname);
  return p === "/" ? `${SITE_URL}/` : `${SITE_URL}${p}`;
}

function resolveRouteSeo(pathname) {
  const meta = loadSeoMeta();
  const pathName = normalizePathname(pathname);
  const routes = Array.isArray(meta.routes) ? meta.routes : [];
  const exact = routes.find((r) => r.path === pathName);

  const blocked = NOINDEX_PREFIXES.some(
    (prefix) => pathName === prefix || pathName.startsWith(`${prefix}/`)
  );

  if (blocked) {
    return {
      path: pathName,
      title: meta.siteName || "PetPal Care Hub",
      description: meta.defaultDescription,
      index: false,
      canonical: absoluteUrl(pathName),
      ogImage: meta.defaultOgImage || `${SITE_URL}/images/home-hero.jpg`,
      crawlHtml: "",
      jsonLd: null,
    };
  }

  if (pathName.startsWith("/shop/") && pathName !== "/shop") {
    const shop = routes.find((r) => r.path === "/shop") || {};
    return {
      path: pathName,
      title: shop.title || meta.defaultTitle,
      description: shop.description || meta.defaultDescription,
      index: false,
      canonical: absoluteUrl(pathName),
      ogImage: meta.defaultOgImage || `${SITE_URL}/images/home-hero.jpg`,
      crawlHtml: "",
      jsonLd: null,
    };
  }

  const title = exact?.title || meta.defaultTitle;
  const description = exact?.description || meta.defaultDescription;
  const index = exact ? exact.index !== false : true;

  let jsonLd = null;
  if (pathName === "/" && index) {
    jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_URL}/#organization`,
          name: meta.siteName || "PetPal Care Hub",
          alternateName: ["PetPal", "PetPal Cyprus", "PetPal GPS Tracker"],
          url: SITE_URL,
          email: "info@petpal.com.cy",
          logo: `${SITE_URL}/logo512.png`,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Nicosia",
            addressCountry: "CY",
          },
          parentOrganization: {
            "@type": "Organization",
            name: "Pomware Innovative Solutions Ltd",
          },
        },
        {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: meta.siteName || "PetPal Care Hub",
          alternateName: ["PetPal", "PetPal Cyprus"],
          url: SITE_URL,
          description: meta.defaultDescription,
          publisher: { "@id": `${SITE_URL}/#organization` },
          inLanguage: ["en", "el"],
        },
      ],
    };
  } else if (pathName === "/shop" && index) {
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      url: absoluteUrl("/shop"),
      about: [
        { "@type": "Thing", name: "NFC pet tags" },
        { "@type": "Thing", name: "GPS pet trackers" },
      ],
    };
  } else if (exact?.h1 && index) {
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: absoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: exact.h1,
          item: absoluteUrl(pathName),
        },
      ],
    };
  }

  return {
    path: pathName,
    title,
    description,
    index,
    canonical: absoluteUrl(pathName),
    ogImage: meta.defaultOgImage || `${SITE_URL}/images/home-hero.jpg`,
    crawlHtml: exact?.crawlHtml || "",
    jsonLd,
  };
}

function replaceOrInsertMeta(html, attr, key, content) {
  const safe = escapeHtml(content);
  const re = new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${safe}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function replaceCanonical(html, href) {
  const safe = escapeHtml(href);
  const re = /<link[^>]*rel=["']canonical["'][^>]*>/i;
  const tag = `<link rel="canonical" href="${safe}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function replaceTitle(html, title) {
  const safe = escapeHtml(title);
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safe}</title>`);
  }
  return html.replace(/<\/head>/i, `    <title>${safe}</title>\n  </head>`);
}

function replaceJsonLd(html, data) {
  const without = html.replace(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    ""
  );
  if (!data) return without;
  const script = `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  return without.replace(/<\/head>/i, `    ${script}\n  </head>`);
}

function replaceNoscript(html, crawlHtml, title) {
  const body =
    crawlHtml ||
    `<h1>${escapeHtml(title)}</h1><p>PetPal Care Hub — smart pet safety and care.</p><p><a href="/">Home</a> · <a href="/shop">Shop</a> · <a href="/discover">Discover</a> · <a href="/contact">Contact</a></p>`;
  const block = `<noscript>\n      <div id="pp-seo-noscript" style="max-width:720px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.5">\n        ${body}\n      </div>\n    </noscript>`;
  if (/<noscript>[\s\S]*?<\/noscript>/i.test(html)) {
    return html.replace(/<noscript>[\s\S]*?<\/noscript>/i, block);
  }
  return html.replace(/<div id="root"><\/div>/i, `${block}\n    <div id="root"></div>`);
}

function injectCrawlBlock(html, crawlHtml) {
  if (!crawlHtml) {
    return html.replace(/<div id="pp-seo-crawl"[\s\S]*?<\/div>\s*/i, "");
  }
  const block = `<div id="pp-seo-crawl">${crawlHtml}</div>`;
  if (/<div id="pp-seo-crawl"[\s\S]*?<\/div>/i.test(html)) {
    return html.replace(/<div id="pp-seo-crawl"[\s\S]*?<\/div>/i, block);
  }
  return html.replace(/<div id="root"><\/div>/i, `${block}\n    <div id="root"></div>`);
}

function applySeoToHtml(html, pathname) {
  const seo = resolveRouteSeo(pathname);
  const robots = seo.index ? "index,follow" : "noindex,nofollow";

  let out = html;
  out = replaceTitle(out, seo.title);
  out = replaceOrInsertMeta(out, "name", "description", seo.description);
  out = replaceOrInsertMeta(out, "name", "robots", robots);
  out = replaceCanonical(out, seo.canonical);
  out = replaceOrInsertMeta(out, "property", "og:type", "website");
  out = replaceOrInsertMeta(out, "property", "og:url", seo.canonical);
  out = replaceOrInsertMeta(out, "property", "og:title", seo.title);
  out = replaceOrInsertMeta(out, "property", "og:description", seo.description);
  out = replaceOrInsertMeta(out, "property", "og:image", seo.ogImage);
  out = replaceOrInsertMeta(out, "property", "og:site_name", "PetPal Care Hub");
  out = replaceOrInsertMeta(out, "name", "twitter:card", "summary_large_image");
  out = replaceOrInsertMeta(out, "name", "twitter:title", seo.title);
  out = replaceOrInsertMeta(out, "name", "twitter:description", seo.description);
  out = replaceOrInsertMeta(out, "name", "twitter:image", seo.ogImage);
  out = replaceJsonLd(out, seo.jsonLd);
  out = replaceNoscript(out, seo.crawlHtml, seo.title);
  out = injectCrawlBlock(out, seo.crawlHtml);
  return out;
}

function shouldRedirectWww(hostHeader) {
  const host = String(hostHeader || "")
    .split(":")[0]
    .toLowerCase();
  return host === `www.${CANONICAL_HOST}`;
}

function trailingSlashRedirectTarget(reqPath, originalUrl) {
  const pathname = String(reqPath || "/");
  if (pathname.length <= 1 || !pathname.endsWith("/")) return null;
  if (pathname.startsWith("/api") || pathname.startsWith("/__/")) return null;
  const qsIndex = String(originalUrl || "").indexOf("?");
  const qs = qsIndex >= 0 ? String(originalUrl).slice(qsIndex) : "";
  return `${pathname.replace(/\/+$/, "") || "/"}${qs}`;
}

module.exports = {
  SITE_URL,
  CANONICAL_HOST,
  applySeoToHtml,
  resolveRouteSeo,
  shouldRedirectWww,
  trailingSlashRedirectTarget,
  normalizePathname,
  loadSeoMeta,
};
