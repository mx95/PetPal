import React from 'react';
import { useCompany } from '../company/CompanyContext';
import ActivityHub from './ActivityHub';
import BusinessWeekBookings from './BusinessWeekBookings';

/**
 * Home tab route (`/dashboard`): activity hub for pet owners, weekly booking calendar for businesses.
 */
export default function Dashboard() {
  const { isCompanyAccount, profileLoading } = useCompany();

  if (profileLoading) {
    return <div className="pp-pad pp-subtle">Loading…</div>;
  }

  if (isCompanyAccount) {
    return <BusinessWeekBookings />;
  }

  return <ActivityHub />;
}
