const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { loadSmtpSettings, sendTransactionalEmail } = require('./mailTransport');

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

  let mail = { emailed: false, skipReason: 'unknown' };
  try {
    mail = await sendTransactionalEmail({
      fromLabel: 'PetPal Contact',
      replyTo: email,
      subject: `[PetPal] ${subject}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p>${String(message).replace(/\n/g, '<br>')}</p>`,
    });
  } catch (err) {
    functions.logger.error('Contact email failed', { err: err?.message || String(err), id: ref.id });
    mail = { emailed: false, skipReason: err?.message || 'send_failed' };
  }

  await ref.set(
    {
      emailed: Boolean(mail.emailed),
      emailTo: mail.to || null,
      emailSkipReason: mail.emailed ? null : mail.skipReason || 'smtp_skipped',
      emailSource: mail.smtpSource || null,
      ...(mail.emailed ? { emailedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  return {
    ok: true,
    id: ref.id,
    emailed: Boolean(mail.emailed),
    emailSkipReason: mail.emailed ? null : mail.skipReason || 'smtp_skipped',
  };
});

/** Admin: read whether SMTP is configured (never returns the password). */
exports.getSupportEmailStatus = functions.region('europe-west1').https.onCall(async (_data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  const adminSnap = await admin.firestore().doc(`admins/${context.auth.uid}`).get();
  if (!adminSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
  const smtp = await loadSmtpSettings();
  return {
    configured: smtp.configured,
    source: smtp.source,
    host: smtp.host,
    port: smtp.port,
    user: smtp.user ? `${smtp.user.slice(0, 2)}…${smtp.user.includes('@') ? smtp.user.slice(smtp.user.indexOf('@')) : ''}` : '',
    to: smtp.to,
  };
});

/** Admin: save SMTP settings used for support + booking emails. */
exports.saveSupportSmtpConfig = functions.region('europe-west1').https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required.');
  }
  const adminSnap = await admin.firestore().doc(`admins/${context.auth.uid}`).get();
  if (!adminSnap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }

  const user = String(data?.user || '').trim();
  const pass = String(data?.pass || '').trim();
  const host = String(data?.host || 'smtp.gmail.com').trim() || 'smtp.gmail.com';
  const port = Number(data?.port) || 587;
  const to = String(data?.to || 'info@petpal.com.cy, sotiris9515@gmail.com').trim();
  const fromName = String(data?.fromName || 'PetPal').trim() || 'PetPal';
  const sendTest = data?.sendTest === true;

  if (!user || !user.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter the SMTP username (email).');
  }
  if (!pass || pass.length < 8) {
    throw new functions.https.HttpsError('invalid-argument', 'Enter the SMTP password / app password.');
  }

  await admin.firestore().doc('adminConfig/smtp').set(
    {
      user,
      pass,
      host,
      port,
      to,
      fromName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid,
    },
    { merge: true }
  );

  let test = { emailed: false };
  if (sendTest) {
    try {
      test = await sendTransactionalEmail({
        fromLabel: fromName,
        subject: '[PetPal] SMTP test',
        text: 'PetPal support email is configured correctly.',
        html: '<p>PetPal support email is configured correctly.</p>',
      });
    } catch (err) {
      throw new functions.https.HttpsError('internal', err?.message || 'SMTP test failed.');
    }
    if (!test.emailed) {
      throw new functions.https.HttpsError('failed-precondition', test.skipReason || 'SMTP test did not send.');
    }
  }

  return { ok: true, testSent: Boolean(test.emailed), to: test.to || to };
});
