import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { usePets } from '../pets/PetsContext';
import { useGame } from '../game/GameContext';
import { walkStreakDays } from '../walk/walkStats';
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

  const streak = walkStreakDays(walkLog);
  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  const hasPhoto = Boolean(user && getEffectiveProfilePhotoUrl(user));

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
            <h1 className="pp-pageHeader__title">{t('profile.titleFriendly', { name: displayName || t('profile.youFallback') })}</h1>
            <p className="pp-pageHeader__sub">{t('profile.introFriendly')}</p>
          </div>
          <Link className="pp-pageHeader__back" to="/">
            {t('profile.backHome')}
          </Link>
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

            <h3 className="pp-profilePhotoTitle">{t('profile.photo.title')}</h3>
            <div className="pp-profilePhotoRow">
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
            <p className="pp-subtle pp-profilePhotoHint">{t('profile.photo.hint')}</p>
          </div>
        </section>
      </div>

      <div className="pp-col-12">
        <div className="pp-grid" style={{ marginBottom: 0 }}>
          <div className="pp-col-3">
            <div className="pp-statTile">
              <span className="pp-statTile__label">{t('profile.statPets')}</span>
              <span className="pp-statTile__value">{pets.length}</span>
              <span className="pp-statTile__hint">{t('profile.statPetsHint')}</span>
            </div>
          </div>
          <div className="pp-col-3">
            <div className="pp-statTile">
              <span className="pp-statTile__label">{t('profile.statKm')}</span>
              <span className="pp-statTile__value">{(lifetimeStats?.km || 0).toFixed(1)}</span>
              <span className="pp-statTile__hint">{t('profile.statKmHint')}</span>
            </div>
          </div>
          <div className="pp-col-3">
            <div className="pp-statTile">
              <span className="pp-statTile__label">{t('profile.statWalks')}</span>
              <span className="pp-statTile__value">{lifetimeStats?.walks || 0}</span>
              <span className="pp-statTile__hint">{t('profile.statWalksHint')}</span>
            </div>
          </div>
          <div className="pp-col-3">
            <div className="pp-statTile">
              <span className="pp-statTile__label">{t('profile.statStreak')}</span>
              <span className="pp-statTile__value">{streak}</span>
              <span className="pp-statTile__hint">{t('profile.statStreakHint')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pp-col-12">
        <h2 className="pp-feed__sectionTitle" style={{ margin: '6px 4px 12px' }}>{t('profile.actionsTitle')}</h2>
        <div className="pp-actionGrid">
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
    </div>
  );
}
