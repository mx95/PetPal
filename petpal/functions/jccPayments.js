/**
 * JCC Payment Gateway — server-side only (see https://gateway.jcc.com.cy/developer/ ).
 * Uses redirect / hosted payment page: register.do → formUrl → returnUrl → getOrderStatusExtended.do.
 * Recurring charges: register.do (new order) + paymentOrderBinding.do (bindingId + tii=U).
 * Scheduled: billingRenewal (daily 05:00), expireProviderBoosts (daily 05:15) clears expired JCC boosts.
 *
 * Configure (production): firebase functions:config:set
 *   jcc.user="PetPal-api"
 *   jcc.pass="YOUR_API_PASSWORD"
 *   jcc.rest_base="https://gateway-test.jcc.com.cy/payment/rest"
 *   jcc.return_url="https://europe-west1-<PROJECT>.cloudfunctions.net/jccPaymentReturn"
 *   jcc.frontend_url="https://your-petpal-host" (no trailing slash; must match the SPA origin users open)
 *
 * Return flow: register.do sets returnUrl to jccPaymentReturn?orderNumber=<session id>. After pay, JCC
 * redirects there with the same orderNumber plus gateway params (orderId / mdOrder). jccPaymentReturn
 * verifies the session, then 302s to {frontend_url}/payment/success?checkout=success&sku=…&orderNumber=…
 *
 * Do not commit real passwords. Test base URL from JCC docs:
 * https://gateway-test.jcc.com.cy/payment/rest/
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

function getCfg(path, fallback = null) {
  try {
    const cfg = functions.config && functions.config();
    if (!cfg) return fallback;
    return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), cfg) ?? fallback;
  } catch {
    return fallback;
  }
}

function jccEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

function normalizeUrlBase(raw, fallback) {
  const s = String(raw ?? fallback ?? '')
    .trim()
    .replace(/\/$/, '');
  return s;
}

function jccCredentials() {
  const userName = (jccEnv('JCC_USER') || getCfg('jcc.user') || '').trim();
  const password = (jccEnv('JCC_PASS') || getCfg('jcc.pass') || '').trim();
  const restBase = normalizeUrlBase(
    jccEnv('JCC_REST_BASE') || getCfg('jcc.rest_base'),
    'https://gateway-test.jcc.com.cy/payment/rest'
  );
  const returnUrl = (jccEnv('JCC_RETURN_URL') || getCfg('jcc.return_url') || '').trim();
  const frontendUrl = normalizeUrlBase(jccEnv('JCC_FRONTEND_URL') || getCfg('jcc.frontend_url'), 'http://localhost:3000');
  if (!userName || !password) {
    throw new Error('JCC credentials missing: set jcc.user / jcc.pass (Functions config) or JCC_USER / JCC_PASS env.');
  }
  if (!returnUrl) {
    throw new Error('JCC return URL missing: set jcc.return_url to this function’s public HTTPS URL (jccPaymentReturn).');
  }
  return { userName, password, restBase, returnUrl, frontendUrl };
}

const BOOST_SKUS = new Set([
  'STORE_BOOST_MONTHLY',
  'STORE_BOOST_NEARBY_MONTHLY',
  'STORE_BOOST_BOOKINGS_MONTHLY',
]);

async function grantProviderBoostAfterPayment(db, companyId, sku) {
  const until = new Date();
  until.setDate(until.getDate() + 32);
  const tsUntil = admin.firestore.Timestamp.fromDate(until);
  const base = {
    boostSource: 'jcc_shop',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (sku === 'STORE_BOOST_NEARBY_MONTHLY') {
    await db.collection('providers').doc(companyId).set(
      {
        ...base,
        boostNearbyEnabled: true,
        boostNearbyUntil: tsUntil,
        sponsored: true,
      },
      { merge: true }
    );
    return;
  }
  if (sku === 'STORE_BOOST_BOOKINGS_MONTHLY') {
    await db.collection('providers').doc(companyId).set(
      {
        ...base,
        boostBookingsEnabled: true,
        boostBookingsUntil: tsUntil,
        recommended: true,
      },
      { merge: true }
    );
    return;
  }
  await db.collection('providers').doc(companyId).set(
    {
      ...base,
      boostEnabled: true,
      boostNearbyEnabled: true,
      boostBookingsEnabled: true,
      sponsored: true,
      recommended: true,
      boostUntil: tsUntil,
      boostNearbyUntil: tsUntil,
      boostBookingsUntil: tsUntil,
    },
    { merge: true }
  );
}

async function jccPost(restBase, method, params) {
  const url = `${restBase}/${method}`;
  const body = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item) => body.append(k, String(item)));
    else body.append(k, String(v));
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`JCC non-JSON response (${method}): ${text.slice(0, 200)}`);
  }
  return json;
}

function jccOk(json) {
  if (!json || typeof json !== 'object') return false;
  if (json.error === true) return false;
  if (json.success === true) return true;
  const ec = json.errorCode;
  if (ec === 0 || ec === '0' || Number(ec) === 0) return true;
  return false;
}

/**
 * register.do (and similar) often succeeds with only `orderId` + `formUrl` and no `errorCode`
 * (see JCC redirect integration docs).
 */
