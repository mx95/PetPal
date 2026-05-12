import React from 'react';
import { AppCard } from './AppCard';

export function StatCard({ label, value, hint, tone = 'lilac' }) {
  const toneClass =
    tone === 'mint'
      ? 'from-emerald-100 to-white text-emerald-700'
      : tone === 'gold'
        ? 'from-amber-100 to-white text-amber-700'
        : tone === 'coral'
          ? 'from-orange-100 to-white text-orange-700'
          : 'from-violet-100 to-white text-petpal-lilac';
  return (
    <AppCard className="p-4 sm:p-5">
      <div className={`mb-4 h-2 w-16 rounded-full bg-gradient-to-r ${toneClass}`} aria-hidden />
      <div className="text-3xl font-black tracking-[-0.04em] text-petpal-ink">{value}</div>
      <div className="mt-1 text-sm font-bold text-petpal-muted">{label}</div>
      {hint ? <div className="mt-3 text-xs leading-5 text-slate-400">{hint}</div> : null}
    </AppCard>
  );
}

