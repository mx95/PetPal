import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { usePets } from '../pets/PetsContext';
import { syncOwnerContactToPets } from '../pets/petsFirestore';
import { useGame } from '../game/GameContext';
import { walkStreakDays } from '../walk/walkStats';
import { getDb, isFirebaseConfigured } from '../firebase';
import UserAvatar from '../components/UserAvatar';
import { useToast } from '../components/Toast';
import { getEffectiveProfilePhotoUrl, removeUserProfilePhoto, saveUserProfilePhoto } from '../profile/userProfilePhoto';
import { MVP_NAV } from '../config/mvpNav';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

const ICONS = {
  pets: '🐾',
  business: '🏪',
  docs: '📖',
  admin: '🛡️',
  adminBookings: '📅',
  orders: '📦',
  signOut: '👋',
};

function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.5c1.2-3.2 3.4-4.8 6.5-4.8s5.3 1.6 6.5 4.8" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 4.5h3l1.2 3.2-1.6 1.2a11 11 0 0 0 4.7 4.7l1.2-1.6 3.2 1.2v3a2 2 0 0 1-2.2 2A14.5 14.5 0 0 1 4.5 6.7a2 2 0 0 1 2-2.2z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4.5 7.5 12 13l7.5-5.5" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M12.04 3.5a8.4 8.4 0 0 0-7.2 12.7L4 20.5l4.45-.9A8.4 8.4 0 1 0 12.04 3.5zm4.9 11.9c-.2.57-1.17 1.05-1.62 1.12-.41.06-.94.09-1.52-.09-.35-.11-.8-.26-1.38-.51-2.43-1.05-4.01-3.5-4.13-3.66-.12-.16-1-1.33-1-2.54 0-1.2.63-1.8.86-2.04.22-.24.49-.3.65-.3h.47c.15 0 .35-.06.55.42.2.5.69 1.72.75 1.84.06.12.1.27.02.43-.08.16-.12.27-.24.41-.12.15-.25.33-.36.44-.12.12-.24.25-.1.48.14.24.63 1.04 1.35 1.68.93.83 1.71 1.09 1.95 1.21.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.57-.14 1.14z" />
    </svg>
  );
}

