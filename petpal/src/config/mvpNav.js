import { isBookingBrowseEnabled } from '../bookings/bookingFeature';

/**
 * MVP navigation: hide post-launch features from primary UI.
 * Routes remain reachable via direct URL.
 */
export const MVP_NAV = {
  showPremium: false,
  showCommunity: false,
  showShop: true,
  showDashboard: false,
  showLeaderboard: false,
  showBookings: isBookingBrowseEnabled(),
};
