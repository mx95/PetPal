import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { getEffectiveProfilePhotoUrl } from '../profile/userProfilePhotoLocal';

/**
 * Human profile image: Firebase photoURL, or device-local upload, or initial letter.
 */
export default function UserAvatar({ user, size = 40, className = '' }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(() => (user ? getEffectiveProfilePhotoUrl(user) : null));

  useEffect(() => {
    const sync = () => setUrl(user ? getEffectiveProfilePhotoUrl(user) : null);
    sync();
    const onChange = () => sync();
    window.addEventListener('petpal-profile-photo-changed', onChange);
    return () => window.removeEventListener('petpal-profile-photo-changed', onChange);
  }, [user, user?.uid, user?.photoURL]);

  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || '';
  const letter = (displayName || '?').charAt(0).toUpperCase();
  const dim = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    aspectRatio: '1',
    flexShrink: 0,
  };
  const ringClass = className ? ` ${className}` : '';
  const photoLabel = displayName
    ? t('profile.photo.imgAlt', { name: displayName })
    : t('profile.headerAria');

  if (url) {
    return (
      <span className={`pp-userAvatar pp-userAvatar--photo${ringClass}`} style={dim} aria-label={photoLabel}>
        <img src={url} alt="" className="pp-userAvatar__img" width={size} height={size} />
      </span>
    );
  }

  return (
    <span
      className={`pp-userAvatar pp-userAvatar--letter${ringClass}`}
      style={{ ...dim, fontSize: Math.max(12, Math.round(size * 0.38)) }}
      aria-label={user ? displayName || user.email || '' : ''}
    >
      {letter}
    </span>
  );
}
