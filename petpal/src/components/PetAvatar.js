import React from 'react';
import { usePets } from '../pets/PetsContext';

/**
 * @param {{ pet: { categoryId: string, photoDataUrl?: string, photoUrl?: string, name?: string }, size?: number, className?: string }} props
 */
export default function PetAvatar({ pet, size = 48, className = '' }) {
  const { getCategory } = usePets();
  const c = getCategory(pet);
  const src = pet.photoUrl || pet.photoDataUrl;
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`pp-petAvatar ${className}`.trim()}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`pp-petAvatar pp-petAvatar--placeholder ${className}`.trim()}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      {c.emoji}
    </div>
  );
}
