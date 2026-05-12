import React from 'react';
import { Link } from 'react-router-dom';
import { cx } from './classNames';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black no-underline transition-all duration-300 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

function ButtonShell({ to, href, children, className, ...props }) {
  if (to) {
    return (
      <Link to={to} className={className} {...props}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={className} {...props}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} {...props}>
      {children}
    </button>
  );
}

export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <ButtonShell
      className={cx(
        base,
        'bg-gradient-to-r from-petpal-lilac to-petpal-blue text-white shadow-glow hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-petpal-lilac/30',
        className
      )}
      {...props}
    >
      {children}
    </ButtonShell>
  );
}

export function SecondaryButton({ children, className = '', ...props }) {
  return (
    <ButtonShell
      className={cx(
        base,
        'border border-slate-200 bg-white/90 text-petpal-ink shadow-soft hover:-translate-y-0.5 hover:border-petpal-lilac/30 hover:bg-petpal-soft focus-visible:outline-petpal-blue/25',
        className
      )}
      {...props}
    >
      {children}
    </ButtonShell>
  );
}

