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

function jccCredentials() {
  const userName = jccEnv('JCC_USER') || getCfg('jcc.user');
  const password = jccEnv('JCC_PASS') || getCfg('jcc.pass');
  const restBase = (jccEnv('JCC_REST_BASE') || getCfg('jcc.rest_base') || 'https://gateway-test.jcc.com.cy/payment/rest').replace(/\/$/, '');
  const returnUrl = jccEnv('JCC_RETURN_URL') || getCfg('jcc.return_url');
  const frontendUrl = (jccEnv('JCC_FRONTEND_URL') || getCfg('jcc.frontend_url') || 'http://localhost:3000').replace(/\/$/, '');
  if (!userName || !password) {
    throw new Error('JCC credentials missing: set jcc.user / jcc.pass (Functions config) or JCC_USER / JCC_PASS env.');
  }
  if (!returnUrl) {
    throw new Error('JCC return URL missing: set jcc.return_url to this function’s public HTTPS URL (jccPaymentReturn).');
  }
  return { userName, password, restBase, returnUrl, frontendUrl };
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

const { SKUS, PLUS_SKUS, resolveCheckoutPricing } = require('./shopPricing');

function nextRenewalDate(from, sku) {
  const next = new Date(from);
  if (sku === 'PETPAL_PLUS_YEARLY') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

async function grantTrackerEntitlement(db, uid, orderNumber, sourceSku) {
  await db
    .collection('users')
    .doc(uid)
    .collection('shopEntitlements')
    .doc('collar')
    .set(
      {
        status: 'active',
        sku: 'TRACKER_HARDWARE',
        sourceSku,
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
        sessionOrderNumber: orderNumber,
      },
      { merge: true }
    );
  await incrementShopPublicStats(db, { totalCollarPurchases: 1 });
}

async function grantNfcEntitlement(db, uid, orderNumber, sourceSku) {
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

    const catalog = SKUS[sku];
    if (!catalog) {
      throw new functions.https.HttpsError('invalid-argument', 'Unknown product.');
    }
    if ((includeTracker || includeNfc) && sku !== 'PETPAL_PLUS_MONTHLY') {
      throw new functions.https.HttpsError('invalid-argument', 'Hardware add-ons are only available with the monthly plan.');
    }
    const pricing = resolveCheckoutPricing(sku, { includeTracker, includeNfc });
    if (!pricing) {
      throw new functions.https.HttpsError('invalid-argument', 'Unknown product.');
    }
    if (sku === 'STORE_BOOST_MONTHLY' && companyId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Boost purchase must use your business account id.');
    }
    if (catalog.recurring && !saveCard) {
      throw new functions.https.HttpsError('invalid-argument', 'This plan bills monthly — enable “Save card securely” so renewals can run on file.');
    }

    ensureAdmin();
    const { userName, password, restBase, returnUrl, frontendUrl } = jccCredentials();

    const orderNumber = uniqueOrderNumber('PP');
    const db = admin.firestore();
    const sessionRef = db.collection('paymentSessions').doc(orderNumber);
    await sessionRef.set({
      orderNumber,
      uid,
      sku,
      saveCard,
      includeTracker: pricing.includeTracker,
      includeNfc: pricing.includeNfc,
      companyId: companyId || null,
      amountCents: pricing.chargeCents,
      renewalAmountCents: pricing.renewalCents,
      currency: catalog.currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending_register',
    });

    const params = {
      userName,
      password,
      orderNumber,
      amount: String(pricing.chargeCents),
      currency: catalog.currency,
      returnUrl: `${returnUrl.replace(/\/$/, '')}?orderNumber=${encodeURIComponent(orderNumber)}`,
      failUrl: `${frontendUrl}/shop?checkout=fail`,
      description: pricing.title.slice(0, 240),
      language: 'en',
      clientId: uid,
      jsonParams: JSON.stringify({ backToShopUrl: `${frontendUrl}/shop`, backToShopName: 'Back to PetPal' }),
    };

    if (saveCard) {
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
    functions.logger.error('createJccCheckout failed', { err: e, uid: context.auth?.uid });
    throw new functions.https.HttpsError(
      'internal',
      'Checkout failed on the server. Inspect Cloud Function logs for createJccCheckout.'
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
    redirect(res, `${frontendUrl}/shop?checkout=error&reason=missing_order`);
    return;
  }

  ensureAdmin();
  const db = admin.firestore();
  const sessionRef = db.collection('paymentSessions').doc(orderNumber);
  const snap = await sessionRef.get();
  if (!snap.exists) {
    redirect(res, `${frontendUrl}/shop?checkout=error&reason=unknown_session`);
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
    redirect(res, `${frontendUrl}/shop?checkout=error&reason=status`);
    return;
  }

  await sessionRef.set({ statusPayload: statusJson, statusCheckedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  if (!jccOk(statusJson) || !paidOrderStatus(statusJson)) {
    await sessionRef.set({ status: 'not_paid' }, { merge: true });
    redirect(res, `${frontendUrl}/shop?checkout=fail`);
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

  if (session.includeTracker && sku === 'PETPAL_PLUS_MONTHLY') {
    await grantTrackerEntitlement(db, uid, orderNumber, sku);
    await incrementShopPublicStats(db, { totalCollarPurchases: 1, activeSubscriptionsWithCollar: 1 });
  }

  if (session.includeNfc && sku === 'PETPAL_PLUS_MONTHLY') {
    await grantNfcEntitlement(db, uid, orderNumber, sku);
  }

  if (sku === 'PETPAL_PLUS_YEARLY') {
    await grantTrackerEntitlement(db, uid, orderNumber, sku);
    await grantNfcEntitlement(db, uid, orderNumber, sku);
    await incrementShopPublicStats(db, { activeSubscriptionsWithCollar: 1 });
  }

  if (PLUS_SKUS.has(sku) && bindingId) {
    const collarSnap = await db.collection('users').doc(uid).collection('shopEntitlements').doc('collar').get();
    if (collarSnap.exists && collarSnap.data()?.status === 'active') {
      await incrementShopPublicStats(db, { activeSubscriptionsWithCollar: 1 });
    }
  }

  if (sku === 'TRACKER_HARDWARE') {
    await grantTrackerEntitlement(db, uid, orderNumber, sku);
    let plusActive = false;
    for (const plusSku of PLUS_SKUS) {
      const plusSnap = await db.collection('billingSubscriptions').doc(`${uid}_${plusSku}`).get();
      const plusD = plusSnap.data();
      if (plusSnap.exists && plusD?.status === 'active') {
        plusActive = true;
        break;
      }
    }
    if (plusActive) await incrementShopPublicStats(db, { activeSubscriptionsWithCollar: 1 });
  }

  if (sku === 'NFC_TAG_HARDWARE') {
    await grantNfcEntitlement(db, uid, orderNumber, sku);
  }

  if (sku === 'STORE_BOOST_MONTHLY') {
    const companyId = session.companyId || uid;
    const until = new Date();
    until.setDate(until.getDate() + 32);
    await db
      .collection('providers')
      .doc(companyId)
      .set(
        {
          boostEnabled: true,
          sponsored: true,
          recommended: true,
          boostUntil: admin.firestore.Timestamp.fromDate(until),
          boostSource: 'jcc_shop',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

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
    const { userName, password, restBase, returnUrl } = creds;
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const q = await db.collection('billingSubscriptions').where('status', '==', 'active').where('nextRenewalAt', '<=', now).limit(25).get();

    for (const doc of q.docs) {
      const sub = doc.data();
      const { uid, sku, amountCents, currency, bindingId, clientId } = sub;
      if (!bindingId || !uid || !sku) continue;
      const orderNumber = uniqueOrderNumber('RENEW');
      const renewRef = db.collection('paymentSessions').doc(orderNumber);
      await renewRef.set({
        orderNumber,
        uid,
        sku,
        saveCard: false,
        kind: 'renewal',
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
          continue;
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
          await doc.ref.set({ status: 'past_due', lastError: pay?.errorMessage || pay?.error }, { merge: true });
          continue;
        }
        const st = await jccPost(restBase, 'getOrderStatusExtended.do', {
          userName,
          password,
          orderId: reg.orderId,
          language: 'en',
        });
        if (!jccOk(st) || !paidOrderStatus(st)) {
          await renewRef.set({ status: 'not_paid_after_binding', raw: st }, { merge: true });
          await doc.ref.set({ status: 'past_due' }, { merge: true });
          continue;
        }
        const next = nextRenewalDate(new Date(), sku);
        await doc.ref.set(
          {
            status: 'active',
            nextRenewalAt: admin.firestore.Timestamp.fromDate(next),
            lastRenewedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        await renewRef.set({ status: 'paid_renewal', jccOrderId: reg.orderId }, { merge: true });

        if (sku === 'STORE_BOOST_MONTHLY') {
          const until = new Date();
          until.setDate(until.getDate() + 32);
          await db
            .collection('providers')
            .doc(uid)
            .set(
              {
                boostEnabled: true,
                sponsored: true,
                recommended: true,
                boostUntil: admin.firestore.Timestamp.fromDate(until),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
        }
      } catch (e) {
        await renewRef.set({ status: 'renewal_exception', error: e?.message || String(e) }, { merge: true });
      }
    }
    return null;
  });

/** Clears shop-paid boost flags after `boostUntil` (keeps Firestore aligned with UI `providerBoostIsActive`). */
exports.expireProviderBoosts = functions
  .region('europe-west1')
  .pubsub.schedule('every day 05:15')
  .timeZone('Europe/Nicosia')
  .onRun(async () => {
    ensureAdmin();
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collection('providers').where('boostUntil', '<=', now).limit(100).get();
    if (snap.empty) return null;
    const batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      const d = doc.data() || {};
      if (d.boostSource !== 'jcc_shop' && !d.boostEnabled) continue;
      batch.set(
        doc.ref,
        {
          boostEnabled: false,
          sponsored: false,
          recommended: false,
          boostUntil: admin.firestore.FieldValue.delete(),
          boostSource: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      count += 1;
    }
    if (count) await batch.commit();
    return null;
  });
