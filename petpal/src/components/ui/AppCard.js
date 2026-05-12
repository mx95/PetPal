import React from 'react';
import { cx } from './classNames';

export function AppCard({ children, className = '', hover = true, as: Component = 'div' }) {
  return (
    <Component
      className={cx(
        'rounded-3xl border border-white/70 bg-white/85 p-5 shadow-soft backdrop-blur pp-card-motion sm:p-6',
        hover && 'hover:-translate-y-1 hover:shadow-lift',
        className
      )}
    >
      {children}
    </Component>
  );
}

