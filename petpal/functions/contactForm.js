const functions = require('firebase-functions');
const admin = require('firebase-admin');

const DEFAULT_TO = 'sotiris9515@gmail.com';

function getConfig(path, fallback = null) {
  try {
    const cfg = functions.config && functions.config();
    if (!cfg) return fallback;
    return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), cfg) ?? fallback;
  } catch {
    return fallback;
  }
}

function contactToEmail() {
  return (
    process.env.CONTACT_TO_EMAIL ||
    getConfig('contact.to_email') ||
    DEFAULT_TO
  ).trim();
}

async function sendContactEmail({ name, email, subject, message }) {
  const smtpUser = process.env.CONTACT_SMTP_USER || getConfig('contact.smtp_user');
  const smtpPass = process.env.CONTACT_SMTP_PASS || getConfig('contact.smtp_pass');
  if (!smtpUser || !smtpPass) {
    functions.logger.warn('Contact email skipped — set CONTACT_SMTP_USER and CONTACT_SMTP_PASS');
    return { emailed: false };
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    functions.logger.warn('nodemailer not installed — contact saved to Firestore only');
    return { emailed: false };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.CONTACT_SMTP_HOST || getConfig('contact.smtp_host') || 'smtp.gmail.com',
    port: Number(process.env.CONTACT_SMTP_PORT || getConfig('contact.smtp_port') || 587),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const to = contactToEmail();
  await transporter.sendMail({
    from: `"PetPal Contact" <${smtpUser}>`,
    to,
    replyTo: email,
    subject: `[PetPal] ${subject}`,
    text: `From: ${name} <${email}>\n\n${message}`,
    html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${String(message).replace(/\n/g, '<br>')}</p>`,
  });
  return { emailed: true, to };
}

exports.submitContactForm = functions.region('europe-west1').https.onCall(async (data, context) => {
  const name = String(data?.name || '').trim();
  const email = String(data?.email || '').trim().toLowerCase();
  const subject = String(data?.subject || '').trim();
  const message = String(data?.message || '').trim();

  if (!name || name.length < 2) {
    throw new functions.https.HttpsError('invalid-argument', 'Please enter your name.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Please enter a valid email.');
  }
  if (!subject || subject.length < 3) {
    throw new functions.https.HttpsError('invalid-argument', 'Please enter a subject.');
  }
  if (!message || message.length < 10) {
    throw new functions.https.HttpsError('invalid-argument', 'Please write a bit more in your message.');
  }

  const uid = context.auth?.uid || null;
  const db = admin.firestore();
  const ref = db.collection('contactMessages').doc();
  const record = {
    name,
    email,
    subject,
    message,
    uid,
    status: 'new',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userAgent: context.rawRequest?.headers?.['user-agent'] || null,
  };
  await ref.set(record);

  try {
    const mail = await sendContactEmail({ name, email, subject, message });
    if (mail.emailed) {
      await ref.set({ emailedAt: admin.firestore.FieldValue.serverTimestamp(), emailTo: mail.to }, { merge: true });
    }
  } catch (err) {
    functions.logger.error('Contact email failed', { err, id: ref.id });
  }

  return { ok: true, id: ref.id };
});
