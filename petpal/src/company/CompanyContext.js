import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { isFirebaseConfigured } from '../firebase';
import { subscribeCompanyProfile, subscribeCompanyProfiles, subscribeIsAdmin } from './companyFirestore';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [profile, setProfile] = useState(/** @type {import('./companyTypes').CompanyProfile | null} */ (null));
  const [profiles, setProfiles] = useState(/** @type {import('./companyTypes').CompanyProfile[]} */ ([]));
  const [profileLoading, setProfileLoading] = useState(!!isFirebaseConfigured() && !!uid);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setProfile(null);
      setProfiles([]);
      setProfileLoading(false);
      return undefined;
    }
    setProfileLoading(true);
    const offPrimary = subscribeCompanyProfile(
      uid,
      (data) => {
        setProfile(data);
        setProfileLoading(false);
      },
      () => {
        setProfile(null);
        setProfileLoading(false);
      }
    );

    const offAll = subscribeCompanyProfiles(
      uid,
      (rows) => setProfiles(rows),
      () => setProfiles([])
    );

    return () => {
      offPrimary();
      offAll();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setIsAdmin(false);
      return undefined;
    }
    return subscribeIsAdmin(uid, setIsAdmin);
  }, [uid]);

  const isApprovedCompany = profile?.status === 'approved';
  const isPendingCompany = profile?.status === 'pending';
  const isRejectedCompany = profile?.status === 'rejected';

  const value = useMemo(
    () => ({
      profile,
      profiles,
      profileLoading,
      isApprovedCompany,
      isPendingCompany,
      isRejectedCompany,
      isAdmin,
      firebaseReady: isFirebaseConfigured(),
    }),
    [profile, profiles, profileLoading, isApprovedCompany, isPendingCompany, isRejectedCompany, isAdmin]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
