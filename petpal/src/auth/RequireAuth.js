import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <div style={{ padding: 24 }}>Loading…</div>;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

