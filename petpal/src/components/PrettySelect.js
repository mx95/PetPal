import React from 'react';

/** Styled native select — accessible, with a polished shell. */
export function PrettySelect({
  id,
  value,
  onChange,
  children,
  disabled,
  className = '',
  style,
  'aria-labelledby': ariaLabelledby,
  ...rest
}) {
  return (
    <div className={['pp-prettySelect', className].filter(Boolean).join(' ')} style={style}>
      <select
        id={id}
        className="pp-prettySelect__native"
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-labelledby={ariaLabelledby}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
