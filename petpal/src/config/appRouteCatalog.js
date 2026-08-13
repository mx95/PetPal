/**
 * Full route & API catalog for /docs (MVP + hidden pages).
 * @typedef {{ path: string, labelKey: string, descKey: string, auth: 'public'|'auth'|'admin', mvpNav: boolean }} AppRoute
 */

/** @type {AppRoute[]} */
export const APP_ROUTE_CATALOG = [
  { path: '/', labelKey: 'docs.route.home.label', descKey: 'docs.route.home.desc', auth: 'public', mvpNav: true },
  { path: '/discover', labelKey: 'docs.route.discover.label', descKey: 'docs.route.discover.desc', auth: 'public', mvpNav: false },
  { path: '/login', labelKey: 'docs.route.login.label', descKey: 'docs.route.login.desc', auth: 'public', mvpNav: true },
  { path: '/forgot-password', labelKey: 'docs.route.forgotPassword.label', descKey: 'docs.route.forgotPassword.desc', auth: 'public', mvpNav: false },
  { path: '/contact', labelKey: 'docs.route.contact.label', descKey: 'docs.route.contact.desc', auth: 'public', mvpNav: true },
  { path: '/register', labelKey: 'docs.route.register.label', descKey: 'docs.route.register.desc', auth: 'public', mvpNav: true },
  { path: '/pets', labelKey: 'docs.route.pets.label', descKey: 'docs.route.pets.desc', auth: 'auth', mvpNav: true },
  { path: '/tracking', labelKey: 'docs.route.tracking.label', descKey: 'docs.route.tracking.desc', auth: 'auth', mvpNav: true },
  { path: '/nearby', labelKey: 'docs.route.nearby.label', descKey: 'docs.route.nearby.desc', auth: 'auth', mvpNav: true },
  { path: '/bookings', labelKey: 'docs.route.bookings.label', descKey: 'docs.route.bookings.desc', auth: 'auth', mvpNav: true },
  { path: '/bookings/provider/:providerId', labelKey: 'docs.route.providerProfile.label', descKey: 'docs.route.providerProfile.desc', auth: 'auth', mvpNav: true },
  { path: '/bookings/provider/:providerId/book/:serviceId', labelKey: 'docs.route.bookService.label', descKey: 'docs.route.bookService.desc', auth: 'auth', mvpNav: true },
  { path: '/profile', labelKey: 'docs.route.profile.label', descKey: 'docs.route.profile.desc', auth: 'auth', mvpNav: true },
  { path: '/inbox', labelKey: 'docs.route.inbox.label', descKey: 'docs.route.inbox.desc', auth: 'auth', mvpNav: true },
  { path: '/provider', labelKey: 'docs.route.provider.label', descKey: 'docs.route.provider.desc', auth: 'auth', mvpNav: true },
  { path: '/company/apply', labelKey: 'docs.route.companyApply.label', descKey: 'docs.route.companyApply.desc', auth: 'auth', mvpNav: false },
  { path: '/pet/:id', labelKey: 'docs.route.publicPet.label', descKey: 'docs.route.publicPet.desc', auth: 'public', mvpNav: false },
  { path: '/dashboard', labelKey: 'docs.route.dashboard.label', descKey: 'docs.route.dashboard.desc', auth: 'auth', mvpNav: false },
  { path: '/community', labelKey: 'docs.route.community.label', descKey: 'docs.route.community.desc', auth: 'auth', mvpNav: false },
  { path: '/leaderboard', labelKey: 'docs.route.leaderboard.label', descKey: 'docs.route.leaderboard.desc', auth: 'auth', mvpNav: false },
  { path: '/shop', labelKey: 'docs.route.shop.label', descKey: 'docs.route.shop.desc', auth: 'auth', mvpNav: true },
  { path: '/payment/success', labelKey: 'docs.route.paymentSuccess.label', descKey: 'docs.route.paymentSuccess.desc', auth: 'auth', mvpNav: false },
  { path: '/premium', labelKey: 'docs.route.premium.label', descKey: 'docs.route.premium.desc', auth: 'auth', mvpNav: false },
  { path: '/premium/lost', labelKey: 'docs.route.premiumLost.label', descKey: 'docs.route.premiumLost.desc', auth: 'auth', mvpNav: false },
  { path: '/premium/stray', labelKey: 'docs.route.premiumStray.label', descKey: 'docs.route.premiumStray.desc', auth: 'auth', mvpNav: false },
  { path: '/premium/breeding', labelKey: 'docs.route.premiumBreeding.label', descKey: 'docs.route.premiumBreeding.desc', auth: 'auth', mvpNav: false },
  { path: '/lost-pet', labelKey: 'docs.route.lostRedirect.label', descKey: 'docs.route.lostRedirect.desc', auth: 'public', mvpNav: false },
  { path: '/stray-adoption', labelKey: 'docs.route.strayRedirect.label', descKey: 'docs.route.strayRedirect.desc', auth: 'public', mvpNav: false },
  { path: '/admin', labelKey: 'docs.route.admin.label', descKey: 'docs.route.admin.desc', auth: 'admin', mvpNav: false },
  { path: '/admin/company-approvals', labelKey: 'docs.route.adminCompanies.label', descKey: 'docs.route.adminCompanies.desc', auth: 'admin', mvpNav: false },
  { path: '/admin/tracker', labelKey: 'docs.route.adminTracker.label', descKey: 'docs.route.adminTracker.desc', auth: 'admin', mvpNav: false },
  { path: '/admin/devices', labelKey: 'docs.route.adminDevices.label', descKey: 'docs.route.adminDevices.desc', auth: 'admin', mvpNav: false },
  { path: '/admin/broadcast', labelKey: 'docs.route.adminBroadcast.label', descKey: 'docs.route.adminBroadcast.desc', auth: 'admin', mvpNav: false },
  { path: '/admin/support', labelKey: 'docs.route.adminSupport.label', descKey: 'docs.route.adminSupport.desc', auth: 'admin', mvpNav: false },
  { path: '/docs', labelKey: 'docs.route.docs.label', descKey: 'docs.route.docs.desc', auth: 'public', mvpNav: true },
  { path: '/privacy', labelKey: 'docs.route.privacy.label', descKey: 'docs.route.privacy.desc', auth: 'public', mvpNav: true },
  { path: '/terms', labelKey: 'docs.route.terms.label', descKey: 'docs.route.terms.desc', auth: 'public', mvpNav: true },
  { path: '/cookies', labelKey: 'docs.route.cookies.label', descKey: 'docs.route.cookies.desc', auth: 'public', mvpNav: true },
];

