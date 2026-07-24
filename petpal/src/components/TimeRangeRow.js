import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import TimeInput24 from './TimeInput24';

/**
 * From / To time row: labels above inputs, arrow between the pickers.
 */
export default function TimeRangeRow({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  onRemove,
  canRemove = false,
  readOnly = false,
  startLabel,
  endLabel,
  className = '',
}) {
  const { t } = useI18n();
  const resolvedStartLabel = startLabel || t('availability.fromLabel');
  const resolvedEndLabel = endLabel || t('availability.toLabel');

  return (
    <div className={`pp-timeRangeRow ${readOnly ? 'pp-timeRangeRow--readOnly' : ''} ${className}`.trim()}>
      <label className="pp-timeRangeRow__col">
        <span className="pp-timeRangeRow__label">{resolvedStartLabel}</span>
        <div className="pp-timeRangeRow__control">
          {readOnly ? (
            <span className="pp-timeRangeRow__value">{startTime}</span>
          ) : (
            <TimeInput24
              className="pp-timeInput24--boxed"
              value={startTime}
              onChange={onStartChange}
              aria-label={t('availability.timeInputAriaLabel', { label: resolvedStartLabel })}
            />
          )}
        </div>
      </label>

      <span className="pp-timeRangeRow__arrow" aria-hidden>
        →
      </span>

      <label className="pp-timeRangeRow__col">
        <span className="pp-timeRangeRow__label">{resolvedEndLabel}</span>
        <div className="pp-timeRangeRow__control">
          {readOnly ? (
            <span className="pp-timeRangeRow__value">{endTime}</span>
          ) : (
            <TimeInput24
              className="pp-timeInput24--boxed"
              value={endTime}
              onChange={onEndChange}
              aria-label={t('availability.timeInputAriaLabel', { label: resolvedEndLabel })}
            />
          )}
        </div>
      </label>

      {!readOnly && canRemove ? (
        <button type="button" className="pp-timeRangeRow__remove" aria-label={t('availability.removePeriod')} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </div>
  );
}
