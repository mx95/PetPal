import React from 'react';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import ActivityHub from './ActivityHub';
import BusinessWeekBookings from './BusinessWeekBookings';

/**
 * Home tab route (`/dashboard`): activity hub for pet owners, weekly booking calendar for businesses.
 */
export default function Dashboard() {
  const { t } = useI18n();
  const { isBusinessHome, profileLoading } = useCompany();

  if (profileLoading) {
    return <div className="pp-pad pp-subtle">{t('common.loading')}</div>;
  }

  if (isBusinessHome) {
    return <BusinessWeekBookings />;
  }

  return <ActivityHub />;
}
