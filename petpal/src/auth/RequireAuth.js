import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from './AuthProvider';
import { OpeningScreen } from '../components/OpeningScreen';

export function RequireAuth({ children }) {
  const { user, initializing } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (initializing) return <OpeningScreen subtitle={t('requireAuth.loading')} />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

