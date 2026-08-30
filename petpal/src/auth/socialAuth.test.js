jest.mock('../firebase', () => ({
  auth: {
    currentUser: null,
    app: { options: { authDomain: 'petpal.com.cy' } },
  },
  getDb: jest.fn(),
  isFirebaseConfigured: jest.fn(() => false),
}));

import {
  isAuthDomainFirstParty,
  isInstalledWebApp,
  isMobileBrowser,
  preferSocialRedirect,
} from './socialAuth';

describe('socialAuth redirect strategy', () => {
  const originalLocation = window.location;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    delete window.navigator.standalone;
    window.matchMedia = originalMatchMedia;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  function mockHost(hostname) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname, host: hostname, href: `https://${hostname}/login` },
    });
  }

  it('detects mobile browsers', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    expect(isMobileBrowser()).toBe(true);
  });

  it('prefers redirect on mobile when authDomain is first-party', () => {
    mockHost('petpal.com.cy');
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    expect(isAuthDomainFirstParty()).toBe(true);
    expect(preferSocialRedirect()).toBe(true);
  });

  it('uses popup on desktop with cross-origin authDomain', () => {
    const { auth } = require('../firebase');
    auth.app.options.authDomain = 'petpal-aecda.firebaseapp.com';
    mockHost('petpal.com.cy');
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });
    expect(isAuthDomainFirstParty()).toBe(false);
    expect(preferSocialRedirect()).toBe(false);
  });

  it('prefers redirect for installed PWA when authDomain is first-party', () => {
    const { auth } = require('../firebase');
    auth.app.options.authDomain = 'petpal.com.cy';
    mockHost('petpal.com.cy');
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    expect(isInstalledWebApp()).toBe(true);
    expect(preferSocialRedirect()).toBe(true);
  });
});
