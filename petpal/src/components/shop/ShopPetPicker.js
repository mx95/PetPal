import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import PetAvatar from '../PetAvatar';

/**
 * @param {{
 *   pets: Array<{ id: string, name: string, categoryId?: string, photoUrl?: string, photoDataUrl?: string }>,
 *   selectedIds: string[],
 *   onChange: (ids: string[]) => void,
 *   disabled?: boolean,
 *   guest?: boolean,
 * }} props
 */
export default function ShopPetPicker({ pets, selectedIds, onChange, disabled, guest = false }) {
  const { t } = useI18n();
  if (!pets.length) {
    return (
      <p className="pp-subtle pp-shopPetPicker__empty">
        {guest ? t('shopPage.nfcNoPetsGuest') : t('shopPage.nfcNoPets')}
      </p>
    );
  }

  const toggle = (id) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="pp-shopPetPicker" role="group" aria-label={t('shopPage.nfcPetPickerAria')}>
      <p className="pp-shopPetPicker__lead">{t('shopPage.nfcPetPickerLead')}</p>
      <div className="pp-shopPetPicker__list">
        {pets.map((pet) => {
          const selected = selectedIds.includes(pet.id);
          return (
            <button
              key={pet.id}
              type="button"
              className={`pp-shopPetPicker__chip${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => toggle(pet.id)}
            >
              <PetAvatar pet={pet} size={28} className="pp-shopPetPicker__avatar" />
              <span className="pp-shopPetPicker__chipName">{pet.name}</span>
              <span className="pp-shopPetPicker__tick" aria-hidden>
                {selected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
