import React from 'react';
import { cx } from './classNames';

export function PageContainer({ children, className = '', size = 'wide' }) {
  const width = size === 'narrow' ? 'max-w-4xl' : size === 'full' ? 'max-w-none' : 'max-w-6xl';
  return (
    <main className={cx('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10', width, className)}>
      {children}
    </main>
  );
}

