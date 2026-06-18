/**
 * Booking nav/discover visibility — off by default.
 * The /bookings hub route stays available; this flag only gates nav links and discover CTAs.
 * Set REACT_APP_BOOKINGS_BROWSE=1 to show bookings in navigation and discover.
 */
export function isBookingBrowseEnabled() {
  return String(process.env.REACT_APP_BOOKINGS_BROWSE ?? '0').trim() === '1';
}

/** Direct appointment URLs (/bookings/provider/.../book/...) are always routable. */
export function isBookingDirectAccessEnabled() {
  return true;
}
