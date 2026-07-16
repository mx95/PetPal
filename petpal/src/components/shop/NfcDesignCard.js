import React from 'react';

/**
 * @param {{
 *   design: { id: number, name: string, image: string },
 *   selected: boolean,
 *   disabled?: boolean,
 *   onSelect: (id: number) => void,
 * }} props
 */
export default function NfcDesignCard({ design, selected, disabled = false, onSelect }) {
  return (
    <button
      type="button"
      className={`pp-nfcDesignCard${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(design.id)}
    >
      {selected ? (
        <span className="pp-nfcDesignCard__check" aria-hidden="true">
          ✓
        </span>
      ) : null}
      <img className="pp-nfcDesignCard__img" src={design.image} alt="" loading="lazy" />
      <span className="pp-nfcDesignCard__name">{design.name}</span>
    </button>
  );
}
