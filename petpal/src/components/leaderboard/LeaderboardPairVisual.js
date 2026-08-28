import React from 'react';
import PetAvatar from '../PetAvatar';
import UserAvatar from '../UserAvatar';

const SIZE_MAP = {
  peek: { pet: 40, owner: 22 },
  row: { pet: 48, owner: 26 },
  podium: { pet: 64, owner: 28 },
  hero: { pet: 80, owner: 32 },
};

/**
 * @param {{
 *   ownerName: string,
 *   petName?: string,
 *   petPhotoUrl?: string,
 *   ownerPhotoUrl?: string,
 *   petCategoryId?: string,
 *   ownerUser?: import('firebase/auth').User | null,
 *   size?: 'peek' | 'row' | 'podium' | 'hero',
 *   className?: string,
 * }} props
 */
export function LeaderboardPairVisual({
  ownerName,
  petName = '',
  petPhotoUrl = '',
  ownerPhotoUrl = '',
  petCategoryId = 'dog',
  ownerUser = null,
  size = 'row',
  className = '',
}) {
  const dims = SIZE_MAP[size] || SIZE_MAP.row;
  const pet = {
    name: petName,
    categoryId: petCategoryId,
    photoUrl: petPhotoUrl || undefined,
    photoDataUrl: petPhotoUrl?.startsWith('data:') ? petPhotoUrl : undefined,
  };

  return (
    <div className={`pp-lbPair pp-lbPair--${size} ${className}`.trim()} aria-hidden>
      <div className="pp-lbPair__petWrap">
        <PetAvatar pet={pet} size={dims.pet} className="pp-lbPair__pet" />
        <span className="pp-lbPair__ownerWrap">
          <OwnerMiniAvatar
            ownerName={ownerName}
            ownerPhotoUrl={ownerPhotoUrl}
            ownerUser={ownerUser}
            size={dims.owner}
          />
        </span>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   ownerName: string,
 *   petName?: string,
 *   showYou?: boolean,
 *   youLabel?: string,
 *   className?: string,
 * }} props
 */
export function LeaderboardPairNames({ ownerName, petName = '', showYou = false, youLabel = '', className = '' }) {
  return (
    <div className={`pp-lbPairCopy ${className}`.trim()}>
      <span className="pp-lbPairCopy__owner">
        {ownerName}
        {showYou ? <span className="pp-lbPairCopy__you">{youLabel}</span> : null}
      </span>
      {petName ? (
        <span className="pp-lbPairCopy__pet">
          <span className="pp-lbPairCopy__paw" aria-hidden>
            🐾
          </span>
          {petName}
        </span>
      ) : null}
    </div>
  );
}

function OwnerMiniAvatar({ ownerName, ownerPhotoUrl, ownerUser, size }) {
  if (ownerUser) {
    return <UserAvatar user={ownerUser} size={size} className="pp-lbPair__owner" />;
  }
  const url = String(ownerPhotoUrl || '').trim();
  if (url) {
    return (
      <span
        className="pp-lbPair__owner pp-userAvatar pp-userAvatar--photo"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        <img src={url} alt="" className="pp-userAvatar__img" width={size} height={size} />
      </span>
    );
  }
  const letter = (ownerName || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className="pp-lbPair__owner pp-userAvatar pp-userAvatar--letter"
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        fontSize: Math.max(11, Math.round(size * 0.38)),
      }}
    >
      {letter}
    </span>
  );
}
