/**
 * @param {Date} date
 * @param {string} [lang] 'en' | 'el' | 'ru'
 */
export function formatTime24(date, lang = 'en') {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  const locale = lang === 'el' ? 'el-GR' : lang === 'ru' ? 'ru-RU' : 'en-GB';
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** @param {number} hour @param {number} [minute] */
export function formatHm24(hour, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * @param {Date} date
 * @param {string} [lang]
 */
export function formatDateTime24(date, lang = 'en') {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const locale = lang === 'el' ? 'el-GR' : lang === 'ru' ? 'ru-RU' : 'en-GB';
  const day = date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${day}, ${formatTime24(date, lang)}`;
}
