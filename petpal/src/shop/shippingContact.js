/**
 * @param {{
 *   email?: string,
 *   phone?: string,
 *   firstName?: string,
 *   lastName?: string,
 *   addressLine1?: string,
 *   addressLine2?: string,
 *   postalCode?: string,
 *   city?: string,
 *   country?: string,
 * }} form
 */
export function buildShippingContact(form) {
  const email = String(form.email || '').trim();
  const phone = String(form.phone || '').trim();
  const firstName = String(form.firstName || '').trim();
  const lastName = String(form.lastName || '').trim();
  const addressLine1 = String(form.addressLine1 || '').trim();
  const addressLine2 = String(form.addressLine2 || '').trim();
  const postalCode = String(form.postalCode || '').trim();
  const city = String(form.city || '').trim();
  const country = String(form.country || 'CY').trim().slice(0, 2) || 'CY';
  const receiverName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const addressParts = [
    addressLine1,
    addressLine2,
    [postalCode, city].filter(Boolean).join(' '),
    country === 'CY' ? 'Cyprus' : country,
  ].filter(Boolean);
  return {
    email,
    phone,
    firstName,
    lastName,
    receiverName,
    addressLine1,
    addressLine2,
    postalCode,
    city,
    country,
    address: addressParts.join(', '),
  };
}

/**
 * @param {ReturnType<typeof buildShippingContact>} shipping
 * @param {(key: string) => string} t
 * @returns {string | null}
 */
export function validateShippingForm(shipping, t) {
  if (!shipping.email || !shipping.email.includes('@')) return t('checkoutDetails.errEmail');
  if (!shipping.firstName) return t('checkoutDetails.errFirstName');
  if (!shipping.lastName) return t('checkoutDetails.errLastName');
  if (!shipping.addressLine1) return t('checkoutDetails.errAddress');
  if (!shipping.city) return t('checkoutDetails.errCity');
  if (!shipping.postalCode) return t('checkoutDetails.errPostalCode');
  if (!shipping.phone) return t('checkoutDetails.errPhone');
  return null;
}
