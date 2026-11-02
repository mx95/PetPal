/**
 * Google Analytics 4 (gtag.js) with Consent Mode.
 * The tag is installed in public/index.html so Google can detect it;
 * analytics_storage stays denied until cookie consent grants it.
 */

export const GA_MEASUREMENT_ID = String(
  process.env.REACT_APP_GA_MEASUREMENT_ID || 'G-T0V10MEL5V'
).trim();

export function isGoogleAnalyticsConfigured() {
  return /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID);
}

let enabled = false;

function ensureGtag() {
  if (typeof window === 'undefined') return false;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }
  return true;
}

/** Grant analytics_storage after the user opts into analytics cookies. */
export function enableGoogleAnalytics() {
  if (!isGoogleAnalyticsConfigured()) return Promise.resolve(false);
  if (!ensureGtag()) return Promise.resolve(false);
  try {
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
    });
    enabled = true;
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

/** Keep / re-deny analytics when the user chooses essential cookies only. */
export function disableGoogleAnalytics() {
  if (!ensureGtag()) return;
  try {
    window.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  } catch {
    // ignore
  }
  enabled = false;
}

export function isGoogleAnalyticsEnabled() {
  return enabled;
}

/** SPA route changes — only meaningful once analytics_storage is granted. */
export function trackGoogleAnalyticsPageView(pathname, search = '') {
  if (!enabled || typeof window.gtag !== 'function') return;
  const pagePath = `${pathname || '/'}${search || ''}`;
  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
}
