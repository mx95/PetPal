import React from 'react';
import { useI18n } from '../i18n/I18nContext';

function FillIcon() {
  return (
    <svg
      className="pp-companyMapSearch__fillSvg"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
    >
      <path
        d="M7 4.5h10M5 7.5h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 10.5V18M8.5 14.5L12 18l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Circular blue control: copy business name + address from the form into the map search field.
 *
 * @param {{ onClick: () => void, disabled?: boolean }} props
 */
export default function FillFromAboveButton({ onClick, disabled }) {
  const { t } = useI18n();
  const label = t('companyApply.fillFromAbove');
  return (
    <button
      type="button"
      className="pp-companyMapSearch__fill"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <span className="pp-companyMapSearch__fillIcon">
        <FillIcon />
      </span>
    </button>
  );
}
