/**
 * Public holidays by country code (ISO 3166-1 alpha-2).
 * Dates are YYYY-MM-DD. Extend yearly as needed.
 */

const HOLIDAYS = {
  CY: {
    2026: [
      { date: '2026-01-01', name: 'New Year\'s Day' },
      { date: '2026-01-06', name: 'Epiphany' },
      { date: '2026-03-02', name: 'Green Monday' },
      { date: '2026-03-25', name: 'Greek Independence Day' },
      { date: '2026-04-01', name: 'Cyprus National Day' },
      { date: '2026-04-17', name: 'Orthodox Good Friday' },
      { date: '2026-04-20', name: 'Orthodox Easter Monday' },
      { date: '2026-05-01', name: 'Labour Day' },
      { date: '2026-06-08', name: 'Whit Monday (Kataklysmos)' },
      { date: '2026-08-15', name: 'Assumption of Mary' },
      { date: '2026-10-01', name: 'Cyprus Independence Day' },
      { date: '2026-10-28', name: 'Ochi Day' },
      { date: '2026-12-24', name: 'Christmas Eve' },
      { date: '2026-12-25', name: 'Christmas Day' },
      { date: '2026-12-26', name: 'Boxing Day' },
    ],
    2027: [
      { date: '2027-01-01', name: 'New Year\'s Day' },
      { date: '2027-01-06', name: 'Epiphany' },
      { date: '2027-02-22', name: 'Green Monday' },
      { date: '2027-03-25', name: 'Greek Independence Day' },
      { date: '2027-04-01', name: 'Cyprus National Day' },
      { date: '2027-04-30', name: 'Orthodox Good Friday' },
      { date: '2027-05-03', name: 'Orthodox Easter Monday' },
      { date: '2027-05-01', name: 'Labour Day' },
      { date: '2027-06-07', name: 'Whit Monday (Kataklysmos)' },
      { date: '2027-08-15', name: 'Assumption of Mary' },
      { date: '2027-10-01', name: 'Cyprus Independence Day' },
      { date: '2027-10-28', name: 'Ochi Day' },
      { date: '2027-12-24', name: 'Christmas Eve' },
      { date: '2027-12-25', name: 'Christmas Day' },
      { date: '2027-12-26', name: 'Boxing Day' },
    ],
  },
  GR: {
    2026: [
      { date: '2026-01-01', name: 'New Year\'s Day' },
      { date: '2026-01-06', name: 'Epiphany' },
      { date: '2026-03-25', name: 'Independence Day' },
      { date: '2026-04-17', name: 'Orthodox Good Friday' },
      { date: '2026-04-20', name: 'Orthodox Easter Monday' },
      { date: '2026-05-01', name: 'Labour Day' },
      { date: '2026-06-08', name: 'Whit Monday' },
      { date: '2026-08-15', name: 'Assumption of Mary' },
      { date: '2026-10-28', name: 'Ochi Day' },
      { date: '2026-12-25', name: 'Christmas Day' },
      { date: '2026-12-26', name: 'Boxing Day' },
    ],
  },
};

export const HOLIDAY_COUNTRY_OPTIONS = [
  { code: 'CY', label: 'Cyprus' },
  { code: 'GR', label: 'Greece' },
];

export function getPublicHolidays(countryCode, year) {
  const code = String(countryCode || 'CY').toUpperCase();
  const y = Number(year) || new Date().getFullYear();
  return (HOLIDAYS[code]?.[y] || HOLIDAYS.CY?.[y] || []).slice();
}

export function holidayDateKeys(countryCode, year) {
  return new Set(getPublicHolidays(countryCode, year).map((h) => h.date));
}
