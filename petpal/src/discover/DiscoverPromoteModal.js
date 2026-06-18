import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { createDiscoverPost } from './discoverFeedFirestore';
import { CATEGORY_EMOJI } from './discoverFeedModel';
import { isBookingBrowseEnabled } from '../bookings/bookingFeature';

const CATEGORIES = [
  { id: 'vet', labelKey: 'discover.promote.catVet' },
  { id: 'groomer', labelKey: 'discover.promote.catGroomer' },
  { id: 'shop', labelKey: 'discover.promote.catShop' },
  { id: 'trainer', labelKey: 'discover.promote.catTrainer' },
  { id: 'daycare', labelKey: 'discover.promote.catDaycare' },
  { id: 'event', labelKey: 'discover.promote.catEvent' },
];

export default function DiscoverPromoteModal({ open, onClose, companyProfile, uid, onPosted }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('vet');
  const [sponsored, setSponsored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!open || !companyProfile || !uid) return null;

  const businessName = companyProfile.businessName || t('discover.promote.defaultBusiness');

  async function submit(e) {
    e.preventDefault();
    const tTitle = title.trim();
    const tBody = body.trim();
    if (!tTitle || !tBody) {
      setErr(t('discover.promote.errRequired'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await createDiscoverPost(uid, {
        authorName: businessName,
        title: tTitle,
        body: tBody,
        category,
        sponsored,
        ctaTo: isBookingBrowseEnabled() ? '/bookings' : '/nearby',
        ctaLabelKey: 'discover.feed.bookNow',
        contactEmail: companyProfile.publicEmail || '',
        lat: companyProfile.lat,
        lng: companyProfile.lng,
      });
      setTitle('');
      setBody('');
      setSponsored(false);
      onPosted?.();
      onClose();
    } catch (ex) {
      setErr(ex?.message || t('discover.promote.errPost'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="discover-promote-title">
      <button type="button" className="pp-modalBackdrop" aria-label={t('pets.cancel')} onClick={onClose} />
      <div className="pp-modal pp-modal--discoverPromote">
        <header className="pp-modal__head">
          <span className="pp-dFeedCard__avatar" style={{ fontSize: 22 }} aria-hidden>
            {CATEGORY_EMOJI[category] || CATEGORY_EMOJI.default}
          </span>
          <div>
            <h2 id="discover-promote-title" className="pp-modal__title">
              {t('discover.promote.title')}
            </h2>
            <p className="pp-subtle" style={{ margin: '4px 0 0' }}>
              {t('discover.promote.sub', { name: businessName })}
            </p>
          </div>
          <button type="button" className="pp-modal__close" onClick={onClose} aria-label={t('pets.cancel')}>
            ×
          </button>
        </header>

        <form onSubmit={submit} className="pp-form">
          <label className="pp-label">{t('discover.promote.fieldTitle')}</label>
          <input
            className="pp-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            placeholder={t('discover.promote.titlePh')}
          />
          <label className="pp-label">{t('discover.promote.fieldBody')}</label>
          <textarea
            className="pp-input"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={800}
            placeholder={t('discover.promote.bodyPh')}
          />
          <label className="pp-label">{t('discover.promote.fieldCategory')}</label>
          <select className="pp-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.labelKey)}
              </option>
            ))}
          </select>
          <label className="pp-checkRow">
            <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} />
            <span>{t('discover.promote.sponsored')}</span>
          </label>
          {err ? (
            <p className="pp-formErr" role="alert">
              {err}
            </p>
          ) : null}
          <div className="pp-modal__actions">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onClose} disabled={busy}>
              {t('pets.cancel')}
            </button>
            <button type="submit" className="pp-btn pp-btnPrimary" disabled={busy}>
              {busy ? t('discover.promote.posting') : t('discover.promote.publish')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
