import React from 'react';
import { AppCard } from './AppCard';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { PetIllustration } from './PetIllustration';

export function EmptyState({ title, body, actionLabel, actionTo, secondaryLabel, secondaryTo, icon = 'pet' }) {
  return (
    <AppCard hover={false} className="relative overflow-hidden text-center">
      <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-petpal-soft blur-2xl" aria-hidden />
      <div className="relative mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-petpal-cream to-petpal-soft shadow-soft">
        <PetIllustration variant={icon} className="h-20 w-20" />
      </div>
      <h3 className="text-2xl font-black tracking-[-0.03em] text-petpal-ink">{title}</h3>
      {body ? <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-petpal-muted sm:text-base">{body}</p> : null}
      {(actionLabel || secondaryLabel) ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {actionLabel ? <PrimaryButton to={actionTo}>{actionLabel}</PrimaryButton> : null}
          {secondaryLabel ? <SecondaryButton to={secondaryTo}>{secondaryLabel}</SecondaryButton> : null}
        </div>
      ) : null}
    </AppCard>
  );
}

