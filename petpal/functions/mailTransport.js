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

function str(v) {
  return v == null ? '' : String(v).trim();
}

/**
 * Resolve SMTP settings from (in order):
 * 1) process.env CONTACT_SMTP_*
 * 2) functions.config().contact.*
 * 3) Firestore adminConfig/smtp (set from Admin Tools)
 */
async function loadSmtpSettings() {
  const envUser = process.env.CONTACT_SMTP_USER || getConfig('contact.smtp_user');
  const envPass = process.env.CONTACT_SMTP_PASS || getConfig('contact.smtp_pass');
  const envHost = process.env.CONTACT_SMTP_HOST || getConfig('contact.smtp_host');
  const envPort = process.env.CONTACT_SMTP_PORT || getConfig('contact.smtp_port');
  const envTo = process.env.CONTACT_TO_EMAIL || getConfig('contact.to_email');

  let firestore = null;
  try {
    const snap = await admin.firestore().doc('adminConfig/smtp').get();
    if (snap.exists) firestore = snap.data() || {};
  } catch (err) {
    functions.logger.warn('Could not read adminConfig/smtp', { message: err?.message });
  }

  const user = str(envUser) || str(firestore?.user);
  const pass = str(envPass) || str(firestore?.pass);
  const host = str(envHost) || str(firestore?.host) || 'smtp.gmail.com';
  const port = Number(envPort || firestore?.port || 587) || 587;
  const to =
    str(envTo) ||
    str(firestore?.to) ||
    'info@petpal.com.cy, sotiris9515@gmail.com';
  const fromName = str(firestore?.fromName) || 'PetPal';

  return {
    configured: Boolean(user && pass),
    user,
    pass,
    host,
    port,
    to,
    fromName,
    source: envUser && envPass ? 'env' : firestore?.user && firestore?.pass ? 'firestore' : 'none',
  };
}

/**
 * @param {{ to?: string, subject: string, text: string, html?: string, replyTo?: string, fromLabel?: string }} opts
 */
async function sendTransactionalEmail(opts) {
  const smtp = await loadSmtpSettings();
  if (!smtp.configured) {
    return { emailed: false, skipReason: 'smtp_not_configured', smtpSource: smtp.source };
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    return { emailed: false, skipReason: 'nodemailer_missing', smtpSource: smtp.source };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: Number(smtp.port) === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const to = str(opts.to) || smtp.to;
  const fromLabel = str(opts.fromLabel) || smtp.fromName;
  await transporter.sendMail({
    from: `"${fromLabel}" <${smtp.user}>`,
    to,
    replyTo: opts.replyTo || undefined,
    subject: opts.subject,
    text: opts.text,
    html: opts.html || undefined,
  });

  return { emailed: true, to, smtpSource: smtp.source };
}

module.exports = {
  loadSmtpSettings,
  sendTransactionalEmail,
  getConfig,
};
