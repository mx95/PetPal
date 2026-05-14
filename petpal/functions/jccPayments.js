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
 *   jcc.frontend_url="https://your-petpal-host"
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

const SKUS = {
  PETPAL_PLUS_MONTHLY: { amountCents: 499, currency: '978', title: 'PetPal Plus (monthly)', recurring: true },
  TRACKER_HARDWARE: { amountCents: 7900, currency: '978', title: 'GPS tracker device', recurring: false },
  STORE_BOOST_MONTHLY: { amountCents: 999, currency: '978', title: 'Business visibility boost (monthly)', recurring: true },
};

function redirect(res, url) {
  res.set('Cache-Control', 'no-store');
  res.redirect(302, url);
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

    const catalog = SKUS[sku];
    if (!catalog) {
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
      companyId: companyId || null,
      amountCents: catalog.amountCents,
      currency: catalog.currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending_register',
    });

    const params = {
      userName,
      password,
      orderNumber,
      amount: String(catalog.amountCents),
      currency: catalog.currency,
      returnUrl: `${returnUrl.replace(/\/$/, '')}?orderNumber=${encodeURIComponent(orderNumber)}`,
      failUrl: `${frontendUrl}/shop?checkout=fail`,
      description: catalog.title.slice(0, 240),
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

    return { formUrl: reg.formUrl, orderNumber, jccOrderId: reg.orderId };
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
  if (catalog?.recurring && bindingId) {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    await db
      .collection('billingSubscriptions')
      .doc(`${uid}_${sku}`)
      .set(
        {
          uid,
          sku,
          amountCents: catalog.amountCents,
          currency: catalog.currency,
          bindingId,
          clientId: uid,
          status: 'active',
          nextRenewalAt: admin.firestore.Timestamp.fromDate(next),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
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
  redirect(res, `${frontendUrl}/shop?checkout=success&sku=${encodeURIComponent(sku)}`);
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
        const next = new Date();
        next.setMonth(next.getMonth() + 1);
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
