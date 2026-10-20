import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';
import { useI18n } from '../i18n/I18nContext';
import petpalLogo from '../logo.png';

function getSafe(v, fallback = '') {
  if (typeof v === 'string') return v;
  if (v == null) return fallback;
  return String(v);
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function formatAgeFromDob(dob, t) {
  if (!dob) return '';
  const born = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(born.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) years -= 1;
  if (years < 1) {
    let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
    if (now.getDate() < born.getDate()) months -= 1;
    if (months < 1) return t('myPets.ageUnderOneMonth');
    return t('myPets.ageMonths', { count: months });
  }
  return t('myPets.ageYears', { count: years });
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3h3l1.5 4-2 1.5a11 11 0 0 0 5 5L17 11.5 21 13v3a2 2 0 0 1-2 2A14 14 0 0 1 5 5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function IconMsg() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v12H8l-4 3V5z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}

export default function PublicPetProfile() {
  const { t } = useI18n();
  const location = useLocation();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);

  const petId = useMemo(() => {
    const q = new URLSearchParams(location.search).get('id');
    return (q || params.id || '').trim();
  }, [location.search, params.id]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!petId) {
        setError(t('petPublic.missingId'));
        setLoading(false);
        return;
      }
      if (!isFirebaseConfigured()) {
        setError(t('petPublic.firebaseMissing'));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const db = getDb();
        const snap = await getDoc(doc(db, 'publicPets', petId));

        if (!snap.exists()) {
          if (!alive) return;
          setError(t('petPublic.notFound'));
          setLoading(false);
          return;
        }

        const raw = snap.data() || {};
        if (!alive) return;

        const friendly = raw.friendlyWith;
        const friendlyArr = Array.isArray(friendly) ? friendly.map((x) => String(x || '').toLowerCase()) : [];
        const friendlyObj = friendly && typeof friendly === 'object' && !Array.isArray(friendly) ? friendly : null;

        setProfile({
          id: petId,
          name: getSafe(raw.name, t('petPublic.unknown')),
          breed: getSafe(raw.breed),
          gender: raw.gender === 'female' ? 'female' : 'male',
          dob: firstNonEmpty(raw.dob, raw.dateOfBirth),
          color: firstNonEmpty(raw.color, raw.colorScheme),
          traits: firstNonEmpty(raw.traits, raw.identifyingMarks),
          notes: firstNonEmpty(raw.notes, raw.medicalNotes, raw.description),
          veterinarian: getSafe(raw.veterinarian),
          imageUrl: firstNonEmpty(raw.imageUrl, raw.photoUrl, petpalLogo),
          friendlyWith: {
            people: friendlyObj ? !!friendlyObj.people : friendlyArr.includes('people'),
            children: friendlyObj ? !!friendlyObj.children : friendlyArr.includes('children'),
            dogs: friendlyObj ? !!friendlyObj.dogs : friendlyArr.includes('dogs'),
            cats: friendlyObj ? !!friendlyObj.cats : friendlyArr.includes('cats'),
          },
          owner: {
            name: firstNonEmpty(raw.owner?.name, raw.ownerName),
            phone1: firstNonEmpty(raw.owner?.phone1, raw.ownerPhone),
            email: firstNonEmpty(raw.owner?.email, raw.ownerEmail),
            location: firstNonEmpty(raw.owner?.location, raw.ownerLocation),
            mapsQuery: firstNonEmpty(raw.owner?.mapsQuery, raw.ownerMapsQuery, raw.ownerLocation),
          },
          vet: {
            name: firstNonEmpty(raw.vet?.name, raw.vetName, raw.veterinarian),
            phone1: firstNonEmpty(raw.vet?.phone1, raw.vetPhone),
            email: firstNonEmpty(raw.vet?.email, raw.vetEmail),
            location: firstNonEmpty(raw.vet?.location, raw.vetLocation),
            mapsQuery: firstNonEmpty(raw.vet?.mapsQuery, raw.vetMapsQuery, raw.vetLocation),
          },
        });
      } catch (err) {
        if (!alive) return;
        const code = err?.code || '';
        if (code === 'permission-denied') {
          setError('Profile exists but is blocked by Firestore rules (permission-denied).');
        } else {
          const details = err?.message ? String(err.message) : '';
          setError(details ? `${t('petPublic.homeLoadProfileError')} (${details})` : t('petPublic.homeLoadProfileError'));
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    void run();
    return () => {
      alive = false;
    };
  }, [petId, t]);

  const ageLabel = profile ? formatAgeFromDob(profile.dob, t) : '';
  const metaLine = profile
    ? [profile.breed, ageLabel, profile.color].filter(Boolean).join(' · ')
    : '';
  const aboutText = profile ? firstNonEmpty(profile.notes, profile.traits, t('petPublic.aboutFallback')) : '';
  const phoneDigits = profile?.owner?.phone1 ? profile.owner.phone1.replace(/\D/g, '') : '';
  const friendlyActive = profile
    ? [
        profile.friendlyWith.dogs ? ['dogs', t('petPublic.dogs')] : null,
        profile.friendlyWith.people ? ['people', t('petPublic.people')] : null,
        profile.friendlyWith.children ? ['children', t('petPublic.children')] : null,
        profile.friendlyWith.cats ? ['cats', t('petPublic.cats')] : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="pp-publicPet">
      <main className="pp-publicPet__wrap">
        {loading ? <p className="pp-publicPet__state">{t('common.loading')}</p> : null}

        {!loading && error ? <p className="pp-publicPet__state pp-publicPet__state--error">{error}</p> : null}

        {!loading && !error && profile ? (
          <article className="pp-publicPet__sheet">
            <div className="pp-publicPet__banner">
              <img className="pp-publicPet__bannerImg" src={profile.imageUrl} alt="" />
            </div>

            <div className="pp-publicPet__sheetBody">
              <header className="pp-publicPet__identity">
                <img className="pp-publicPet__avatar" src={profile.imageUrl} alt={profile.name} />
                <div className="pp-publicPet__identityText">
                  <h1>
                    {profile.name}{' '}
                    <span className={`pp-publicPet__gender ${profile.gender === 'female' ? 'is-f' : 'is-m'}`} aria-hidden>
                      {profile.gender === 'female' ? '♀' : '♂'}
                    </span>
                  </h1>
                  {metaLine ? <p className="pp-publicPet__metaLine">{metaLine}</p> : null}
                </div>
              </header>

              <div className="pp-publicPet__foundNote" role="note">
                <IconAlert />
                <div>
                  <strong>{t('petPublic.foundTitle')}</strong>
                  <span>{t('petPublic.foundBody')}</span>
                </div>
              </div>

              <div className="pp-publicPet__contactBar">
                {profile.owner.phone1 ? (
                  <a className="pp-btn pp-btnPrimary pp-publicPet__contactMain" href={`tel:${profile.owner.phone1}`}>
                    {t('petPublic.contactOwner')}
                  </a>
                ) : (
                  <span className="pp-btn pp-btnPrimary pp-publicPet__contactMain is-disabled">{t('petPublic.contactOwner')}</span>
                )}
                {profile.owner.phone1 ? (
                  <a className="pp-publicPet__iconBtn" href={`tel:${profile.owner.phone1}`} aria-label={t('petPublic.callNow')}>
                    <IconPhone />
                  </a>
                ) : null}
                {phoneDigits ? (
                  <a
                    className="pp-publicPet__iconBtn"
                    href={`https://wa.me/${phoneDigits}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t('petPublic.sendWhatsApp')}
                  >
                    <IconMsg />
                  </a>
                ) : null}
                {profile.owner.email ? (
                  <a className="pp-publicPet__iconBtn" href={`mailto:${profile.owner.email}`} aria-label={t('petPublic.email')}>
                    <IconMail />
                  </a>
                ) : null}
              </div>

              {profile.owner.name || profile.owner.location ? (
                <p className="pp-publicPet__ownerLine">
                  {profile.owner.name ? <strong>{profile.owner.name}</strong> : null}
                  {profile.owner.name && profile.owner.location ? ' · ' : null}
                  {profile.owner.location || null}
                </p>
              ) : null}

              <section className="pp-publicPet__section">
                <h2>{t('petPublic.aboutHeading')}</h2>
                <p className="pp-publicPet__about">{aboutText}</p>
              </section>

              {friendlyActive.length ? (
                <section className="pp-publicPet__section">
                  <h2>{t('petPublic.friendly')}</h2>
                  <div className="pp-publicPet__friendlyRow">
                    {friendlyActive.map(([key, label]) => (
                      <span key={key} className="pp-publicPet__friendlyChip is-yes">
                        {label}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="pp-publicPet__section">
                <h2>{t('petPublic.dogInfo')}</h2>
                <dl className="pp-publicPet__kv">
                  <div className="pp-publicPet__kvRow"><dt>{t('petPublic.breed')}</dt><dd>{profile.breed || '-'}</dd></div>
                  <div className="pp-publicPet__kvRow">
                    <dt>{t('petPublic.gender')}</dt>
                    <dd>{profile.gender === 'female' ? t('petPublic.female') : t('petPublic.male')}</dd>
                  </div>
                  <div className="pp-publicPet__kvRow"><dt>{t('petPublic.dob')}</dt><dd>{profile.dob || '-'}</dd></div>
                  <div className="pp-publicPet__kvRow"><dt>{t('petPublic.color')}</dt><dd>{profile.color || '-'}</dd></div>
                  {profile.traits ? (
                    <div className="pp-publicPet__kvRow"><dt>{t('petPublic.traits')}</dt><dd>{profile.traits}</dd></div>
                  ) : null}
                  {profile.notes ? (
                    <div className="pp-publicPet__kvRow"><dt>{t('petPublic.medicalNotes')}</dt><dd>{profile.notes}</dd></div>
                  ) : null}
                  {profile.veterinarian ? (
                    <div className="pp-publicPet__kvRow"><dt>{t('petPublic.veterinarian')}</dt><dd>{profile.veterinarian}</dd></div>
                  ) : null}
                </dl>
              </section>

              {(profile.vet.name || profile.vet.phone1 || profile.vet.email) ? (
                <section className="pp-publicPet__section">
                  <h2>{t('petPublic.contactVet')}</h2>
                  {profile.vet.name ? <p className="pp-publicPet__person">{profile.vet.name}</p> : null}
                  <div className="pp-publicPet__actions">
                    {profile.vet.phone1 ? <a className="pp-btn pp-btnPrimary" href={`tel:${profile.vet.phone1}`}>{t('petPublic.callNow')}</a> : null}
                    {profile.vet.phone1 ? (
                      <a className="pp-btn" href={`https://wa.me/${profile.vet.phone1.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                        {t('petPublic.sendWhatsApp')}
                      </a>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="pp-publicPet__section">
                <h2>{t('petPublic.emergencyTitle')}</h2>
                <ol className="pp-publicPet__tips">
                  <li>{t('petPublic.emergencyText1')}</li>
                  <li>{t('petPublic.emergencyText2')}</li>
                  <li>{t('petPublic.emergencyText3')}</li>
                  <li>{t('petPublic.emergencyText4')}</li>
                </ol>
              </section>

              <p className="pp-publicPet__footer">{t('petPublic.footerThank')}</p>
              <p className="pp-publicPet__homeLink">
                <Link to="/">PetPal</Link>
              </p>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
}
