import React, { useId, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import PetAvatar from '../components/PetAvatar';
import { PrettySelect } from '../components/PrettySelect';
import { useI18n } from '../i18n/I18nContext';
import { useLostPet } from '../lostPet/LostPetContext';
import { usePets } from '../pets/PetsContext';

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function formatWhen(iso, language) {
  try {
    return new Date(iso).toLocaleString(language === 'el' ? 'el-CY' : language === 'ru' ? 'ru-RU' : 'en-GB');
  } catch {
    return iso;
  }
}

export default function LostPetAlerts() {
  const { t, language } = useI18n();
  const outletCtx = useOutletContext();
  const embedded = outletCtx?.embedded === true;

  const { pets, getCategory } = usePets();
  const { premiumUnlocked, setPremium, activeListings, publishAlert, resolveAlert } = useLostPet();
  const [petId, setPetId] = useState('');
  const [description, setDescription] = useState('');
  const [lastSeenText, setLastSeenText] = useState('');
  const [lastSeenLat, setLastSeenLat] = useState('');
  const [lastSeenLng, setLastSeenLng] = useState('');
  const [reward, setReward] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createAlertExpanded, setCreateAlertExpanded] = useState(false);
  const petSelectId = useId();

  const hasPets = pets.length > 0;

  const sortedPets = useMemo(() => [...pets].sort((a, b) => a.name.localeCompare(b.name)), [pets]);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!petId) {
      setFormError(t('lostPet.errSelectPet'));
      return;
    }
    setSubmitting(true);
    try {
      const r = publishAlert({
        petId,
        description,
        lastSeenText,
        lastSeenLat: lastSeenLat.trim(),
        lastSeenLng: lastSeenLng.trim(),
        reward,
        contactPhone,
      });
      if (!r.ok) {
        if (r.error === 'description') setFormError(t('lostPet.errDesc'));
        else if (r.error === 'lastSeen') setFormError(t('lostPet.errLast'));
        else setFormError(t('lostPet.errGeneric'));
        return;
      }
      setDescription('');
      setLastSeenText('');
      setLastSeenLat('');
      setLastSeenLng('');
      setReward('');
      setContactPhone('');
      setCreateAlertExpanded(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pp-grid">
      {!embedded ? (
        <div className="pp-col-12">
          <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="pp-badge pp-badge--premium">{t('lostPet.premium')}</div>
              <h1 className="pp-h1" style={{ marginTop: 10 }}>
                {t('lostPet.title')}
              </h1>
              <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 640 }}>
                {t('lostPet.intro')}{' '}
                {t('lostPet.introPets')}{' '}
                <Link className="pp-link" to="/pets" style={{ display: 'inline', padding: 0 }}>
                  {t('nav.myPets')}
                </Link>
                .
              </p>
            </div>
            <Link className="pp-link" to="/dashboard">
              {t('lostPet.backDash')}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-lostPetPremiumCta" style={{ borderColor: 'rgba(180, 120, 32, 0.35)' }}>
          <h2 className="pp-sectionTitle">{t('lostPet.ctaTitle')}</h2>
          <ul className="pp-subtle" style={{ margin: '0 0 12px 18px', lineHeight: 1.5 }}>
            <li>{t('lostPet.cta1')}</li>
            <li>{t('lostPet.cta2')}</li>
            <li>{t('lostPet.cta3')}</li>
          </ul>
          {!premiumUnlocked ? (
            <p style={{ margin: 0 }}>
              <button type="button" className="pp-btn pp-btnPremium" onClick={() => setPremium(true)}>
                {t('lostPet.enablePremium')}
              </button>
              <span className="pp-subtle" style={{ marginLeft: 10, fontSize: 12 }}>
                {t('lostPet.noPayment')}
              </span>
            </p>
          ) : (
            <p className="pp-subtle" style={{ margin: 0, fontSize: 13 }}>
              {t('lostPet.premiumOnBefore')}{' '}
              <button
                type="button"
                className="pp-link"
                style={{ display: 'inline', padding: 0, border: 0, background: 'none', font: 'inherit' }}
                onClick={() => setPremium(false)}
              >
                {t('lostPet.turnOff')}
              </button>
              {t('lostPet.premiumOnAfter')}
            </p>
          )}
        </div>
      </div>

      {premiumUnlocked && hasPets ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad" style={{ maxWidth: 720 }}>
            <button
              type="button"
              className="pp-expandTrigger"
              aria-expanded={createAlertExpanded}
              onClick={() => setCreateAlertExpanded((o) => !o)}
              id="create-alert-expand"
            >
              <span className="pp-expandTrigger__icon" aria-hidden>
                {createAlertExpanded ? '−' : '+'}
              </span>
              <span className="pp-expandTrigger__text">
                <span className="pp-expandTrigger__title">{t('lostPet.createTitle')}</span>
                <span className="pp-expandTrigger__desc">
                  {createAlertExpanded ? t('lostPet.createExpandedHint') : t('lostPet.createCollapsedHint')}
                </span>
              </span>
              <span className={`pp-expandTrigger__chev ${createAlertExpanded ? 'is-open' : ''}`} aria-hidden>
                ▼
              </span>
            </button>
            {createAlertExpanded ? (
              <div className="pp-expandPanel" role="region" aria-labelledby="create-alert-expand">
                <p className="pp-subtle pp-expandIntro">{t('lostPet.createIntro')}</p>
                <form className="pp-form" onSubmit={onSubmit} style={{ gap: 12 }}>
                  <div>
                    <div className="pp-label" id={`${petSelectId}-label`}>
                      {t('lostPet.pet')}
                    </div>
                    <PrettySelect
                      id={petSelectId}
                      aria-labelledby={`${petSelectId}-label`}
                      value={petId}
                      onChange={(e) => setPetId(e.target.value)}
                    >
                      <option value="">{t('lostPet.select')}</option>
                      {sortedPets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {getCategory(p).emoji} {p.name}
                        </option>
                      ))}
                    </PrettySelect>
                  </div>
                  <div>
                    <div className="pp-label">{t('lostPet.descLabel')}</div>
                    <textarea
                      className="pp-input"
                      style={{ minHeight: 100, resize: 'vertical' }}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      maxLength={2000}
                      placeholder={t('lostPet.descPh')}
                    />
                  </div>
                  <div>
                    <div className="pp-label">{t('lostPet.lastSeen')}</div>
                    <textarea
                      className="pp-input"
                      style={{ minHeight: 72, resize: 'vertical' }}
                      value={lastSeenText}
                      onChange={(e) => setLastSeenText(e.target.value)}
                      required
                      maxLength={1000}
                      placeholder={t('lostPet.lastSeenPh')}
                    />
                  </div>
                  <div className="pp-row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 140px' }}>
                      <div className="pp-label">{t('lostPet.lat')}</div>
                      <input
                        className="pp-input"
                        value={lastSeenLat}
                        onChange={(e) => setLastSeenLat(e.target.value)}
                        placeholder={t('lostPet.latPh')}
                        inputMode="decimal"
                        autoComplete="off"
                      />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <div className="pp-label">{t('lostPet.lng')}</div>
                      <input
                        className="pp-input"
                        value={lastSeenLng}
                        onChange={(e) => setLastSeenLng(e.target.value)}
                        placeholder={t('lostPet.lngPh')}
                        inputMode="decimal"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="pp-label">{t('lostPet.reward')}</div>
                    <input
                      className="pp-input"
                      value={reward}
                      onChange={(e) => setReward(e.target.value)}
                      maxLength={200}
                      placeholder={t('lostPet.rewardPh')}
                    />
                  </div>
                  <div>
                    <div className="pp-label">{t('lostPet.phone')}</div>
                    <input
                      className="pp-input"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      maxLength={40}
                      placeholder={t('lostPet.phonePh')}
                    />
                    <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                      {t('lostPet.phoneHint')}
                    </p>
                  </div>
                  {formError ? <div className="pp-error">{formError}</div> : null}
                  <div>
                    <button type="submit" className="pp-btn pp-btnPrimary" disabled={submitting || !petId}>
                      {submitting ? t('lostPet.saving') : t('lostPet.publish')}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {premiumUnlocked && !hasPets ? (
        <div className="pp-col-12">
          <p className="pp-subtle">
            <Link to="/pets">{t('lostPet.addPetsLink')}</Link> {t('lostPet.withPhoto')}
          </p>
        </div>
      ) : null}

      {!premiumUnlocked ? null : (
        <div className="pp-col-12">
          <h2 className="pp-sectionTitle" style={{ marginBottom: 12 }}>
            {t('lostPet.yourAlerts')}
          </h2>
          {activeListings.length === 0 ? (
            <p className="pp-subtle">{t('lostPet.noAlerts')}</p>
          ) : (
            <ul
              className="pp-lostPetList"
              style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {activeListings.map((L) => (
                <li key={L.id} className="pp-card pp-pad" style={{ borderColor: 'rgba(180, 50, 50, 0.25)' }}>
                  <div className="pp-row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <PetAvatar
                      pet={{ categoryId: L.categoryId, photoDataUrl: L.photoDataUrl }}
                      size={96}
                      className="pp-petAvatar--lg"
                    />
                    <div style={{ flex: '1 1 240px' }}>
                      <div className="pp-h1" style={{ fontSize: 20, margin: '0 0 6px' }}>
                        {L.petName}{' '}
                        <span className="pp-subtle" style={{ fontSize: 13, fontWeight: 600 }}>
                          {t('lostPet.lost')}
                        </span>
                      </div>
                      <p className="pp-subtle" style={{ margin: '0 0 8px', fontSize: 12 }}>
                        {formatWhen(L.createdAt, language)}
                      </p>
                      <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>{L.description}</p>
                      <p style={{ margin: '0 0 8px' }}>
                        <strong>{t('lostPet.lastSeenLabel')}</strong> {L.lastSeenText}
                      </p>
                      {L.lastSeenLat != null && L.lastSeenLng != null ? (
                        <p style={{ margin: '0 0 8px' }}>
                          <a
                            className="pp-link"
                            href={mapsLink(L.lastSeenLat, L.lastSeenLng)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t('lostPet.mapLink')}
                          </a>
                        </p>
                      ) : null}
                      {L.reward ? (
                        <p style={{ margin: '0 0 8px' }}>
                          <strong>{t('lostPet.rewardLabel')}</strong> {L.reward}
                        </p>
                      ) : null}
                      {L.contactPhone ? (
                        <p style={{ margin: 0 }}>
                          <a
                            className="pp-btn pp-btnPrimary"
                            style={{ display: 'inline-block', textDecoration: 'none' }}
                            href={`tel:${L.contactPhone.replace(/\s/g, '')}`}
                          >
                            {t('lostPet.call')} {L.contactPhone}
                          </a>
                        </p>
                      ) : (
                        <p className="pp-subtle" style={{ margin: 0, fontSize: 12 }}>
                          {t('lostPet.noPhone')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="pp-btn" onClick={() => resolveAlert(L.id)}>
                      {t('lostPet.markFound')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
