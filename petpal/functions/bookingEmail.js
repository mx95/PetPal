const functions = require('firebase-functions');
const admin = require('firebase-admin');

function getConfig(path, fallback = null) {
  try {
    const cfg = functions.config && functions.config();
    if (!cfg) return fallback;
    return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), cfg) ?? fallback;
  } catch {
    return fallback;
  }
}

async function sendMail({ to, subject, text, html }) {
  const smtpUser = process.env.CONTACT_SMTP_USER || getConfig('contact.smtp_user');
  const smtpPass = process.env.CONTACT_SMTP_PASS || getConfig('contact.smtp_pass');
  if (!smtpUser || !smtpPass) {
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
    host: process.env.CONTACT_SMTP_HOST || getConfig('contact.smtp_host') || 'smtp.gmail.com',
    port: Number(process.env.CONTACT_SMTP_PORT || getConfig('contact.smtp_port') || 587),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"PetPal Bookings" <${smtpUser}>`,
    to,
    subject,
    text,
    html,
  });
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

exports.sendBookingConfirmation = functions.region('europe-west1').https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in to book.');
  }

  const customerEmail = String(data?.customerEmail || '').trim().toLowerCase();
  const businessEmail = String(data?.businessEmail || '').trim().toLowerCase();
  const providerName = String(data?.providerName || 'PetPal partner').trim();
  const serviceName = String(data?.serviceName || 'Appointment').trim();
  const petName = String(data?.petName || 'Pet').trim();
  const whenIso = String(data?.whenIso || '').trim();
  const durationMin = Number(data?.durationMin) || null;
  const price = data?.price ? String(data.price) : '';
  const address = data?.address ? String(data.address) : '';
  const bookingId = String(data?.bookingId || '').trim();
  const addons = Array.isArray(data?.addons) ? data.addons.map(String) : [];

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new functions.https.HttpsError('invalid-argument', 'Customer email is required.');
  }

  const whenLabel = formatWhen(whenIso);
  const addonLine = addons.length ? `\nServices: ${addons.join(', ')}` : '';
  const summary = [
    `Provider: ${providerName}`,
    `Service: ${serviceName}`,
    `Pet: ${petName}`,
    `When: ${whenLabel}`,
    durationMin ? `Duration: ${durationMin} min` : '',
    price ? `Price: ${price}` : '',
    address ? `Location: ${address}` : '',
    bookingId ? `Reference: ${bookingId}` : '',
    addonLine,
  ]
    .filter(Boolean)
    .join('\n');

  const subject = `[PetPal] Booking confirmed — ${serviceName} at ${providerName}`;
  const textCustomer = `Hi,\n\nYour appointment is confirmed.\n\n${summary}\n\nAdd it to your calendar from the PetPal app.\n\n— PetPal`;
  const htmlCustomer = `<p>Hi,</p><p>Your appointment is confirmed.</p><pre style="font-family:inherit;white-space:pre-wrap">${summary.replace(/\n/g, '<br>')}</pre><p>Add it to your calendar from the PetPal app.</p><p>— PetPal</p>`;

  const results = { customer: { emailed: false }, business: { emailed: false } };

  try {
    results.customer = await sendMail({
      to: customerEmail,
      subject,
      text: textCustomer,
      html: htmlCustomer,
    });
  } catch (err) {
    functions.logger.error('Customer booking email failed', err);
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
    const textBiz = `New booking via PetPal.\n\nCustomer: ${customerEmail}\n\n${summary}`;
    const htmlBiz = `<p>New booking via PetPal.</p><p><strong>Customer:</strong> ${customerEmail}</p><pre style="font-family:inherit;white-space:pre-wrap">${summary.replace(/\n/g, '<br>')}</pre>`;
    try {
      results.business = await sendMail({
        to: businessEmail,
        subject: `[PetPal] New booking — ${petName} · ${serviceName}`,
        text: textBiz,
        html: htmlBiz,
      });
    } catch (err) {
      functions.logger.error('Business booking email failed', err);
    }
  }

  if (bookingId) {
    try {
      await admin.firestore().collection('bookings').doc(bookingId).set(
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

  return { ok: true, ...results };
});
