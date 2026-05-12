import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from '../firebase';
import { useI18n } from '../i18n/I18nContext';

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

function ContactRow({ label, value, href }) {
  return (
    <div className="pp-publicPet__metaRow">
      <span className="pp-publicPet__metaLabel">{label}</span>
      {href && value ? (
        <a className="pp-publicPet__metaValue" href={href}>{value}</a>
      ) : (
        <span className="pp-publicPet__metaValue">{value || '-'}</span>
      )}
    </div>
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
    const candidate = (q || params.id || '').trim();
    return candidate;
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
          name: getSafe(raw.name, 'Unknown'),
          breed: getSafe(raw.breed),
          gender: raw.gender === 'female' ? 'female' : 'male',
          dob: firstNonEmpty(raw.dob, raw.dateOfBirth),
          color: firstNonEmpty(raw.color, raw.colorScheme),
          microchip: firstNonEmpty(raw.microchip, raw.microchipNo, petId),
          traits: firstNonEmpty(raw.traits, raw.identifyingMarks),
          notes: firstNonEmpty(raw.notes, raw.medicalNotes, raw.description),
          veterinarian: getSafe(raw.veterinarian),
          imageUrl: firstNonEmpty(raw.imageUrl, raw.photoUrl, `${process.env.PUBLIC_URL || ''}/logo192.png`),
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

  return (
    <div className="pp-publicPet">
      <main className="pp-publicPet__wrap">
        {loading ? <p className="pp-publicPet__state">{t('common.loading')}</p> : null}

        {!loading && error ? <p className="pp-publicPet__state pp-publicPet__state--error">{error}</p> : null}

        {!loading && !error && profile ? (
          <>
            <section className="pp-publicPet__hero">
              <img className="pp-publicPet__photo" src={profile.imageUrl} alt={profile.name} />
              <h1>{profile.name}</h1>
              <p>{t('petPublic.heroMessage')}</p>
            </section>

            <section className="pp-publicPet__card">
              <h2>{t('petPublic.dogInfo')}</h2>
              <dl className="pp-publicPet__kv">
                <div className="pp-publicPet__kvRow"><dt>{t('petPublic.name')}</dt><dd>{profile.name}</dd></div>
                <div className="pp-publicPet__kvRow"><dt>{t('petPublic.breed')}</dt><dd>{profile.breed || '-'}</dd></div>
                <div className="pp-publicPet__kvRow"><dt>{t('petPublic.gender')}</dt><dd>{profile.gender === 'female' ? t('petPublic.female') : t('petPublic.male')}</dd></div>
                <div className="pp-publicPet__kvRow"><dt>{t('petPublic.dob')}</dt><dd>{profile.dob || '-'}</dd></div>
                <div className="pp-publicPet__kvRow"><dt>{t('petPublic.color')}</dt><dd>{profile.color || '-'}</dd></div>
                <div className="pp-publicPet__kvRow"><dt>{t('petPublic.microchip')}</dt><dd>{profile.microchip}</dd></div>
                <div className="pp-publicPet__kvRow"><dt>{t('petPublic.traits')}</dt><dd>{profile.traits || '-'}</dd></div>
                <div className="pp-publicPet__kvRow"><dt>{t('petPublic.medicalNotes')}</dt><dd>{profile.notes || '-'}</dd></div>
                <div className="pp-publicPet__kvRow"><dt>{t('petPublic.veterinarian')}</dt><dd>{profile.veterinarian || '-'}</dd></div>
              </dl>
            </section>

            <section className="pp-publicPet__card">
              <h2>{t('petPublic.friendly')}</h2>
              <div className="pp-publicPet__friendlyRow">
                <span className={`pp-publicPet__friendlyChip ${profile.friendlyWith.people ? 'is-yes' : 'is-no'}`}>
                  {profile.friendlyWith.people ? '✅' : '❌'} {t('petPublic.people')}
                </span>
                <span className={`pp-publicPet__friendlyChip ${profile.friendlyWith.children ? 'is-yes' : 'is-no'}`}>
                  {profile.friendlyWith.children ? '✅' : '❌'} {t('petPublic.children')}
                </span>
                <span className={`pp-publicPet__friendlyChip ${profile.friendlyWith.dogs ? 'is-yes' : 'is-no'}`}>
                  {profile.friendlyWith.dogs ? '✅' : '❌'} {t('petPublic.dogs')}
                </span>
                <span className={`pp-publicPet__friendlyChip ${profile.friendlyWith.cats ? 'is-yes' : 'is-no'}`}>
                  {profile.friendlyWith.cats ? '✅' : '❌'} {t('petPublic.cats')}
                </span>
              </div>
            </section>

            <section className="pp-publicPet__card">
              <h2>{t('petPublic.contactOwner')}</h2>
              <div className="pp-publicPet__meta">
                <ContactRow label={t('petPublic.owner')} value={profile.owner.name || '-'} />
                <ContactRow label={t('petPublic.phone')} value={profile.owner.phone1} />
                <ContactRow label={t('petPublic.email')} value={profile.owner.email} href={profile.owner.email ? `mailto:${profile.owner.email}` : ''} />
                <ContactRow label={t('petPublic.location')} value={profile.owner.location} />
              </div>
              <div className="pp-publicPet__actions">
                {profile.owner.phone1 ? <a className="pp-btn pp-btnPrimary" href={`tel:${profile.owner.phone1}`}>{t('petPublic.callNow')}</a> : null}
                {profile.owner.phone1 ? <a className="pp-btn" href={`https://wa.me/${profile.owner.phone1.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{t('petPublic.sendWhatsApp')}</a> : null}
                {profile.owner.mapsQuery || profile.owner.location ? (
                  <a className="pp-btn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.owner.mapsQuery || profile.owner.location)}`} target="_blank" rel="noreferrer">
                    {t('petPublic.openMaps')}
                  </a>
                ) : null}
              </div>
            </section>

            <section className="pp-publicPet__card">
              <h2>{t('petPublic.contactVet')}</h2>
              <p className="pp-publicPet__person">{profile.vet.name || t('petPublic.vet')}</p>
              <div className="pp-publicPet__meta">
                <ContactRow label={t('petPublic.phone')} value={profile.vet.phone1} />
                <ContactRow label={t('petPublic.email')} value={profile.vet.email} />
                <ContactRow label={t('petPublic.location')} value={profile.vet.location} />
              </div>
              <div className="pp-publicPet__actions">
                {profile.vet.phone1 ? <a className="pp-btn pp-btnPrimary" href={`tel:${profile.vet.phone1}`}>{t('petPublic.callNow')}</a> : null}
                {profile.vet.phone1 ? <a className="pp-btn" href={`https://wa.me/${profile.vet.phone1.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{t('petPublic.sendWhatsApp')}</a> : null}
                {profile.vet.mapsQuery || profile.vet.location ? (
                  <a className="pp-btn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.vet.mapsQuery || profile.vet.location)}`} target="_blank" rel="noreferrer">
                    {t('petPublic.openMaps')}
                  </a>
                ) : null}
              </div>
            </section>

            <section className="pp-publicPet__card">
              <h2>{t('petPublic.emergencyTitle')}</h2>
              <ol className="pp-publicPet__tips">
                <li>{t('petPublic.emergencyText1')}</li>
                <li>{t('petPublic.emergencyText2')}</li>
                <li>{t('petPublic.emergencyText3')}</li>
                <li>{t('petPublic.emergencyText4')}</li>
              </ol>
            </section>

            <p className="pp-publicPet__nfc">📡 {t('petPublic.nfcNote')}</p>
            <p className="pp-publicPet__footer">{t('petPublic.footerThank')}</p>
            <p className="pp-publicPet__homeLink">
              <Link to="/">PetPal</Link>
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}