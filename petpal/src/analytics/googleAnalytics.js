/**
 * Google Analytics 4 (gtag.js) — loaded only after cookie consent allows analytics.
 * Measurement ID from the GA setup UI (Install manually).
 */

export const GA_MEASUREMENT_ID = String(
  process.env.REACT_APP_GA_MEASUREMENT_ID || 'G-T0V10MEL5V'
).trim();

export function isGoogleAnalyticsConfigured() {
  return /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID);
}

let enabled = false;
let loadPromise = null;

function injectGtagScript(id) {
  if (typeof document === 'undefined') return;
  if (document.getElementById('pp-ga-gtag')) return;

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }

  const script = document.createElement('script');
  script.id = 'pp-ga-gtag';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', id, {
    anonymize_ip: true,
    send_page_view: true,
  });
}

/** Load gtag after the user opts into analytics cookies. */
export function enableGoogleAnalytics() {
  if (!isGoogleAnalyticsConfigured()) return Promise.resolve(false);
  if (enabled) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    try {
      injectGtagScript(GA_MEASUREMENT_ID);
      enabled = true;
      resolve(true);
    } catch {
      loadPromise = null;
      resolve(false);
    }
  });
  return loadPromise;
}

export function isGoogleAnalyticsEnabled() {
  return enabled;
}

/** SPA route changes — call after consent when the location changes. */
export function trackGoogleAnalyticsPageView(pathname, search = '') {
  if (!enabled || typeof window.gtag !== 'function') return;
  const pagePath = `${pathname || '/'}${search || ''}`;
  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
}
