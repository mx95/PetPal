import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { usePets } from '../pets/PetsContext';
import { useGame } from '../game/GameContext';
import { walkStreakDays } from '../walk/walkStats';
import { getDb, isFirebaseConfigured } from '../firebase';
import UserAvatar from '../components/UserAvatar';
import { useToast } from '../components/Toast';
import { getEffectiveProfilePhotoUrl, removeUserProfilePhoto, saveUserProfilePhoto } from '../profile/userProfilePhoto';

const ICONS = {
  pets: '🐾',
  business: '🏪',
  docs: '📖',
  admin: '🛡️',
  signOut: '👋',
};

function ProfileActionCard({ to, icon, title, desc, accent, onClick }) {
  const cls = `pp-actionCard pp-actionCard--${accent}`;
  const inner = (
    <>
      <span className="pp-actionCard__icon" aria-hidden>{icon}</span>
      <div className="pp-actionCard__body">
        <span className="pp-actionCard__title">{title}</span>
        <span className="pp-actionCard__desc">{desc}</span>
      </div>
      <span className="pp-actionCard__arrow" aria-hidden>→</span>
    </>
  );
  if (to) {
    return <Link to={to} className={cls}>{inner}</Link>;
  }
  return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useCompany();
  const { pets } = usePets();
  const { walkLog, ownerXp, level, achievementCount, lifetimeStats } = useGame();
  const { t } = useI18n();
  const { show } = useToast();
  const fileRef = useRef(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileErr, setProfileErr] = useState('');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [form, setForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
    phone: '',
    phone2: '',
    whatsapp: '',
    location: '',
  });
  const [profileMeta, setProfileMeta] = useState({
    accountType: 'individual',
    accountNameNormalized: '',
  });

  const streak = walkStreakDays(walkLog);
  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  const titleName = displayName
    ? `${displayName.charAt(0).toLocaleUpperCase()}${displayName.slice(1).toLocaleLowerCase()}`
    : '';
  const hasPhoto = Boolean(user && getEffectiveProfilePhotoUrl(user));

  React.useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!user?.uid) return;
      try {
        if (!isFirebaseConfigured()) {
          if (!cancelled) {
            setForm((prev) => ({ ...prev, username: user.displayName || '' }));
            setProfileLoaded(true);
          }
          return;
        }
        const snap = await getDoc(doc(getDb(), 'users', user.uid));
        const data = snap.exists() ? snap.data() : {};
        if (cancelled) return;
        setForm({
          username: String(data.accountName || user.displayName || '').trim(),
          firstName: String(data.firstName || '').trim(),
          lastName: String(data.lastName || '').trim(),
          phone: String(data.phone || '').trim(),
          phone2: String(data.phone2 || '').trim(),
          whatsapp: String(data.whatsapp || '').trim(),
          location: String(data.location || '').trim(),
        });
        setProfileMeta({
          accountType: String(data.accountType || 'individual'),
          accountNameNormalized: String(data.accountNameNormalized || '').trim().toLocaleLowerCase(),
        });
      } catch {
        if (!cancelled) setProfileErr(t('profile.form.loadError'));
      } finally {
        if (!cancelled) setProfileLoaded(true);
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user, t]);

  function onFieldChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function normalizePhone(value) {
    return String(value || '').replace(/\s+/g, '');
  }

  function validIntlPhone(value) {
    if (!value) return true;
    return /^\+[1-9]\d{6,14}$/.test(value);
  }

  function normalizeAccountName(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }

  async function onSaveProfile(e) {
    e.preventDefault();
    if (!user?.uid || !isFirebaseConfigured() || profileBusy) return;
    setProfileErr('');

    const phone = normalizePhone(form.phone);
    const phone2 = normalizePhone(form.phone2);
    const whatsapp = normalizePhone(form.whatsapp);
    const username = String(form.username || '').trim();
    const nextNameNormalized = normalizeAccountName(username);

    if (username.length < 2) {
      setProfileErr(t('register.nameRequired'));
      return;
    }

    if (!validIntlPhone(phone) || !validIntlPhone(phone2) || !validIntlPhone(whatsapp)) {
      setProfileErr(t('profile.form.phoneValidation'));
      return;
    }

    setProfileBusy(true);
    try {
      if (isFirebaseConfigured() && nextNameNormalized && nextNameNormalized !== profileMeta.accountNameNormalized) {
        try {
          const db = getDb();
          await runTransaction(db, async (tx) => {
            const newRef = doc(db, 'accountNames', nextNameNormalized);
            const newSnap = await tx.get(newRef);
            if (newSnap.exists() && newSnap.data()?.uid !== user.uid) {
              throw new Error('NAME_TAKEN');
            }
            tx.set(
              newRef,
              {
                uid: user.uid,
                accountType: profileMeta.accountType || 'individual',
                accountName: username,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
            if (profileMeta.accountNameNormalized && profileMeta.accountNameNormalized !== nextNameNormalized) {
              tx.delete(doc(db, 'accountNames', profileMeta.accountNameNormalized));
            }
          });
        } catch (err) {
          if (err?.message === 'NAME_TAKEN') {
            setProfileErr(t('register.usernameTaken'));
            setProfileBusy(false);
            return;
          }
          setProfileErr(t('register.nameCheckFailed'));
          setProfileBusy(false);
          return;
        }
      }

      await setDoc(
        doc(getDb(), 'users', user.uid),
        {
          uid: user.uid,
          email: user.email || '',
          accountName: username,
          accountNameNormalized: nextNameNormalized,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone,
          phone2,
          whatsapp,
          location: form.location.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      try {
        await updateProfile(user, { displayName: username });
      } catch {
        // Firestore stays source of truth even if auth displayName update fails.
      }
      setProfileMeta((prev) => ({ ...prev, accountNameNormalized: nextNameNormalized }));
      setProfileModalOpen(false);
      show(t('profile.form.saved'), { kind: 'success' });
    } catch {
      setProfileErr(t('profile.form.saveError'));
    } finally {
      setProfileBusy(false);
    }
  }

  const items = [
    { key: 'pets', to: '/pets', icon: ICONS.pets, accent: 'pets' },
    { key: 'business', to: '/company/apply', icon: ICONS.business, accent: 'business' },
    { key: 'docs', to: '/docs', icon: ICONS.docs, accent: 'docs' },
    ...(isAdmin ? [{ key: 'admin', to: '/admin', icon: ICONS.admin, accent: 'admin' }] : []),
  ];

  async function onPickPhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !user) return;
    setPhotoBusy(true);
    try {
      const { mode } = await saveUserProfilePhoto(user, f);
      if (mode === 'firebase' && isFirebaseConfigured()) {
        await setDoc(
          doc(getDb(), 'users', user.uid),
          {
            profilePhotoUrl: user.photoURL || '',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      show(
        mode === 'firebase' ? t('profile.photo.toastSavedCloud') : t('profile.photo.toastSavedLocal'),
        { kind: 'success' }
      );
    } catch (err) {
      const code = err?.message;
      if (code === 'NOT_IMAGE') show(t('profile.photo.errNotImage'), { kind: 'error' });
      else if (code === 'TOO_LARGE') show(t('profile.photo.errTooLarge'), { kind: 'error' });
      else if (code === 'LOCAL_STORAGE_FULL') show(t('profile.photo.errStorage'), { kind: 'error' });
      else show(t('profile.photo.errGeneric'), { kind: 'error' });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onRemovePhoto() {
    if (!user) return;
    const ok = window.confirm(t('profile.photo.confirmRemove'));
    if (!ok) return;
    setPhotoBusy(true);
    try {
      await removeUserProfilePhoto(user);
      show(t('profile.photo.toastRemoved'), { kind: 'success' });
    } catch {
      show(t('profile.photo.errGeneric'), { kind: 'error' });
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <header className="pp-pageHeader">
          <div className="pp-pageHeader__copy">
            <span className="pp-publicHero__eyebrow" style={{ display: 'inline-block', width: 'fit-content' }}>
              {t('profile.badge')}
            </span>
            <h1 className="pp-pageHeader__title">{t('profile.titleFriendly', { name: titleName || t('profile.youFallback') })}</h1>
            <p className="pp-pageHeader__sub">{t('profile.introFriendly')}</p>
          </div>
        </header>
      </div>

      <div className="pp-col-12">
        <section className="pp-heroCard" aria-label={t('profile.headerAria')}>
          <div className="pp-heroCard__avatar" aria-hidden>
            <UserAvatar user={user} size={64} />
          </div>
          <div className="pp-heroCard__copy">
            <span className="pp-heroCard__eyebrow">{t('profile.headerEyebrow')}</span>
            <h2 className="pp-heroCard__title">{displayName || t('profile.youFallback')}</h2>
            <p className="pp-heroCard__sub">{user?.email || ''}</p>
            <div className="pp-heroCard__statRow">
              <span className="pp-heroCard__statChip">⭐ {t('profile.chipLevel', { n: level })}</span>
              <span className="pp-heroCard__statChip">⚡ {t('profile.chipXp', { n: ownerXp })}</span>
              {streak > 0 ? (
                <span className="pp-heroCard__statChip">🔥 {t('profile.chipStreak', { n: streak })}</span>
              ) : null}
              <span className="pp-heroCard__statChip">🏅 {t('profile.chipBadges', { n: achievementCount })}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="pp-col-12">
        <div className="pp-grid" style={{ marginBottom: 0 }}>
          <div className="pp-col-3">
            <div className="pp-statTile pp-profileStatTile pp-profileStatTile--pets">
              <span className="pp-profileStatTile__top">
                <span className="pp-profileStatTile__icon" aria-hidden>🐾</span>
                <span className="pp-statTile__label">{t('profile.statPets')}</span>
              </span>
              <span className="pp-statTile__value">{pets.length}</span>
              <span className="pp-statTile__hint">{t('profile.statPetsHint')}</span>
            </div>
          </div>
          <div className="pp-col-3">
            <div className="pp-statTile pp-profileStatTile pp-profileStatTile--km">
              <span className="pp-profileStatTile__top">
                <span className="pp-profileStatTile__icon" aria-hidden>📍</span>
                <span className="pp-statTile__label">{t('profile.statKm')}</span>
              </span>
              <span className="pp-statTile__value">{(lifetimeStats?.km || 0).toFixed(1)}</span>
              <span className="pp-statTile__hint">{t('profile.statKmHint')}</span>
            </div>
          </div>
          <div className="pp-col-3">
            <div className="pp-statTile pp-profileStatTile pp-profileStatTile--walks">
              <span className="pp-profileStatTile__top">
                <span className="pp-profileStatTile__icon" aria-hidden>🚶</span>
                <span className="pp-statTile__label">{t('profile.statWalks')}</span>
              </span>
              <span className="pp-statTile__value">{lifetimeStats?.walks || 0}</span>
              <span className="pp-statTile__hint">{t('profile.statWalksHint')}</span>
            </div>
          </div>
          <div className="pp-col-3">
            <div className="pp-statTile pp-profileStatTile pp-profileStatTile--streak">
              <span className="pp-profileStatTile__top">
                <span className="pp-profileStatTile__icon" aria-hidden>🔥</span>
                <span className="pp-statTile__label">{t('profile.statStreak')}</span>
              </span>
              <span className="pp-statTile__value">{streak}</span>
              <span className="pp-statTile__hint">{t('profile.statStreakHint')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pp-col-12">
        <h2 className="pp-feed__sectionTitle" style={{ margin: '6px 4px 12px' }}>{t('profile.actionsTitle')}</h2>
        <div className="pp-actionGrid">
          <ProfileActionCard
            icon="✏️"
            title={t('profile.action.editProfile.title')}
            desc={t('profile.action.editProfile.desc')}
            accent="docs"
            onClick={() => {
              setProfileErr('');
              setProfileModalOpen(true);
            }}
          />
          {items.map((it) => (
            <ProfileActionCard
              key={it.key}
              to={it.to}
              icon={it.icon}
              title={t(`profile.action.${it.key}.title`)}
              desc={t(`profile.action.${it.key}.desc`)}
              accent={it.accent}
            />
          ))}
          <ProfileActionCard
            icon={ICONS.signOut}
            title={t('profile.action.signOut.title')}
            desc={t('profile.action.signOut.desc')}
            accent="docs"
            onClick={signOut}
          />
        </div>
      </div>

      {profileModalOpen ? (
        <div className="pp-modalWrap" role="dialog" aria-modal="true" aria-label={t('profile.form.title')}>
          <div className="pp-modalBackdrop" aria-hidden />
          <section className="pp-modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="pp-modalHead">
              <h3 className="pp-profileEditorTitle" style={{ margin: 0 }}>{t('profile.form.title')}</h3>
            </div>

            {!profileLoaded ? (
              <p className="pp-subtle" style={{ padding: '0 18px 18px' }}>{t('profile.form.loading')}</p>
            ) : (
              <form className="pp-modalForm" onSubmit={onSaveProfile}>
                <p className="pp-profileEditorSub" style={{ marginTop: 0 }}>{t('profile.form.subtitle')}</p>

                <h3 className="pp-profilePhotoTitle" style={{ marginBottom: 14 }}>{t('profile.photo.title')}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <UserAvatar user={user} size={68} />
                  <div className="pp-profilePhotoRow" style={{ marginBottom: 0 }}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="pp-visuallyHidden"
                      onChange={onPickPhoto}
                      aria-label={t('profile.photo.upload')}
                    />
                    <button
                      type="button"
                      className="pp-btn pp-btnPrimary"
                      disabled={photoBusy}
                      onClick={() => fileRef.current?.click()}
                    >
                      {photoBusy ? t('profile.photo.uploading') : t('profile.photo.upload')}
                    </button>
                    {hasPhoto ? (
                      <button type="button" className="pp-btn pp-btn--ghost" disabled={photoBusy} onClick={onRemovePhoto}>
                        {t('profile.photo.remove')}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="pp-profileEditorGrid">
                  <div>
                    <label className="pp-label" htmlFor="pp-username">{t('profile.form.username')}</label>
                    <input id="pp-username" className="pp-input" value={form.username} onChange={(e) => onFieldChange('username', e.target.value)} minLength={2} />
                  </div>
                  <div>
                    <label className="pp-label" htmlFor="pp-first-name">{t('profile.form.firstName')}</label>
                    <input id="pp-first-name" className="pp-input" value={form.firstName} onChange={(e) => onFieldChange('firstName', e.target.value)} />
                  </div>
                  <div>
                    <label className="pp-label" htmlFor="pp-last-name">{t('profile.form.lastName')}</label>
                    <input id="pp-last-name" className="pp-input" value={form.lastName} onChange={(e) => onFieldChange('lastName', e.target.value)} />
                  </div>
                  <div>
                    <label className="pp-label" htmlFor="pp-phone">{t('profile.form.phone')}</label>
                    <input id="pp-phone" className="pp-input" value={form.phone} onChange={(e) => onFieldChange('phone', e.target.value)} placeholder="+35799123456" />
                  </div>
                  <div>
                    <label className="pp-label" htmlFor="pp-phone2">{t('profile.form.phone2')}</label>
                    <input id="pp-phone2" className="pp-input" value={form.phone2} onChange={(e) => onFieldChange('phone2', e.target.value)} placeholder="+35722123456" />
                  </div>
                  <div>
                    <label className="pp-label" htmlFor="pp-contact-email">{t('profile.form.email')}</label>
                    <input id="pp-contact-email" className="pp-input" type="email" value={user?.email || ''} disabled readOnly />
                  </div>
                  <div>
                    <label className="pp-label" htmlFor="pp-whatsapp">{t('profile.form.whatsapp')}</label>
                    <input id="pp-whatsapp" className="pp-input" value={form.whatsapp} onChange={(e) => onFieldChange('whatsapp', e.target.value)} placeholder="+35799123456" />
                  </div>
                  <div className="pp-profileEditorGrid__full">
                    <label className="pp-label" htmlFor="pp-location">{t('profile.form.location')}</label>
                    <input id="pp-location" className="pp-input" value={form.location} onChange={(e) => onFieldChange('location', e.target.value)} placeholder={t('profile.form.locationPlaceholder')} />
                  </div>
                </div>

                <p className="pp-subtle pp-profileEditorHint">{t('profile.form.phoneHint')}</p>
                {profileErr ? <div className="pp-error">{profileErr}</div> : null}

                <div className="pp-modalActions">
                  <button
                    type="button"
                    className="pp-btn pp-btn--ghost"
                    onClick={() => setProfileModalOpen(false)}
                    disabled={profileBusy || photoBusy}
                  >
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="pp-btn pp-btnPrimary" disabled={profileBusy}>
                    {profileBusy ? t('profile.form.saving') : t('profile.form.save')}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
