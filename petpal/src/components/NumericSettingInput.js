import React, { useEffect, useState } from 'react';

/**
 * Numeric setting field that allows clearing to empty while typing.
 * Commits a parsed number on blur (avoids `Number('') === 0` on every keystroke).
 */
export default function NumericSettingInput({
  value,
  onCommit,
  min = 0,
  max,
  className = 'pp-input',
  id,
  'aria-label': ariaLabel,
}) {
  const [text, setText] = useState(() => String(value ?? ''));

  useEffect(() => {
    setText(String(value ?? ''));
  }, [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      const fallback = min ?? 0;
      onCommit(fallback);
      setText(String(fallback));
      return;
    }
    let n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setText(String(value ?? min ?? 0));
      return;
    }
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    onCommit(n);
    setText(String(n));
  };

  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      id={id}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        if (next === '' || /^\d+$/.test(next)) setText(next);
      }}
      onBlur={commit}
    />
  );
}
