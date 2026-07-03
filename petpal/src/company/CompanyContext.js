import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { getDb, isFirebaseConfigured } from '../firebase';
import { subscribeCompanyProfile, subscribeCompanyProfiles, subscribeIsAdmin } from './companyFirestore';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [profile, setProfile] = useState(/** @type {import('./companyTypes').CompanyProfile | null} */ (null));
  const [profiles, setProfiles] = useState(/** @type {import('./companyTypes').CompanyProfile[]} */ ([]));
  const [profileLoading, setProfileLoading] = useState(!!isFirebaseConfigured() && !!uid);
  const [userAccountType, setUserAccountType] = useState(/** @type {'individual' | 'company' | null} */ (null));
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

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setUserAccountType(null);
      return undefined;
    }
    return onSnapshot(
      doc(getDb(), 'users', uid),
      (snap) => {
        const type = String(snap.data()?.accountType || 'individual').toLowerCase();
        setUserAccountType(type === 'company' ? 'company' : 'individual');
      },
      () => setUserAccountType('individual')
    );
  }, [uid]);

  const isApprovedCompany = profile?.status === 'approved';
  const isPendingCompany = profile?.status === 'pending';
  const isRejectedCompany = profile?.status === 'rejected';
  const isCompanyAccount =
    userAccountType === 'company'
    || profile?.accountType === 'company'
    || isApprovedCompany
    || isPendingCompany
    || isRejectedCompany;

  const value = useMemo(
    () => ({
      profile,
      profiles,
      profileLoading,
      userAccountType,
      isCompanyAccount,
      isApprovedCompany,
      isPendingCompany,
      isRejectedCompany,
      isAdmin,
      firebaseReady: isFirebaseConfigured(),
    }),
    [
      profile,
      profiles,
      profileLoading,
      userAccountType,
      isCompanyAccount,
      isApprovedCompany,
      isPendingCompany,
      isRejectedCompany,
      isAdmin,
    ]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
