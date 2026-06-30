/**
 * Maps PetPal shipping contact + cart lines to JCC register.do customer fields.
 * @see https://gateway.jcc.com.cy/developer/ (register.do — email, postAddress, orderBundle, payer data)
 */

function splitName(full) {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function normalizeJccPhone(raw) {
  return String(raw || '')
    .replace(/[^\d+]/g, '')
    .replace(/^00/, '+')
    .slice(0, 15);
}

function compactObject(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ''));
}

/**
 * @param {object} shipping
 * @param {Array<{ key?: string, title?: string, priceCents?: number, qty?: number, sku?: string }>} [cartItems]
 * @returns {Record<string, string>}
 */
function buildJccRegisterCustomerParams(shipping, cartItems) {
  const email = String(shipping.email || '').trim().slice(0, 40);
  const address = String(shipping.address || '').trim().slice(0, 255);
  const addrLine1 = String(shipping.addressLine1 || address).trim().slice(0, 50);
  const addrLine2 = String(shipping.addressLine2 || '').trim().slice(0, 50);
  const city = String(shipping.city || '').trim().slice(0, 50);
  const postalCode = String(shipping.postalCode || '').trim().slice(0, 16);
  const country = String(shipping.country || 'CY').trim().slice(0, 2) || 'CY';
  const first = String(shipping.firstName || splitName(shipping.receiverName).first).trim().slice(0, 35);
  const last = String(shipping.lastName || splitName(shipping.receiverName).last).trim().slice(0, 64);
  const combinedName = String(shipping.receiverName || `${first} ${last}`.trim()).trim().slice(0, 99);
  const phone = normalizeJccPhone(shipping.phone);
  const postAddress =
    [addrLine1, addrLine2, [postalCode, city].filter(Boolean).join(' '), country === 'CY' ? 'Cyprus' : country]
      .filter(Boolean)
      .join(', ')
      .slice(0, 255) || address;

  /** @type {Record<string, string>} */
  const params = {};

  if (email) params.email = email;
  if (postAddress) params.postAddress = postAddress;
  if (combinedName) params.cardholderName = combinedName.slice(0, 150);
  params.billingAndShippingAddressMatchIndicator = 'Y';

  params.billingPayerData = JSON.stringify(
    compactObject({
      billingAddressLine1: addrLine1,
      billingAddressLine2: addrLine2,
      billingCity: city,
      billingPostalCode: postalCode,
      billingCountry: country,
      payerFirstName: first,
      payerLastName: last,
      payerCombinedName: combinedName,
    })
  );

  params.shippingPayerData = JSON.stringify(
    compactObject({
      shippingAddressLine1: addrLine1,
      shippingAddressLine2: addrLine2,
      shippingCity: city,
      shippingPostalCode: postalCode,
      shippingCountry: country,
      shippingMethodIndicator: '02',
      deliveryTimeframe: '04',
      deliveryEmail: email,
      recipientFirstName: first,
      recipientLastName: last,
      recipientCombinedName: combinedName,
    })
  );

  params.orderPayerData = JSON.stringify(
    compactObject({
      mobilePhone: phone,
      email,
      payerFirstName: first,
      payerLastName: last,
      payerCombinedName: combinedName,
    })
  );

  const lines = Array.isArray(cartItems) ? cartItems : [];
  if (lines.length) {
    params.orderBundle = JSON.stringify({
      orderCreationDate: new Date().toISOString().slice(0, 19),
      customerDetails: compactObject({
        fullName: combinedName,
        contact: email,
        email,
        phone,
        deliveryInfo: compactObject({
          deliveryType: 'courier',
          country,
          city,
          postAddress,
        }),
      }),
      cartItems: {
        items: lines.map((row, idx) => {
          const qty = Math.max(1, Number(row.qty) || 1);
          const unitCents = Math.max(0, Number(row.priceCents) || 0);
          return {
            positionId: idx + 1,
            name: String(row.title || 'Item').slice(0, 255),
            itemPrice: unitCents,
            itemAmount: unitCents * qty,
            itemCurrency: 978,
            quantity: { value: qty, measure: 'pcs' },
            itemCode: String(row.sku || row.key || idx + 1).slice(0, 100),
          };
        }),
      },
    });
  }

  return params;
}

/**
 * @param {string} frontendUrl
 * @returns {string}
 */
function buildJccJsonParams(frontendUrl) {
  const base = String(frontendUrl || '').replace(/\/$/, '');
  return JSON.stringify({
    backToShopUrl: `${base}/shop`,
    backToShopName: 'Back to PetPal',
    termsUrl: `${base}/terms`,
    privacyUrl: `${base}/privacy`,
    merchantSiteUrl: base,
  });
}

module.exports = { buildJccRegisterCustomerParams, buildJccJsonParams };