function jccRegisterDoSucceeded(reg) {
  if (!reg || typeof reg !== 'object') return false;
  if (reg.error === true) return false;
  const ec = reg.errorCode;
  if (ec !== undefined && ec !== null && ec !== '') {
    const n = Number(ec);
    const ok = ec === 0 || ec === '0' || (Number.isFinite(n) && n === 0);
    if (!ok) return false;
  }
  return Boolean(reg.orderId && reg.formUrl);
}

function paidOrderStatus(json) {
  const s = json?.orderStatus;
  const n = typeof s === 'string' ? Number(s) : s;
  return n === 1 || n === 2;
}

function ensureAdmin() {
  try {
    admin.app();
    return;
  } catch {
    /* default app missing — do not rely on admin.apps.length (can disagree with admin.app() on some runtimes). */
  }
  try {
    admin.initializeApp();
  } catch (e) {
    if (e && e.code === 'app/duplicate-app') return;
    throw e;
  }
}

function uniqueOrderNumber(prefix) {
  const safe = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-zA-Z0-9 _\-!`@#$%^&*()+=\[\]{};':",.<>?/|\\˜]/g, '');
  return safe.slice(0, 36);
}

const { SKUS, PLUS_SKUS, resolveCheckoutPricing, resolveMarketplaceCartPricing, validateMarketplaceCartLines, PRICES } = require('./shopPricing');
const { buildJccRegisterCustomerParams, buildJccJsonParams } = require('./jccRegisterExtras');
const { appendOrderTrackerSubscriptions } = require('./subscriptionImei');
const {
  normalizeShipping,
  validateShipping,
  createPendingOrder,
  updateOrderStatus,
  buildSubscriptionId,
  recordCustomerPaymentIndex,
  omitUndefined,
} = require('./orderRecords');

function nextRenewalDate(from, sku) {
  const next = new Date(from);
  if (sku === 'PETPAL_PLUS_YEARLY') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/** One monthly subscription per tracker — stored under users/{uid}/trackerSubscriptions/{subscriptionId}. */
async function createMonthlyTrackerSubscription(db, payload) {
  const {
    uid,
    paymentId,
    subPaymentId,
    orderNumber,
    sku,
    renewalCents,
    currency,
    bindingId,
    includeTracker,
    includeNfc,
    nfcPetIds,
    nextRenewalAt,
  } = payload;
  const parentPaymentId = String(paymentId || orderNumber || '').slice(0, 36);
  const subId = Number(subPaymentId) || 1;
  const subscriptionId =
    String(orderNumber || '').trim() || buildSubscriptionId(parentPaymentId, subId);
  const petIds = Array.isArray(nfcPetIds) ? nfcPetIds.map(String).filter(Boolean).slice(0, 20) : [];
  await db
    .collection('users')
    .doc(uid)
    .collection('trackerSubscriptions')
    .doc(subscriptionId)
    .set({
      uid,
      subscriptionId,
      paymentId: parentPaymentId,
      subPaymentId: subId,
      sku,
      amountCents: renewalCents,
      currency,
      bindingId: bindingId || null,
      clientId: uid,
      status: 'active',
      includeTracker: Boolean(includeTracker),
      includeNfc: Boolean(includeNfc),
      nfcPetIds: petIds.length ? petIds : null,
      trackerImei: null,
      petId: null,
      petName: null,
      nextRenewalAt,
      orderNumber: parentPaymentId,
      createdFromOrderNumber: parentPaymentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  await db
    .collection('billingSubscriptions')
    .doc(`${uid}_PETPAL_PLUS_MONTHLY`)
    .set(
      {
        uid,
        sku: 'PETPAL_PLUS_MONTHLY',
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

async function userHasActivePlus(db, uid) {
  const trackerSnap = await db
    .collection('users')
    .doc(uid)
    .collection('trackerSubscriptions')
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (!trackerSnap.empty) return true;
  for (const plusSku of PLUS_SKUS) {
    const plusSnap = await db.collection('billingSubscriptions').doc(`${uid}_${plusSku}`).get();
    const plusD = plusSnap.data();
    if (plusSnap.exists && plusD?.status === 'active') return true;
  }
  return false;
}

async function renewSubscriptionDoc(db, docRef, sub, creds) {
  const { userName, password, restBase, returnUrl } = creds;
  const { uid, sku, amountCents, currency, bindingId, clientId } = sub;
  if (!bindingId || !uid || !sku) return;
  const orderNumber = uniqueOrderNumber('RENEW');
  const renewRef = db.collection('paymentSessions').doc(orderNumber);
  await renewRef.set({
    orderNumber,
    uid,
    sku,
    saveCard: false,
    kind: 'renewal',
    subscriptionDocPath: docRef.path,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'pending_register',
  });

  try {
    const reg = await jccPost(restBase, 'register.do', {
      userName,
      password,
      orderNumber,
      amount: String(amountCents),
      currency: currency || '978',
      returnUrl: `${String(returnUrl).replace(/\/$/, '')}?orderNumber=${encodeURIComponent(orderNumber)}`,
      failUrl: `${creds.frontendUrl}/shop?checkout=fail`,
      description: `Renewal ${sku}`,
      language: 'en',
      clientId: clientId || uid,
    });
    if (!jccRegisterDoSucceeded(reg)) {
      await renewRef.set({ status: 'register_failed', raw: reg }, { merge: true });
      return;
    }
    const pay = await jccPost(restBase, 'paymentOrderBinding.do', {
      userName,
      password,
      mdOrder: reg.orderId,
      bindingId,
      tii: 'U',
      language: 'en',
    });
    if (!jccOk(pay)) {
      await renewRef.set({ status: 'binding_pay_failed', raw: pay }, { merge: true });
      await docRef.set({ status: 'past_due', lastError: pay?.errorMessage || pay?.error }, { merge: true });
      return;
    }
    const st = await jccPost(restBase, 'getOrderStatusExtended.do', {
      userName,
      password,
      orderId: reg.orderId,
      language: 'en',
    });
    if (!jccOk(st) || !paidOrderStatus(st)) {
      await renewRef.set({ status: 'not_paid_after_binding', raw: st }, { merge: true });
      await docRef.set({ status: 'past_due' }, { merge: true });
      return;
    }
    const next = nextRenewalDate(new Date(), sku);
    await docRef.set(
      {
        status: 'active',
        nextRenewalAt: admin.firestore.Timestamp.fromDate(next),
        lastRenewedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await renewRef.set({ status: 'paid_renewal', jccOrderId: reg.orderId }, { merge: true });

    if (BOOST_SKUS.has(sku)) {
      await grantProviderBoostAfterPayment(db, uid, sku);
    }
  } catch (e) {
    await renewRef.set({ status: 'renewal_exception', error: e?.message || String(e) }, { merge: true });
  }
}

async function grantTrackerEntitlement(db, uid, orderNumber, sourceSku) {
  const ref = db.collection('users').doc(uid).collection('shopEntitlements').doc('collar');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.data() || {};
    const prevQty = Number(cur.quantity);
    const baseQty =
      Number.isFinite(prevQty) && prevQty > 0 ? prevQty : cur.status === 'active' ? 1 : 0;
    tx.set(
      ref,
      {
        status: 'active',
        quantity: baseQty + 1,
        sku: 'TRACKER_HARDWARE',
        sourceSku,
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastPurchaseAt: admin.firestore.FieldValue.serverTimestamp(),
        sessionOrderNumber: orderNumber,
      },
      { merge: true }
    );
  });
  await incrementShopPublicStats(db, { totalCollarPurchases: 1 });
}

async function grantNfcEntitlement(db, uid, orderNumber, sourceSku, petIds = []) {
  const ids = Array.isArray(petIds) ? petIds.map(String).filter(Boolean) : [];
  await db
    .collection('users')
    .doc(uid)
    .collection('shopEntitlements')
    .doc('nfcTag')
    .set(
      {
        status: 'active',
        sku: 'NFC_TAG_HARDWARE',
        sourceSku,
        petIds: ids.length ? ids : admin.firestore.FieldValue.delete(),
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
        sessionOrderNumber: orderNumber,
      },
      { merge: true }
    );
}

function redirect(res, url) {
  res.set('Cache-Control', 'no-store');
  res.redirect(302, url);
}

/**
 * Public counters for Shop (read by clients; only Cloud Functions write).
 * @param {*} db Firestore instance
 * @param {Record<string, number>} increments
 */
async function incrementShopPublicStats(db, increments) {
  const ref = db.collection('shopStats').doc('public');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.data() || {};
    const next = { ...cur, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    for (const [key, delta] of Object.entries(increments)) {
      const base = Number(cur[key] ?? 0);
      const d = Number(delta);
      next[key] = (Number.isFinite(base) ? base : 0) + (Number.isFinite(d) ? d : 0);
    }
    tx.set(ref, next, { merge: true });
  });
}

/** Fulfill one mixed-cart line after successful MARKETPLACE_CART payment. */
async function fulfillMarketplaceCartLine(db, uid, parentOrderNumber, line, idx, bindingId, subPaymentId) {
  const sku = line.sku;
  if (!sku || !SKUS[sku]) return;
  const catalog = SKUS[sku];
  const nfcPetIds = Array.isArray(line.nfcPetIds) ? line.nfcPetIds : [];
  const qty = Math.max(1, Number(line.qty) || 1);

  if (catalog.recurring && PLUS_SKUS.has(sku)) {
    const next = nextRenewalDate(new Date(), sku);
    const renewalCents =
      sku === 'PETPAL_PLUS_MONTHLY'
        ? PRICES.PLUS_MONTHLY_CENTS
        : sku === 'PETPAL_PLUS_YEARLY'
          ? PRICES.PLUS_YEARLY_RENEWAL_CENTS
          : catalog.amountCents;
    if (sku === 'PETPAL_PLUS_MONTHLY' && subPaymentId) {
      const subscriptionId = buildSubscriptionId(parentOrderNumber, subPaymentId);
      await createMonthlyTrackerSubscription(db, {
        uid,
        paymentId: parentOrderNumber,
        subPaymentId,
        orderNumber: subscriptionId,
        sku,
        renewalCents,
        currency: catalog.currency,
        bindingId,
        includeTracker: line.includeTracker,
        includeNfc: line.includeNfc,
        nfcPetIds: line.nfcPetIds,
        nextRenewalAt: admin.firestore.Timestamp.fromDate(next),
      });
      await appendOrderTrackerSubscriptions(db, parentOrderNumber, uid, [
        {
          paymentId: parentOrderNumber,
          subPaymentId,
          subscriptionId,
          includeTracker: line.includeTracker,
          includeNfc: line.includeNfc,
          nfcPetIds: line.nfcPetIds,
        },
      ]);
    } else if (sku === 'PETPAL_PLUS_YEARLY') {
      await db
        .collection('billingSubscriptions')
        .doc(`${uid}_${sku}`)
        .set(
          {
            uid,
            sku,
            amountCents: renewalCents,
            currency: catalog.currency,
            bindingId: bindingId || null,
            clientId: uid,
            status: 'active',
            nextRenewalAt: admin.firestore.Timestamp.fromDate(next),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }
  }

  for (let q = 0; q < qty; q += 1) {
    const grantOrder =
      qty > 1
        ? `${parentOrderNumber}-L${idx + 1}-q${q + 1}`.slice(0, 36)
        : subPaymentId
          ? buildSubscriptionId(parentOrderNumber, subPaymentId)
          : `${parentOrderNumber}-L${idx + 1}`.slice(0, 36);
    if (line.includeTracker && sku === 'PETPAL_PLUS_MONTHLY') {
      await grantTrackerEntitlement(db, uid, grantOrder, sku);
      await incrementShopPublicStats(db, { totalCollarPurchases: 1, activeSubscriptionsWithCollar: 1 });
    }
    if (line.includeNfc && sku === 'PETPAL_PLUS_MONTHLY') {
      await grantNfcEntitlement(db, uid, grantOrder, sku, nfcPetIds);
    }
    if (sku === 'PETPAL_PLUS_YEARLY') {
      await grantTrackerEntitlement(db, uid, grantOrder, sku);
      await grantNfcEntitlement(db, uid, grantOrder, sku, nfcPetIds);
      await incrementShopPublicStats(db, { totalCollarPurchases: 1, activeSubscriptionsWithCollar: 1 });
    }
    if (sku === 'NFC_TAG_HARDWARE') {
      await grantNfcEntitlement(db, uid, grantOrder, sku, nfcPetIds);
    }
    if (sku === 'TRACKER_HARDWARE') {
      await grantTrackerEntitlement(db, uid, grantOrder, sku);
      if (await userHasActivePlus(db, uid)) {
        await incrementShopPublicStats(db, { activeSubscriptionsWithCollar: 1 });
      }
    }
    if (BOOST_SKUS.has(sku)) {
      await grantProviderBoostAfterPayment(db, uid, sku);
    }
  }

  if (catalog.recurring && BOOST_SKUS.has(sku)) {
    const next = nextRenewalDate(new Date(), sku);
    await db
      .collection('billingSubscriptions')
      .doc(`${uid}_${sku}`)
      .set(
        {
          uid,
          sku,
          amountCents: catalog.amountCents,
          currency: catalog.currency,
          bindingId: bindingId || null,
          clientId: uid,
          status: 'active',
          nextRenewalAt: admin.firestore.Timestamp.fromDate(next),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  if (PLUS_SKUS.has(sku) && bindingId) {
    const collarSnap = await db.collection('users').doc(uid).collection('shopEntitlements').doc('collar').get();
    if (collarSnap.exists && collarSnap.data()?.status === 'active') {
      await incrementShopPublicStats(db, { activeSubscriptionsWithCollar: 1 });
    }
  }
}

async function fulfillMarketplaceCart(db, uid, orderNumber, cartItems, bindingId) {
  const lines = Array.isArray(cartItems) ? cartItems : [];
  let subPaymentCounter = 0;
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    let subPaymentId = null;
    if (line.sku === 'PETPAL_PLUS_MONTHLY') {
      subPaymentCounter += 1;
      subPaymentId = subPaymentCounter;
    }
    await fulfillMarketplaceCartLine(db, uid, orderNumber, line, idx, bindingId, subPaymentId);
  }
}

exports.createJccCheckout = functions.region('europe-west1').https.onCall(async (data, context) => {
  try {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Sign in to checkout.');
    }
    const uid = context.auth.uid;
    const sku = String(data?.sku || '').trim();
    const saveCard = Boolean(data?.saveCard);
    const companyId = data?.companyId ? String(data.companyId).trim() : '';
    const includeTracker = Boolean(data?.includeTracker);
    const includeNfc = Boolean(data?.includeNfc);
    const nfcPetIds = Array.isArray(data?.nfcPetIds)
      ? data.nfcPetIds.map(String).filter(Boolean).slice(0, 20)
      : [];
    const rawCartItems = Array.isArray(data?.cartItems) ? data.cartItems : [];
    const shipping = normalizeShipping(data?.shippingContact);
    const shippingErr = validateShipping(shipping);
    if (shippingErr) {
      throw new functions.https.HttpsError('invalid-argument', shippingErr);
    }

    let pricing;
    let sessionCartItems = null;
    let cartSaveCard = saveCard;
    if (sku === 'MARKETPLACE_CART') {
      pricing = resolveMarketplaceCartPricing(rawCartItems);
      if (!pricing) {
        throw new functions.https.HttpsError('invalid-argument', 'Add at least one product to your cart.');
      }
      const cartErr = validateMarketplaceCartLines(pricing.cartItems);
      if (cartErr) {
        throw new functions.https.HttpsError('invalid-argument', cartErr);
      }
      sessionCartItems = pricing.cartItems;
      cartSaveCard =
        saveCard || pricing.cartItems.some((line) => line.sku && SKUS[line.sku]?.recurring && line.saveCard);
    } else {
      const catalog = SKUS[sku];
      if (!catalog) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown product.');
      }
      if (includeTracker && !PLUS_SKUS.has(sku)) {
        throw new functions.https.HttpsError('invalid-argument', 'GPS tracker is only available with PetPal Plus plans.');
      }
      const needsNfcPets =
        (sku === 'PETPAL_PLUS_MONTHLY' && includeNfc) ||
        sku === 'PETPAL_PLUS_YEARLY' ||
        sku === 'NFC_TAG_HARDWARE';
      if (needsNfcPets && !nfcPetIds.length) {
        throw new functions.https.HttpsError('invalid-argument', 'Select at least one pet for NFC tag configuration.');
      }
      pricing = resolveCheckoutPricing(sku, { includeTracker, includeNfc });
      if (!pricing) {
        throw new functions.https.HttpsError('invalid-argument', 'Unknown product.');
      }
      if (BOOST_SKUS.has(sku) && companyId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Boost purchase must use your business account id.');
      }
      if (catalog.recurring && !saveCard) {
        throw new functions.https.HttpsError('invalid-argument', 'This plan bills monthly — enable “Save card securely” so renewals can run on file.');
      }
    }

    const currency = sku === 'MARKETPLACE_CART' ? '978' : SKUS[sku].currency;

    ensureAdmin();
    const { userName, password, restBase, returnUrl, frontendUrl } = jccCredentials();

    const orderNumber = uniqueOrderNumber('PP');
    const db = admin.firestore();
    const sessionRef = db.collection('paymentSessions').doc(orderNumber);
    await sessionRef.set(
      omitUndefined({
        orderNumber,
        uid,
        sku,
        saveCard: cartSaveCard,
        includeTracker: pricing.includeTracker,
        includeNfc: pricing.includeNfc,
        nfcPetIds: nfcPetIds.length ? nfcPetIds : null,
        cartItems: sessionCartItems,
        shippingContact: shipping,
        companyId: companyId || null,
        amountCents: pricing.chargeCents,
        renewalAmountCents: pricing.renewalCents ?? null,
        currency,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending_register',
      })
    );

    await createPendingOrder(db, {
      orderNumber,
      uid,
      sku,
      pricing,
      shipping,
      sessionCartItems,
      includeTracker: pricing.includeTracker,
      includeNfc: pricing.includeNfc,
      nfcPetIds,
      currency,
    });

    const jccCartLines =
      sessionCartItems ||
      [
        {
          key: sku,
          title: pricing.title,
          priceCents: pricing.chargeCents,
          qty: 1,
          sku,
        },
      ];

    const params = {
      userName,
      password,
      orderNumber,
      amount: String(pricing.chargeCents),
      currency,
      returnUrl: `${returnUrl.replace(/\/$/, '')}?orderNumber=${encodeURIComponent(orderNumber)}`,
      failUrl: `${frontendUrl}/payment/failed?orderNumber=${encodeURIComponent(orderNumber)}`,
      description: pricing.title.slice(0, 240),
      language: 'en',
      clientId: uid,
      jsonParams: buildJccJsonParams(frontendUrl),
      ...buildJccRegisterCustomerParams(shipping),
    };

    if (cartSaveCard) {
      params.features = 'FORCE_CREATE_BINDING';
    }

    const reg = await jccPost(restBase, 'register.do', params);
    if (!jccRegisterDoSucceeded(reg)) {
      await sessionRef.set(
        {
          status: 'register_failed',
          jccError: reg?.errorMessage || reg?.error || String(reg?.errorCode),
          raw: reg,
        },
        { merge: true }
      );
      throw new functions.https.HttpsError(
        'failed-precondition',
        reg?.errorMessage || reg?.error || 'Could not start payment with JCC.'
      );
    }

    await sessionRef.set(
      {
        status: 'awaiting_payment',
        jccOrderId: reg.orderId,
        formUrl: reg.formUrl,
      },
      { merge: true }
    );

    return {
      formUrl: reg.formUrl,
      orderNumber,
      jccOrderId: reg.orderId,
      amountCents: pricing.chargeCents,
      includeTracker: pricing.includeTracker,
      includeNfc: pricing.includeNfc,
    };
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    const msg = typeof e?.message === 'string' ? e.message : String(e);
    // Plain Error() from jccCredentials / jccPost becomes functions/internal on the client — map to visible codes.
    if (/JCC credentials missing|JCC return URL missing/i.test(msg)) {
      throw new functions.https.HttpsError('failed-precondition', msg);
    }
    if (/JCC non-JSON/i.test(msg) || /fetch failed/i.test(msg) || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
      throw new functions.https.HttpsError('unavailable', msg.slice(0, 500));
    }
    functions.logger.error('createJccCheckout failed', { message: msg, stack: e?.stack, uid: context.auth?.uid });
    if (/undefined|Cannot use "undefined"/i.test(msg)) {
      throw new functions.https.HttpsError(
        'internal',
        'Checkout could not save order details. Refresh the shop page and try again.'
      );
    }
    throw new functions.https.HttpsError(
      'internal',
      msg && !/^internal$/i.test(msg.trim()) ? msg.slice(0, 400) : 'Checkout failed on the server. Inspect Cloud Function logs for createJccCheckout.'
    );
  }
});

exports.jccPaymentReturn = functions.region('europe-west1').https.onRequest(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method not allowed');
    return;
  }
  if (req.method === 'HEAD') {
    res.status(204).end();
    return;
  }

  const orderNumber = String(req.query.orderNumber || '').trim();
  const jccOrderId = String(req.query.orderId || req.query.mdOrder || '').trim();

  let frontendUrl;
  try {
    ({ frontendUrl } = jccCredentials());
  } catch (e) {
    redirect(res, `http://localhost:3000/shop?checkout=error&reason=config`);
    return;
  }

  if (!orderNumber || !jccOrderId) {
    redirect(res, `${frontendUrl}/payment/failed?reason=missing_order`);
    return;
  }

  ensureAdmin();
  const db = admin.firestore();
  const sessionRef = db.collection('paymentSessions').doc(orderNumber);
  const snap = await sessionRef.get();
  if (!snap.exists) {
    redirect(res, `${frontendUrl}/payment/failed?reason=unknown_session&orderNumber=${encodeURIComponent(orderNumber)}`);
    return;
  }
  const session = snap.data();

  let statusJson;
  try {
    const { userName, password, restBase } = jccCredentials();
    statusJson = await jccPost(restBase, 'getOrderStatusExtended.do', {
      userName,
      password,
      orderId: jccOrderId,
      language: 'en',
    });
  } catch (e) {
    await sessionRef.set({ status: 'status_error', error: e?.message || String(e) }, { merge: true });
    await updateOrderStatus(db, orderNumber, 'payment_failed');
    redirect(res, `${frontendUrl}/payment/failed?reason=status&orderNumber=${encodeURIComponent(orderNumber)}`);
    return;
  }

  await sessionRef.set({ statusPayload: statusJson, statusCheckedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  if (!jccOk(statusJson) || !paidOrderStatus(statusJson)) {
    await sessionRef.set({ status: 'not_paid' }, { merge: true });
    await updateOrderStatus(db, orderNumber, 'payment_failed');
    redirect(res, `${frontendUrl}/payment/failed?orderNumber=${encodeURIComponent(orderNumber)}`);
    return;
  }

  const bindingId = statusJson?.bindingInfo?.bindingId || null;
  const maskedPan = statusJson?.cardAuthInfo?.maskedPan || null;
  const sku = session.sku;
  const uid = session.uid;

  if (session.saveCard && bindingId) {
    await db
      .collection('users')
      .doc(uid)
      .collection('billing')
      .doc('defaultMethod')
      .set(
        {
          bindingId,
          maskedPan,
          provider: 'jcc',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  const catalog = SKUS[sku];
  /** Record subscription on successful payment even if JCC did not return a binding yet (UI shows Plus active; renewals need bindingId). */
  if (catalog?.recurring) {
    const next = nextRenewalDate(new Date(), sku);
    const renewalCents =
      Number.isFinite(Number(session.renewalAmountCents)) && session.renewalAmountCents > 0
        ? Number(session.renewalAmountCents)
        : catalog.amountCents;
    if (sku === 'PETPAL_PLUS_MONTHLY') {
      const subscriptionId = buildSubscriptionId(orderNumber, 1);
      await createMonthlyTrackerSubscription(db, {
        uid,
        paymentId: orderNumber,
        subPaymentId: 1,
        orderNumber: subscriptionId,
        sku,
        renewalCents,
        currency: catalog.currency,
        bindingId,
        includeTracker: session.includeTracker,
        includeNfc: session.includeNfc,
        nfcPetIds: session.nfcPetIds,
        nextRenewalAt: admin.firestore.Timestamp.fromDate(next),
      });
      await appendOrderTrackerSubscriptions(db, orderNumber, uid, [
        {
          paymentId: orderNumber,
          subPaymentId: 1,
          subscriptionId,
          includeTracker: session.includeTracker,
          includeNfc: session.includeNfc,
          nfcPetIds: session.nfcPetIds,
        },
      ]);
    } else {
      await db
        .collection('billingSubscriptions')
        .doc(`${uid}_${sku}`)
        .set(
          {
            uid,
            sku,
            amountCents: renewalCents,
            currency: catalog.currency,
            bindingId: bindingId || null,
            clientId: uid,
            status: 'active',
            nextRenewalAt: admin.firestore.Timestamp.fromDate(next),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }
  }

  if (session.includeTracker && sku === 'PETPAL_PLUS_MONTHLY') {
    await grantTrackerEntitlement(db, uid, orderNumber, sku);
    await incrementShopPublicStats(db, { totalCollarPurchases: 1, activeSubscriptionsWithCollar: 1 });
  }

  if (session.includeNfc && sku === 'PETPAL_PLUS_MONTHLY') {
    await grantNfcEntitlement(db, uid, orderNumber, sku, session.nfcPetIds);
  }

  if (sku === 'PETPAL_PLUS_YEARLY') {
    await grantTrackerEntitlement(db, uid, orderNumber, sku);
    await grantNfcEntitlement(db, uid, orderNumber, sku, session.nfcPetIds);
    await incrementShopPublicStats(db, { totalCollarPurchases: 1, activeSubscriptionsWithCollar: 1 });
  }

  if (PLUS_SKUS.has(sku) && bindingId) {
    const collarSnap = await db.collection('users').doc(uid).collection('shopEntitlements').doc('collar').get();
    if (collarSnap.exists && collarSnap.data()?.status === 'active') {
      await incrementShopPublicStats(db, { activeSubscriptionsWithCollar: 1 });
    }
  }

  if (sku === 'TRACKER_HARDWARE') {
    await grantTrackerEntitlement(db, uid, orderNumber, sku);
    if (await userHasActivePlus(db, uid)) {
      await incrementShopPublicStats(db, { activeSubscriptionsWithCollar: 1 });
    }
  }

  if (sku === 'NFC_TAG_HARDWARE') {
    await grantNfcEntitlement(db, uid, orderNumber, sku, session.nfcPetIds);
  }

  if (BOOST_SKUS.has(sku)) {
    const boostCompanyId = session.companyId || uid;
    await grantProviderBoostAfterPayment(db, boostCompanyId, sku);
  }

  if (sku === 'MARKETPLACE_CART' && Array.isArray(session.cartItems) && session.cartItems.length) {
    await fulfillMarketplaceCart(db, uid, orderNumber, session.cartItems, bindingId);
    await db
      .collection('users')
      .doc(uid)
      .collection('shopOrders')
      .doc(orderNumber)
      .set(
        {
          orderNumber,
          items: session.cartItems,
          amountCents: session.amountCents,
          currency: session.currency || '978',
          status: 'paid',
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  await updateOrderStatus(db, orderNumber, 'paid', {
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await recordCustomerPaymentIndex(db, orderNumber);

  await sessionRef.set({ status: 'paid', paidAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  let successQs = `checkout=success&sku=${encodeURIComponent(sku)}`;
  if (PLUS_SKUS.has(sku)) {
    successQs += `&plusBound=${bindingId ? '1' : '0'}`;
    if (session.includeTracker) successQs += '&includeTracker=1';
    if (session.includeNfc) successQs += '&includeNfc=1';
  }
  if (sku === 'TRACKER_HARDWARE') {
    const st = await db.collection('shopStats').doc('public').get();
    const stData = st.data() || {};
    successQs += `&collarCombo=${encodeURIComponent(String(stData.activeSubscriptionsWithCollar ?? 0))}&collarTotal=${encodeURIComponent(
      String(stData.totalCollarPurchases ?? 0)
    )}`;
  }
  successQs += `&orderNumber=${encodeURIComponent(orderNumber)}&gatewayOrderId=${encodeURIComponent(jccOrderId)}`;
  redirect(res, `${frontendUrl}/payment/success?${successQs}`);
});

exports.billingRenewal = functions
  .region('europe-west1')
  .pubsub.schedule('every day 05:00')
  .timeZone('Europe/Nicosia')
  .onRun(async () => {
    ensureAdmin();
    let creds;
    try {
      creds = jccCredentials();
    } catch {
      return null;
    }
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const legacyQ = await db
      .collection('billingSubscriptions')
      .where('status', '==', 'active')
      .where('nextRenewalAt', '<=', now)
      .limit(25)
      .get();
    const trackerQ = await db
      .collectionGroup('trackerSubscriptions')
      .where('status', '==', 'active')
      .where('nextRenewalAt', '<=', now)
      .limit(25)
      .get();

    const seen = new Set();
    const toRenew = [];
    for (const doc of [...legacyQ.docs, ...trackerQ.docs]) {
      if (seen.has(doc.ref.path)) continue;
      seen.add(doc.ref.path);
      toRenew.push(doc);
      if (toRenew.length >= 25) break;
    }

    for (const doc of toRenew) {
      await renewSubscriptionDoc(db, doc.ref, doc.data(), creds);
    }
    return null;
  });

/** Clears shop-paid boost flags after boost-until timestamps expire. */
exports.expireProviderBoosts = functions
  .region('europe-west1')
  .pubsub.schedule('every day 05:15')
  .timeZone('Europe/Nicosia')
  .onRun(async () => {
    ensureAdmin();
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const seen = new Set();
    const queries = [
      db.collection('providers').where('boostUntil', '<=', now).limit(100),
      db.collection('providers').where('boostNearbyUntil', '<=', now).limit(100),
      db.collection('providers').where('boostBookingsUntil', '<=', now).limit(100),
    ];
    const batch = db.batch();
    let count = 0;
    for (const q of queries) {
      const snap = await q.get();
      for (const doc of snap.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        const d = doc.data() || {};
        if (d.boostSource !== 'jcc_shop' && !d.boostEnabled && !d.boostNearbyEnabled && !d.boostBookingsEnabled) {
          continue;
        }
        const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (d.boostUntil && d.boostUntil <= now) {
          patch.boostEnabled = false;
          patch.boostUntil = admin.firestore.FieldValue.delete();
        }
        if (d.boostNearbyUntil && d.boostNearbyUntil <= now) {
          patch.boostNearbyEnabled = false;
          patch.boostNearbyUntil = admin.firestore.FieldValue.delete();
          patch.sponsored = false;
        }
        if (d.boostBookingsUntil && d.boostBookingsUntil <= now) {
          patch.boostBookingsEnabled = false;
          patch.boostBookingsUntil = admin.firestore.FieldValue.delete();
          patch.recommended = false;
        }
        if (Object.keys(patch).length > 1) {
          batch.set(doc.ref, patch, { merge: true });
          count += 1;
        }
      }
    }
    if (count) await batch.commit();
    return null;
  });