/** @type {{ id: string, titleKey: string, introKey: string, baseKey: string, endpoints: { method: string, path: string, descKey: string }[] }[]} */
export const APP_API_CATALOG = [
  {
    id: 'tracker-app',
    titleKey: 'docs.api.trackerApp.title',
    introKey: 'docs.api.trackerApp.intro',
    baseKey: 'docs.api.trackerApp.base',
    endpoints: [
      { method: 'GET', path: '/api/app/devices', descKey: 'docs.api.trackerApp.devices' },
      { method: 'GET', path: '/api/app/devices/:imei', descKey: 'docs.api.trackerApp.deviceOne' },
      { method: 'GET', path: '/api/app/position?deviceId={imei}', descKey: 'docs.api.trackerApp.position' },
      { method: 'GET', path: '/api/app/history?deviceId={imei}&limit=&from=&to=', descKey: 'docs.api.trackerApp.history' },
    ],
  },
  {
    id: 'tracker-admin',
    titleKey: 'docs.api.trackerAdmin.title',
    introKey: 'docs.api.trackerAdmin.intro',
    baseKey: 'docs.api.trackerAdmin.base',
    endpoints: [
      { method: 'GET', path: '/api/admin/devices', descKey: 'docs.api.trackerAdmin.list' },
      { method: 'GET', path: '/api/admin/devices/:imei', descKey: 'docs.api.trackerAdmin.one' },
      { method: 'PATCH', path: '/api/admin/devices/:imei', descKey: 'docs.api.trackerAdmin.patch' },
    ],
  },
  {
    id: 'tracker-gpspos',
    titleKey: 'docs.api.trackerGpspos.title',
    introKey: 'docs.api.trackerGpspos.intro',
    baseKey: 'docs.api.trackerGpspos.base',
    endpoints: [
      { method: 'GET', path: '/api/gpspos', descKey: 'docs.api.trackerGpspos.index' },
      { method: 'POST', path: '/api/gpspos/sync', descKey: 'docs.api.trackerGpspos.sync' },
      { method: 'POST', path: '/api/gpspos/sync/history', descKey: 'docs.api.trackerGpspos.history' },
    ],
  },
  {
    id: 'tracker-cmd',
    titleKey: 'docs.api.trackerCmd.title',
    introKey: 'docs.api.trackerCmd.intro',
    baseKey: 'docs.api.trackerCmd.base',
    endpoints: [
      { method: 'GET', path: '/api/tracker/commands/pending/:imei', descKey: 'docs.api.trackerCmd.pending' },
      { method: 'POST', path: '/api/tracker/commands/ip-transfer', descKey: 'docs.api.trackerCmd.ipTransfer' },
      { method: 'POST', path: '/api/tracker/commands/tracking', descKey: 'docs.api.trackerCmd.tracking' },
      { method: 'POST', path: '/api/tracker/commands/queue', descKey: 'docs.api.trackerCmd.queue' },
      { method: 'POST', path: '/api/tracker/commands/apn', descKey: 'docs.api.trackerCmd.apn' },
    ],
  },
  {
    id: 'bff',
    titleKey: 'docs.api.bff.title',
    introKey: 'docs.api.bff.intro',
    baseKey: 'docs.api.bff.base',
    endpoints: [
      { method: 'GET', path: '/position?deviceId={id}', descKey: 'docs.api.bff.position' },
    ],
  },
  {
    id: 'vendor',
    titleKey: 'docs.api.vendor.title',
    introKey: 'docs.api.vendor.intro',
    baseKey: 'docs.api.vendor.base',
    endpoints: [
      { method: 'GET', path: '/api/positions?deviceId={id}&limit=', descKey: 'docs.api.vendor.history' },
    ],
  },
  {
    id: 'firebase',
    titleKey: 'docs.api.firebase.title',
    introKey: 'docs.api.firebase.intro',
    baseKey: 'docs.api.firebase.base',
    endpoints: [
      { method: '—', path: 'Firestore: users, pets, bookings, discoverPosts, …', descKey: 'docs.api.firebase.firestore' },
      { method: '—', path: 'Firebase Auth (email/password)', descKey: 'docs.api.firebase.auth' },
      { method: '—', path: 'Firebase Storage (pet photos)', descKey: 'docs.api.firebase.storage' },
    ],
  },
];
