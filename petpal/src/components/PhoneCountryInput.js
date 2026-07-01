import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { getPhoneCountry, PHONE_COUNTRIES } from '../shop/phoneCountries';

/**
 * @param {{
 *   countryCode: string,
 *   nationalValue: string,
 *   onCountryChange: (code: string) => void,
 *   onNationalChange: (value: string) => void,
 *   disabled?: boolean,
 *   required?: boolean,
 *   id?: string,
 *   placeholder?: string,
 * }} props
 */
export default function PhoneCountryInput({
  countryCode,
  nationalValue,
  onCountryChange,
  onNationalChange,
  disabled = false,
  required = false,
  id = 'checkout-phone',
  placeholder = '',
}) {
  const { t } = useI18n();
  const selected = getPhoneCountry(countryCode) || PHONE_COUNTRIES[0];

  return (
    <div className="pp-phoneCountryInput">
      <label className="pp-phoneCountryInput__countryWrap" htmlFor={`${id}-country`}>
        <span className="pp-phoneCountryInput__flag" aria-hidden="true">
          {selected.flag}
        </span>
        <select
          id={`${id}-country`}
          className="pp-phoneCountryInput__country"
          value={selected.code}
          disabled={disabled}
          onChange={(e) => onCountryChange(e.target.value)}
          aria-label={t('checkoutDetails.phoneCountryAria')}
        >
          {PHONE_COUNTRIES.map((row) => (
            <option key={row.code} value={row.code}>
              {row.flag} {row.name} ({row.dial})
            </option>
          ))}
        </select>
        <span className="pp-phoneCountryInput__dial" aria-hidden="true">
          {selected.dial}
        </span>
      </label>
      <input
        id={id}
        className="pp-phoneCountryInput__number"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={nationalValue}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onNationalChange(e.target.value.replace(/[^\d\s]/g, ''))}
        aria-label={t('checkoutDetails.phone')}
      />
    </div>
  );
}
