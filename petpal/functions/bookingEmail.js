const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { buildInviteFromBooking } = require('./bookingCalendar');
const { sendTransactionalEmail } = require('./mailTransport');

async function sendMail({ to, subject, text, html, icsContent, icsFilename = 'petpal-booking.ics' }) {
  // ICS attachments still need a direct nodemailer send; prefer shared transport when no ICS.
  if (!icsContent) {
    return sendTransactionalEmail({
      to,
      subject,
      text,
      html,
      fromLabel: 'PetPal Bookings',
    });
  }

  const { loadSmtpSettings } = require('./mailTransport');
  const smtp = await loadSmtpSettings();
  if (!smtp.configured) {
    functions.logger.warn('Booking email skipped — SMTP not configured');
    return { emailed: false };
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    return { emailed: false };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: Number(smtp.port) === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const mail = {
    from: `"PetPal Bookings" <${smtp.user}>`,
    to,
    subject,
    text,
    html,
    alternatives: [
      {
        contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
        content: icsContent,
      },
    ],
    attachments: [
      {
        filename: icsFilename,
        content: icsContent,
        contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
      },
    ],
  };

  await transporter.sendMail(mail);
  return { emailed: true };
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function resolveCustomerEmail(customerUid, fallback = '') {
  const direct = String(fallback || '').trim().toLowerCase();
  if (isEmail(direct)) return direct;
  if (!customerUid) return '';
  try {
    const user = await admin.auth().getUser(String(customerUid));
    const email = String(user.email || '').trim().toLowerCase();
    return isEmail(email) ? email : '';
  } catch (err) {
    functions.logger.warn('Could not resolve customer email', err);
    return '';
  }
}

async function resolveBusinessEmail(db, companyId, fallback = '') {
  const direct = String(fallback || '').trim().toLowerCase();
  if (isEmail(direct)) return direct;
  if (!companyId) return '';

  try {
    const companySnap = await db.doc(`companies/${companyId}`).get();
    if (companySnap.exists) {
      const publicEmail = String(companySnap.data()?.publicEmail || '').trim().toLowerCase();
      if (isEmail(publicEmail)) return publicEmail;
    }
  } catch (err) {
    functions.logger.warn('Could not read company publicEmail', err);
  }

  try {
    const providerSnap = await db.doc(`providers/${companyId}`).get();
    if (providerSnap.exists) {
      const bookingEmail = String(providerSnap.data()?.bookingNotificationEmail || '').trim().toLowerCase();
      if (isEmail(bookingEmail)) return bookingEmail;
    }
  } catch (err) {
    functions.logger.warn('Could not read provider booking email', err);
  }

  try {
    const owner = await admin.auth().getUser(String(companyId));
    const ownerEmail = String(owner.email || '').trim().toLowerCase();
    if (isEmail(ownerEmail)) return ownerEmail;
  } catch (err) {
    functions.logger.warn('Could not resolve business owner email', err);
  }

  return '';
}

function buildSummary({
  storeName,
  providerName,
  serviceName,
  petName,
  whenLabel,
  durationMin,
  price,
  address,
  bookingId,
  addons,
  customerEmail,
}) {
  const store = storeName || providerName || 'PetPal partner';
  const addonLine = addons.length ? `\nServices: ${addons.join(', ')}` : '';
  return [
    `Store: ${store}`,
    `Service: ${serviceName}`,
    `Pet: ${petName}`,
    customerEmail ? `Customer: ${customerEmail}` : '',
    `When: ${whenLabel}`,
    durationMin ? `Duration: ${durationMin} min` : '',
    price ? `Price: ${price}` : '',
    address ? `Location: ${address}` : '',
    bookingId ? `Reference: ${bookingId}` : '',
    addonLine,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Send calendar invitation emails to customer and business (best-effort).
 * @param {object} params
 */
async function sendBookingConfirmationEmails(params) {
  const db = params.db || admin.firestore();
  const bookingId = String(params.bookingId || '').trim();
  const customerUid = String(params.customerUid || '').trim();
  const companyId = String(params.companyId || '').trim();
  const storeName = String(params.storeName || params.providerName || 'PetPal partner').trim();
  const serviceName = String(params.serviceName || 'Appointment').trim();
  const petName = String(params.petName || 'Pet').trim();
  const variantLabel = String(params.variantLabel || '').trim();
  const whenIso = String(params.whenIso || '').trim();
  const durationMin = Number(params.durationMin) || null;
  const price = params.price ? String(params.price) : '';
  const address = params.address ? String(params.address) : '';
  const addons = Array.isArray(params.addons) ? params.addons.map(String) : [];
  const startAt = params.startAt || (whenIso ? new Date(whenIso) : null);
  const endAt = params.endAt || null;

  const customerEmail = await resolveCustomerEmail(customerUid, params.customerEmail);
  if (!isEmail(customerEmail)) {
    throw new functions.https.HttpsError('invalid-argument', 'Customer email is required.');
  }

  const businessEmail = await resolveBusinessEmail(db, companyId, params.businessEmail);
  const organizerEmail = getSmtpFrom();
  const whenLabel = formatWhen(whenIso || (startAt instanceof Date ? startAt.toISOString() : ''));
  const summary = buildSummary({
    storeName,
    providerName: storeName,
    serviceName,
    petName,
    whenLabel,
    durationMin,
    price,
    address,
    bookingId,
    addons,
    customerEmail,
  });

  const subject = `[PetPal] Booking confirmed — ${serviceName} at ${storeName}`;
  const textCustomer = `Hi,\n\nYour appointment is confirmed. A calendar invitation is attached.\n\n${summary}\n\n— PetPal`;
  const htmlCustomer = `<p>Hi,</p><p>Your appointment is confirmed. A calendar invitation is attached to this email.</p><pre style="font-family:inherit;white-space:pre-wrap">${summary.replace(/\n/g, '<br>')}</pre><p>— PetPal</p>`;

  const customerIcs = buildInviteFromBooking({
    bookingId: `${bookingId}-customer`,
    storeName,
    serviceName,
    petName,
    variantLabel,
    location: address,
    price,
    durationMin,
    startAt,
    endAt,
    attendeeEmail: customerEmail,
    organizerEmail,
    customerEmail,
  });

  const results = { customer: { emailed: false }, business: { emailed: false } };

  try {
    results.customer = await sendMail({
      to: customerEmail,
      subject,
      text: textCustomer,
      html: htmlCustomer,
      icsContent: customerIcs,
    });
  } catch (err) {
    functions.logger.error('Customer booking email failed', err);
  }

  if (isEmail(businessEmail)) {
    const textBiz = `New booking via PetPal. A calendar invitation is attached.\n\nCustomer: ${customerEmail}\n\n${summary}`;
    const htmlBiz = `<p>New booking via PetPal. A calendar invitation is attached to this email.</p><p><strong>Customer:</strong> ${customerEmail}</p><pre style="font-family:inherit;white-space:pre-wrap">${summary.replace(/\n/g, '<br>')}</pre>`;
    const businessIcs = buildInviteFromBooking({
      bookingId: `${bookingId}-business`,
      storeName,
      serviceName,
      petName,
      variantLabel,
      location: address,
      price,
      durationMin,
      startAt,
      endAt,
      attendeeEmail: businessEmail,
      organizerEmail,
      customerEmail,
    });

    try {
      results.business = await sendMail({
        to: businessEmail,
        subject: `[PetPal] New booking — ${petName} · ${serviceName}`,
        text: textBiz,
        html: htmlBiz,
        icsContent: businessIcs,
      });
    } catch (err) {
      functions.logger.error('Business booking email failed', err);
    }
  } else {
    functions.logger.warn('Business booking email skipped — no store email found', { companyId });
  }

  if (bookingId) {
    try {
      await db.collection('bookings').doc(bookingId).set(
        {
          confirmationEmail: {
            customer: results.customer.emailed ? customerEmail : null,
            business: results.business.emailed ? businessEmail : null,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    } catch (err) {
      functions.logger.warn('Could not update booking email metadata', err);
    }
  }

  return { ok: true, customerEmail, businessEmail: businessEmail || null, ...results };
}

exports.sendBookingConfirmation = functions.region('europe-west1').https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in to book.');
  }

  return sendBookingConfirmationEmails({
    db: admin.firestore(),
    bookingId: data?.bookingId,
    customerUid: context.auth.uid,
    customerEmail: data?.customerEmail,
    businessEmail: data?.businessEmail,
    companyId: data?.companyId,
    storeName: data?.storeName || data?.providerName,
    providerName: data?.providerName,
    serviceName: data?.serviceName,
    petName: data?.petName,
    variantLabel: data?.variantLabel,
    whenIso: data?.whenIso,
    durationMin: data?.durationMin,
    price: data?.price,
    address: data?.address,
    addons: data?.addons,
    startAt: data?.whenIso ? new Date(data.whenIso) : null,
    endAt: null,
  });
});

exports.sendBookingConfirmationEmails = sendBookingConfirmationEmails;
