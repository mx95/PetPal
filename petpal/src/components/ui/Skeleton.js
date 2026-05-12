import React from 'react';
import { cx } from './classNames';

export function Skeleton({ className = '' }) {
  return <div className={cx('pp-shimmer rounded-2xl', className)} aria-hidden />;
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={cx('rounded-3xl border border-white/70 bg-white/80 p-5 shadow-soft', className)} aria-hidden>
      <Skeleton className="mb-5 h-32 w-full" />
      <Skeleton className="mb-3 h-5 w-2/3" />
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton key={idx} className="mb-2 h-3 w-full last:w-4/5" />
      ))}
    </div>
  );
}

