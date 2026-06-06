import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { submitContactMessage } from '../contact/contactApi';

export default function Contact() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await submitContactMessage({ name, email, subject, message });
      setSent(true);
    } catch (err) {
      setError(err?.message || t('contactPage.failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pp-pad pp-contactPage">
      <header className="pp-pageHeader pp-contactPage__header">
        <div className="pp-pageHeader__copy">
          <span className="pp-publicHero__eyebrow">{t('contactPage.eyebrow')}</span>
          <h1 className="pp-pageHeader__title">{t('contactPage.title')}</h1>
          <p className="pp-pageHeader__sub">{t('contactPage.subtitle')}</p>
        </div>
      </header>

      {sent ? (
        <div className="pp-card pp-pad pp-contactPage__success" role="status">
          <span className="pp-contactPage__successIcon" aria-hidden>
            💌
          </span>
          <h2 className="pp-sectionTitle">{t('contactPage.successTitle')}</h2>
          <p className="pp-subtle">{t('contactPage.successBody')}</p>
          <Link className="pp-btn pp-btnPrimary" to="/">
            {t('contactPage.backHome')}
          </Link>
        </div>
      ) : (
        <form className="pp-card pp-pad pp-form pp-contactPage__form" onSubmit={(e) => void onSubmit(e)}>
          <div className="pp-contactPage__grid">
            <div>
              <label className="pp-label" htmlFor="contact-name">
                {t('contactPage.name')}
              </label>
              <input
                id="contact-name"
                className="pp-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className="pp-label" htmlFor="contact-email">
                {t('contactPage.email')}
              </label>
              <input
                id="contact-email"
                className="pp-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>
          <div>
            <label className="pp-label" htmlFor="contact-subject">
              {t('contactPage.subject')}
            </label>
            <input
              id="contact-subject"
              className="pp-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder={t('contactPage.subjectPh')}
            />
          </div>
          <div>
            <label className="pp-label" htmlFor="contact-message">
              {t('contactPage.message')}
            </label>
            <textarea
              id="contact-message"
              className="pp-input pp-input--textarea"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              placeholder={t('contactPage.messagePh')}
            />
          </div>
          {error ? (
            <div className="pp-error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="pp-btn pp-btnPrimary pp-btn--lg" disabled={busy}>
            {busy ? t('contactPage.sending') : t('contactPage.send')}
          </button>
        </form>
      )}
    </div>
  );
}
