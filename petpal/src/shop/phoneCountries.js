/** @typedef {{ code: string, name: string, dial: string, flag: string }} PhoneCountry */

/** @type {PhoneCountry[]} */
export const PHONE_COUNTRIES = [
  { code: 'CY', name: 'Cyprus', dial: '+357', flag: '🇨🇾' },
  { code: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', dial: '+358', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { code: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱' },
  { code: 'RO', name: 'Romania', dial: '+40', flag: '🇷🇴' },
  { code: 'BG', name: 'Bulgaria', dial: '+359', flag: '🇧🇬' },
  { code: 'CZ', name: 'Czechia', dial: '+420', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungary', dial: '+36', flag: '🇭🇺' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺' },
  { code: 'UA', name: 'Ukraine', dial: '+380', flag: '🇺🇦' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { code: 'LB', name: 'Lebanon', dial: '+961', flag: '🇱🇧' },
];

const byCode = new Map(PHONE_COUNTRIES.map((row) => [row.code, row]));
const byDialLength = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/**
 * @param {string} code
 * @returns {PhoneCountry | undefined}
 */
export function getPhoneCountry(code) {
  return byCode.get(String(code || '').toUpperCase());
}

/**
 * @param {string} phone
 * @param {string} [defaultCountry]
 * @returns {{ country: string, national: string }}
 */
export function parseInternationalPhone(phone, defaultCountry = 'CY') {
  const normalized = String(phone || '').replace(/[\s()-]/g, '');
  if (!normalized) {
    return { country: defaultCountry, national: '' };
  }
  if (normalized.startsWith('+')) {
    for (const row of byDialLength) {
      if (normalized.startsWith(row.dial)) {
        return {
          country: row.code,
          national: normalized.slice(row.dial.length).replace(/\D/g, ''),
        };
      }
    }
  }
  return {
    country: defaultCountry,
    national: normalized.replace(/\D/g, ''),
  };
}

/**
 * @param {string} countryCode
 * @param {string} national
 * @returns {string}
 */
export function formatInternationalPhone(countryCode, national) {
  const row = getPhoneCountry(countryCode);
  const digits = String(national || '').replace(/\D/g, '');
  if (!row || !digits) return '';
  return `${row.dial}${digits}`;
}

/**
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidInternationalPhone(phone) {
  const normalized = String(phone || '').replace(/\s+/g, '');
  if (!normalized) return false;
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}
