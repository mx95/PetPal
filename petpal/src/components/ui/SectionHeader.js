import React from 'react';
import { cx } from './classNames';

export function SectionHeader({ eyebrow, title, subtitle, subtitleClassName, action, align = 'left', className = '' }) {
  return (
    <div
      className={cx(
        'mb-6 flex flex-col gap-4 sm:mb-8',
        align === 'center' ? 'items-center text-center' : 'items-start',
        action && align !== 'center' ? 'sm:flex-row sm:items-end sm:justify-between' : '',
        className
      )}
    >
      <div className={cx('max-w-3xl', align === 'center' && 'mx-auto')}>
        {eyebrow ? (
          <div className="mb-3 inline-flex rounded-full bg-petpal-soft px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-petpal-lilac">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-3xl font-black tracking-[-0.04em] text-petpal-ink sm:text-4xl lg:text-5xl">{title}</h1>
        {subtitle ? (
          <p className={cx('mt-4 text-base leading-7 text-petpal-muted sm:text-lg', subtitleClassName)}>{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

