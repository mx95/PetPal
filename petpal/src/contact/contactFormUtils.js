const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContactPayload(payload) {
  return {
    name: String(payload?.name || '').trim(),
    email: String(payload?.email || '').trim(),
    subject: String(payload?.subject || '').trim(),
    message: String(payload?.message || '').trim(),
  };
}

/** @returns {string} i18n key or empty when valid */
export function validateContactPayload(payload) {
  const { name, email, subject, message } = normalizeContactPayload(payload);
  if (!name || name.length < 2) return 'contactPage.errName';
  if (!EMAIL_RE.test(email)) return 'contactPage.errEmail';
  if (!subject || subject.length < 3) return 'contactPage.errSubject';
  if (!message || message.length < 10) return 'contactPage.errMessage';
  return '';
}

export function mapContactCallableError(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  if (code === 'functions/invalid-argument') {
    if (msg.includes('name')) return 'contactPage.errName';
    if (msg.includes('email')) return 'contactPage.errEmail';
    if (msg.includes('subject')) return 'contactPage.errSubject';
    if (msg.includes('message') || msg.includes('bit more')) return 'contactPage.errMessage';
    return 'contactPage.failed';
  }
  if (code === 'functions/unauthenticated') return 'contactPage.errAuth';
  if (code === 'functions/not-found' || code === 'functions/unavailable' || code === 'functions/internal') {
    return 'contactPage.errUnavailable';
  }
  return 'contactPage.failed';
}

export function contactMailtoHref(payload, toEmail) {
  const { name, email, subject, message } = normalizeContactPayload(payload);
  const to = String(toEmail || '').trim();
  if (!to) return '';
  const body = [`From: ${name || '—'} <${email || '—'}>`, '', message || ''].join('\n');
  return `mailto:${to}?subject=${encodeURIComponent(subject || 'PetPal support')}&body=${encodeURIComponent(body)}`;
}
