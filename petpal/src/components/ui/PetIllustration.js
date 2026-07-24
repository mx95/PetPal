import React from 'react';
import { cx } from './classNames';
import { useI18n } from '../../i18n/I18nContext';

export function PetIllustration({ variant = 'pet', className = '', alt }) {
  const { t } = useI18n();
  const isCat = variant === 'cat';
  const isTrophy = variant === 'trophy';
  if (isTrophy) {
    return (
      <svg
        className={cx('animate-float', className)}
        viewBox="0 0 120 120"
        role="img"
        aria-label={alt || t('petIllustration.trophyAlt')}
      >
        <defs>
          <linearGradient id="pp-trophy-g" x1="20" x2="100" y1="10" y2="110">
            <stop stopColor="#F4B740" />
            <stop offset="1" stopColor="#FF7A59" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="52" fill="#FFF8EF" />
        <path d="M40 26h40v22c0 17-9 29-20 29S40 65 40 48V26Z" fill="url(#pp-trophy-g)" />
        <path d="M36 34H22c1 16 8 25 20 27M84 34h14c-1 16-8 25-20 27" fill="none" stroke="#101828" strokeWidth="5" strokeLinecap="round" />
        <path d="M60 77v18M45 98h30" stroke="#101828" strokeWidth="6" strokeLinecap="round" />
        <path d="M52 46h16" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg
      className={cx('animate-float', className)}
      viewBox="0 0 120 120"
      role="img"
      aria-label={alt || (isCat ? t('petIllustration.catAlt') : t('petIllustration.petAlt'))}
    >
      <defs>
        <linearGradient id="pp-pet-g" x1="18" x2="102" y1="10" y2="110">
          <stop stopColor="#5B37FF" />
          <stop offset="1" stopColor="#2F80FF" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="52" fill="#F7F4FF" />
      {isCat ? (
        <>
          <path d="M34 49 27 30l19 9a43 43 0 0 1 28 0l19-9-7 19c5 7 8 15 8 24 0 21-15 35-34 35S26 94 26 73c0-9 3-17 8-24Z" fill="url(#pp-pet-g)" />
          <circle cx="48" cy="68" r="4" fill="#fff" />
          <circle cx="72" cy="68" r="4" fill="#fff" />
          <path d="M55 82c4 3 8 3 12 0" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M36 48c0-14 11-25 24-25s24 11 24 25v17c0 22-13 37-24 37S36 87 36 65V48Z" fill="url(#pp-pet-g)" />
          <path d="M36 50c-15-5-19 21-6 30M84 50c15-5 19 21 6 30" fill="#8B78FF" />
          <circle cx="50" cy="61" r="4" fill="#fff" />
          <circle cx="70" cy="61" r="4" fill="#fff" />
          <path d="M55 76c4 4 6 4 10 0" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      <circle cx="30" cy="28" r="7" fill="#16B981" opacity="0.85" />
      <circle cx="92" cy="30" r="5" fill="#FF7A59" opacity="0.85" />
    </svg>
  );
}