function formatPhoneDisplay(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+357') && digits.length >= 12) {
    return `+357 ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }
  return raw;
}

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
  const { isAdmin, isApprovedCompany, isCompanyAccount, profile } = useCompany();
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
  const [profilePanel, setProfilePanel] = useState('hub'); // hub | personal | contact
  const [extraContactOpen, setExtraContactOpen] = useState(true);
  useBodyScrollLock(profileModalOpen);
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

  const fullName = useMemo(() => {
    const parts = [form.firstName, form.lastName].map((s) => String(s || '').trim()).filter(Boolean);
    if (parts.length) return parts.join(' ');
    return displayName || t('profile.youFallback');
  }, [form.firstName, form.lastName, displayName, t]);

  const handleLabel = form.username ? `@${form.username.replace(/^@/, '')}` : '';

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

      await syncOwnerContactToPets(user.uid, {
        ownerName: username,
        ownerPhone: phone,
        ownerEmail: user.email || '',
        ownerLocation: form.location.trim(),
        ownerMapsQuery: form.location.trim(),
      });

      try {
        await updateProfile(user, { displayName: username });
      } catch {
        // Firestore stays source of truth even if auth displayName update fails.
      }
      setProfileMeta((prev) => ({ ...prev, accountNameNormalized: nextNameNormalized }));
      setForm((prev) => ({ ...prev, phone, phone2, whatsapp }));
      setProfilePanel('hub');
      setProfileModalOpen(false);
      show(t('profile.form.saved'), { kind: 'success' });
    } catch {
      setProfileErr(t('profile.form.saveError'));
    } finally {
      setProfileBusy(false);
    }
  }

  function openProfileModal() {
    setProfileErr('');
    setProfilePanel('hub');
    setExtraContactOpen(true);
    setProfileModalOpen(true);
  }

  function closeProfileModal() {
    setProfileModalOpen(false);
    setProfilePanel('hub');
    setProfileErr('');
  }

  const items = [
    { key: 'pets', to: '/pets', icon: ICONS.pets, accent: 'pets' },
    { key: 'orders', to: '/profile/orders', icon: ICONS.orders, accent: 'docs' },
    ...(MVP_NAV.showBookings ? [{ key: 'bookings', to: '/bookings', icon: ICONS.docs, accent: 'docs' }] : []),
    ...(isCompanyAccount
      ? [{ key: 'provider', to: '/provider', icon: ICONS.business, accent: 'business' }]
      : []),
    { key: 'business', to: '/company/apply', icon: ICONS.business, accent: 'business' },
    { key: 'docs', to: '/docs', icon: ICONS.docs, accent: 'docs' },
    ...(isAdmin ? [{ key: 'admin', to: '/admin', icon: ICONS.admin, accent: 'admin' }] : []),
    ...(isAdmin ? [{ key: 'adminBookings', to: '/admin/bookings', icon: ICONS.adminBookings, accent: 'admin' }] : []),
    ...(isAdmin ? [{ key: 'adminOrders', to: '/admin/orders', icon: ICONS.orders, accent: 'admin' }] : []),
    ...(isAdmin ? [{ key: 'adminSupport', to: '/admin/support', icon: ICONS.admin, accent: 'admin' }] : []),
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
        <section className="pp-heroCard" aria-label={t('profile.headerAria')}>
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
            className="pp-heroCard__avatar pp-profilePhotoEdit"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            aria-label={photoBusy ? t('profile.photo.uploading') : t('profile.photo.upload')}
          >
            <UserAvatar user={user} size={64} />
            <span className="pp-profilePhotoEdit__badge" aria-hidden>📷</span>
          </button>
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
            onClick={openProfileModal}
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
        <div
          className="pp-modalWrap"
          role="dialog"
          aria-modal="true"
          aria-label={
            profilePanel === 'contact'
              ? t('profile.form.contactTitle')
              : profilePanel === 'personal'
                ? t('profile.form.personalTitle')
                : t('profile.form.title')
          }
        >
          <div className="pp-modalBackdrop" aria-hidden onClick={closeProfileModal} />
          <section className="pp-modalCard pp-profileModalCard" onClick={(e) => e.stopPropagation()}>
            {!profileLoaded ? (
              <p className="pp-subtle" style={{ padding: '18px' }}>{t('profile.form.loading')}</p>
            ) : (
              <form className="pp-modalForm pp-profileModalForm" onSubmit={onSaveProfile}>
                {profilePanel === 'hub' ? (
                  <>
                    <header className="pp-profileModalHead">
                      <h3 className="pp-profileEditorTitle">{t('profile.form.title')}</h3>
                      <p className="pp-profileEditorSub">{t('profile.form.subtitleShort')}</p>
                    </header>

                    <button
                      type="button"
                      className="pp-profileIdentityCard pp-profileIdentityCard--merged"
                      onClick={() => setProfilePanel('personal')}
                    >
                      <span
                        className="pp-profileIdentityCard__avatarBtn"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          fileRef.current?.click();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            fileRef.current?.click();
                          }
                        }}
                        aria-label={photoBusy ? t('profile.photo.uploading') : t('profile.form.changePhoto')}
                      >
                        <UserAvatar user={user} size={72} />
                        <span className="pp-profilePhotoEdit__badge" aria-hidden>📷</span>
                      </span>
                      <span className="pp-profileIdentityCard__copy">
                        <strong>{fullName}</strong>
                        {handleLabel ? <span className="pp-profileIdentityCard__handle">{handleLabel}</span> : null}
                        <span className="pp-profileIdentityCard__photoLink">
                          {photoBusy ? t('profile.photo.uploading') : t('profile.form.changePhoto')}
                        </span>
                        <small className="pp-profileIdentityCard__meta">
                          {t('profile.form.firstName')}: {form.firstName || '—'}
                          {' · '}
                          {t('profile.form.lastName')}: {form.lastName || '—'}
                          {' · '}
                          {t('profile.form.location')}: {form.location || '—'}
                        </small>
                      </span>
                      <span className="pp-editNavChev" aria-hidden>›</span>
                    </button>

                    <div className="pp-editNavList pp-profileHubList">
                      <button type="button" className="pp-editNavItem" onClick={() => setProfilePanel('contact')}>
                        <span className="pp-editNavIco is-green"><IconPhone /></span>
                        <span>
                          <strong>{t('profile.form.contactTitleShort')}</strong>
                          <small>
                            {t('profile.form.phone')}: {formatPhoneDisplay(form.phone)}
                            {' · '}
                            {t('profile.form.email')}: {user?.email || '—'}
                          </small>
                        </span>
                        <span className="pp-editNavChev">›</span>
                      </button>

                      <button
                        type="button"
                        className="pp-editNavItem"
                        onClick={() => {
                          setExtraContactOpen(true);
                          setProfilePanel('contact');
                        }}
                      >
                        <span className="pp-editNavIco is-green"><IconWhatsApp /></span>
                        <span>
                          <strong>{t('profile.form.extraContactTitle')}</strong>
                          <small>
                            {t('profile.form.phone2')}: {formatPhoneDisplay(form.phone2)}
                            {' · '}
                            {t('profile.form.whatsapp')}: {formatPhoneDisplay(form.whatsapp)}
                          </small>
                        </span>
                        <span className="pp-editNavChev">›</span>
                      </button>
                    </div>
                  </>
                ) : null}

                {profilePanel === 'personal' ? (
                  <>
                    <header className="pp-profileModalHead pp-profileModalHead--back">
                      <button
                        type="button"
                        className="pp-iconRoundBtn"
                        onClick={() => setProfilePanel('hub')}
                        aria-label={t('common.back')}
                      >
                        ←
                      </button>
                      <div>
                        <h3 className="pp-profileEditorTitle">{t('profile.form.personalTitle')}</h3>
                        <p className="pp-profileEditorSub">{t('profile.form.personalSub')}</p>
                      </div>
                    </header>

                    <div className="pp-profileFieldStack">
                      <div>
                        <label className="pp-label" htmlFor="pp-username">{t('profile.form.username')}</label>
                        <div className="pp-profileField">
                          <span className="pp-profileField__ico is-purple" aria-hidden><IconPerson /></span>
                          <input
                            id="pp-username"
                            className="pp-input pp-profileField__input"
                            value={form.username}
                            onChange={(e) => onFieldChange('username', e.target.value)}
                            minLength={2}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="pp-label" htmlFor="pp-first-name">{t('profile.form.firstName')}</label>
                        <div className="pp-profileField">
                          <span className="pp-profileField__ico is-purple" aria-hidden><IconPerson /></span>
                          <input
                            id="pp-first-name"
                            className="pp-input pp-profileField__input"
                            value={form.firstName}
                            onChange={(e) => onFieldChange('firstName', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="pp-label" htmlFor="pp-last-name">{t('profile.form.lastName')}</label>
                        <div className="pp-profileField">
                          <span className="pp-profileField__ico is-purple" aria-hidden><IconPerson /></span>
                          <input
                            id="pp-last-name"
                            className="pp-input pp-profileField__input"
                            value={form.lastName}
                            onChange={(e) => onFieldChange('lastName', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="pp-profileLocCard">
                        <div className="pp-profileLocCard__head">
                          <span className="pp-editNavIco is-purple"><IconPin /></span>
                          <div>
                            <strong>{t('profile.form.location')}</strong>
                            <small>{t('profile.form.locationHint')}</small>
                          </div>
                        </div>
                        <input
                          id="pp-location-personal"
                          className="pp-input"
                          value={form.location}
                          onChange={(e) => onFieldChange('location', e.target.value)}
                          placeholder={t('profile.form.locationPlaceholder')}
                        />
                      </div>
                      {hasPhoto ? (
                        <button type="button" className="pp-btn pp-btn--ghost" disabled={photoBusy} onClick={onRemovePhoto}>
                          {t('profile.photo.remove')}
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {profilePanel === 'contact' ? (
                  <>
                    <header className="pp-profileModalHead pp-profileModalHead--back">
                      <button
                        type="button"
                        className="pp-iconRoundBtn"
                        onClick={() => setProfilePanel('hub')}
                        aria-label={t('common.back')}
                      >
                        ←
                      </button>
                      <div>
                        <h3 className="pp-profileEditorTitle">{t('profile.form.contactTitle')}</h3>
                        <p className="pp-profileEditorSub">{t('profile.form.contactSub')}</p>
                      </div>
                    </header>

                    <div className="pp-profileFieldStack">
                      <div>
                        <label className="pp-label" htmlFor="pp-phone">
                          {t('profile.form.phoneNumber')} <span aria-hidden>*</span>
                        </label>
                        <div className="pp-profileField">
                          <span className="pp-profileField__ico is-purple" aria-hidden><IconPhone /></span>
                          <input
                            id="pp-phone"
                            className="pp-input pp-profileField__input"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={form.phone}
                            onChange={(e) => onFieldChange('phone', e.target.value)}
                            placeholder="+35799123456"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="pp-label" htmlFor="pp-contact-email">
                          {t('profile.form.email')} <span aria-hidden>*</span>
                        </label>
                        <div className="pp-profileField">
                          <span className="pp-profileField__ico is-purple" aria-hidden><IconMail /></span>
                          <input
                            id="pp-contact-email"
                            className="pp-input pp-profileField__input"
                            type="email"
                            value={user?.email || ''}
                            disabled
                            readOnly
                          />
                        </div>
                      </div>

                      <div className={`pp-profileExtraCard ${extraContactOpen ? 'is-open' : ''}`}>
                        <button
                          type="button"
                          className="pp-profileExtraCard__toggle"
                          aria-expanded={extraContactOpen}
                          onClick={() => setExtraContactOpen((v) => !v)}
                        >
                          <span>{t('profile.form.extraContactTitle')}</span>
                          <span aria-hidden>{extraContactOpen ? '▴' : '▾'}</span>
                        </button>
                        {extraContactOpen ? (
                          <div className="pp-profileExtraCard__body">
                            <div>
                              <label className="pp-label" htmlFor="pp-phone2">{t('profile.form.phone2')}</label>
                              <div className="pp-profileField">
                                <span className="pp-profileField__ico is-purple" aria-hidden><IconPhone /></span>
                                <input
                                  id="pp-phone2"
                                  className="pp-input pp-profileField__input"
                                  type="tel"
                                  inputMode="tel"
                                  autoComplete="tel"
                                  value={form.phone2}
                                  onChange={(e) => onFieldChange('phone2', e.target.value)}
                                  placeholder="+35722123456"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="pp-label" htmlFor="pp-whatsapp">{t('profile.form.whatsapp')}</label>
                              <div className="pp-profileField">
                                <span className="pp-profileField__ico is-green" aria-hidden><IconWhatsApp /></span>
                                <input
                                  id="pp-whatsapp"
                                  className="pp-input pp-profileField__input"
                                  type="tel"
                                  inputMode="tel"
                                  autoComplete="tel"
                                  value={form.whatsapp}
                                  onChange={(e) => onFieldChange('whatsapp', e.target.value)}
                                  placeholder="+35799123456"
                                />
                              </div>
                            </div>
                            <p className="pp-profilePhoneHint">
                              <span aria-hidden>ℹ</span>
                              {t('profile.form.phoneHintShort')}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      <div className="pp-profileLocCard">
                        <div className="pp-profileLocCard__head">
                          <span className="pp-editNavIco is-purple"><IconPin /></span>
                          <div>
                            <strong>{t('profile.form.location')}</strong>
                            <small>{t('profile.form.locationHint')}</small>
                          </div>
                        </div>
                        <input
                          id="pp-location"
                          className="pp-input"
                          value={form.location}
                          onChange={(e) => onFieldChange('location', e.target.value)}
                          placeholder={t('profile.form.locationPlaceholder')}
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {profileErr ? <div className="pp-error">{profileErr}</div> : null}

                <div className="pp-profileModalActions">
                  <button type="submit" className="pp-btn pp-btnPrimary pp-profileModalActions__save" disabled={profileBusy}>
                    {profileBusy ? t('profile.form.saving') : t('profile.form.save')}
                  </button>
                  <button
                    type="button"
                    className="pp-btn pp-profileModalActions__cancel"
                    onClick={closeProfileModal}
                    disabled={profileBusy || photoBusy}
                  >
                    {t('common.cancel')}
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
