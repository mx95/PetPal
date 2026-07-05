import React from 'react';
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
  startLabel = 'From',
  endLabel = 'To',
  className = '',
}) {
  return (
    <div className={`pp-timeRangeRow ${readOnly ? 'pp-timeRangeRow--readOnly' : ''} ${className}`.trim()}>
      <label className="pp-timeRangeRow__col">
        <span className="pp-timeRangeRow__label">{startLabel}</span>
        <div className="pp-timeRangeRow__control">
          {readOnly ? (
            <span className="pp-timeRangeRow__value">{startTime}</span>
          ) : (
            <TimeInput24
              className="pp-timeInput24--boxed"
              value={startTime}
              onChange={onStartChange}
              aria-label={`${startLabel} time`}
            />
          )}
        </div>
      </label>

      <span className="pp-timeRangeRow__arrow" aria-hidden>
        →
      </span>

      <label className="pp-timeRangeRow__col">
        <span className="pp-timeRangeRow__label">{endLabel}</span>
        <div className="pp-timeRangeRow__control">
          {readOnly ? (
            <span className="pp-timeRangeRow__value">{endTime}</span>
          ) : (
            <TimeInput24
              className="pp-timeInput24--boxed"
              value={endTime}
              onChange={onEndChange}
              aria-label={`${endLabel} time`}
            />
          )}
        </div>
      </label>

      {!readOnly && canRemove ? (
        <button type="button" className="pp-timeRangeRow__remove" aria-label="Remove period" onClick={onRemove}>
          ×
        </button>
      ) : null}
    </div>
  );
}
