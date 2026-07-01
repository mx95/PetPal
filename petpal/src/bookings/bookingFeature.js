/**
 * Booking nav/discover visibility — on by default.
 * The /bookings hub route stays available; this flag gates nav links and discover CTAs.
 * Set REACT_APP_BOOKINGS_BROWSE=0 to hide bookings from primary navigation.
 */
export function isBookingBrowseEnabled() {
  return String(process.env.REACT_APP_BOOKINGS_BROWSE ?? '1').trim() !== '0';
}

/** Direct appointment URLs (/bookings/provider/.../book/...) are always routable. */
export function isBookingDirectAccessEnabled() {
  return true;
}
