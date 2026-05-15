import React from 'react';
import { formatHm24 } from '../formatTime24';

function parseHm(value) {
  const m = String(value || '00:00').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return { hour: 0, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, Number(m[1]) || 0)),
    minute: Math.min(59, Math.max(0, Number(m[2]) || 0)),
  };
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/**
 * 24-hour time picker (HH:mm). Avoids native `<input type="time">` 12h UI on some locales.
 */
export default function TimeInput24({
  value = '00:00',
  onChange,
  id,
  className = '',
  'aria-label': ariaLabel,
  disabled = false,
}) {
  const { hour, minute } = parseHm(value);

  return (
    <div
      className={`pp-timeInput24 ${className}`.trim()}
      role="group"
      aria-label={ariaLabel}
      id={id}
    >
      <select
        className="pp-timeInput24__select"
        value={hour}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel}, hour` : 'Hour'}
        onChange={(e) => onChange?.(formatHm24(Number(e.target.value), minute))}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, '0')}
          </option>
        ))}
      </select>
      <span className="pp-timeInput24__sep" aria-hidden>
        :
      </span>
      <select
        className="pp-timeInput24__select"
        value={minute}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel}, minute` : 'Minute'}
        onChange={(e) => onChange?.(formatHm24(hour, Number(e.target.value)))}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, '0')}
          </option>
        ))}
      </select>
    </div>
  );
}
