import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getCookieConsent } from '../cookies/cookieConsentStorage';
import {
  enableGoogleAnalytics,
  isGoogleAnalyticsEnabled,
  trackGoogleAnalyticsPageView,
} from './googleAnalytics';

/**
 * Sends GA4 page_view on client-side navigations once analytics consent is granted.
 */
export function AnalyticsPageViews() {
  const location = useLocation();
  const lastPathRef = useRef('');

  useEffect(() => {
    const consent = getCookieConsent();
    if (consent.status !== 'all') return undefined;

    let cancelled = false;
    void enableGoogleAnalytics().then((ok) => {
      if (cancelled || !ok) return;
      const key = `${location.pathname}${location.search}`;
      if (key === lastPathRef.current) return;
      // Skip duplicate of the first automatic page_view from gtag config.
      if (!lastPathRef.current) {
        lastPathRef.current = key;
        return;
      }
      lastPathRef.current = key;
      if (isGoogleAnalyticsEnabled()) {
        trackGoogleAnalyticsPageView(location.pathname, location.search);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  return null;
}
