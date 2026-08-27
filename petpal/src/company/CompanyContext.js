import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { getDb, isFirebaseConfigured } from '../firebase';
import { subscribeCompanyProfile, subscribeCompanyProfiles, subscribeIsAdmin } from './companyFirestore';
import { subscribeShelterProfile } from '../shelter/shelterFirestore';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [profile, setProfile] = useState(/** @type {import('./companyTypes').CompanyProfile | null} */ (null));
  const [profiles, setProfiles] = useState(/** @type {import('./companyTypes').CompanyProfile[]} */ ([]));
  const [profileLoading, setProfileLoading] = useState(!!isFirebaseConfigured() && !!uid);
  const [shelterProfile, setShelterProfile] = useState(/** @type {import('../shelter/shelterTypes').ShelterProfile | null} */ (null));
  const [shelterProfileLoading, setShelterProfileLoading] = useState(!!isFirebaseConfigured() && !!uid);
  const [userAccountType, setUserAccountType] = useState(/** @type {'individual' | 'company' | 'shelter' | null} */ (null));
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(() => !isFirebaseConfigured());

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
    const offAll = subscribeCompanyProfiles(uid, (rows) => setProfiles(rows), () => setProfiles([]));
    return () => {
      offPrimary();
      offAll();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setShelterProfile(null);
      setShelterProfileLoading(false);
      return undefined;
    }
    setShelterProfileLoading(true);
    return subscribeShelterProfile(
      uid,
      (data) => {
        setShelterProfile(data);
        setShelterProfileLoading(false);
      },
      () => {
        setShelterProfile(null);
        setShelterProfileLoading(false);
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setIsAdmin(false);
      setAdminReady(true);
      return undefined;
    }
    setAdminReady(false);
    return subscribeIsAdmin(uid, (next) => {
      setIsAdmin(Boolean(next));
      setAdminReady(true);
    });
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
        if (type === 'company') setUserAccountType('company');
        else if (type === 'shelter') setUserAccountType('shelter');
        else setUserAccountType('individual');
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

  const isApprovedShelter = shelterProfile?.status === 'approved';
  const isPendingShelter = shelterProfile?.status === 'pending';
  const isRejectedShelter = shelterProfile?.status === 'rejected';
  const isSuspendedShelter = shelterProfile?.status === 'suspended';
  const isShelterAccount =
    userAccountType === 'shelter'
    || shelterProfile?.accountType === 'shelter'
    || isApprovedShelter
    || isPendingShelter
    || isRejectedShelter
    || isSuspendedShelter;

  const isBusinessHome =
    !isAdmin
    && !isShelterAccount
    && (isApprovedCompany || (userAccountType === 'company' && !isApprovedCompany));

  const value = useMemo(
    () => ({
      profile,
      profiles,
      profileLoading,
      shelterProfile,
      shelterProfileLoading,
      userAccountType,
      isCompanyAccount,
      isShelterAccount,
      isBusinessHome,
      isApprovedCompany,
      isPendingCompany,
      isRejectedCompany,
      isApprovedShelter,
      isPendingShelter,
      isRejectedShelter,
      isSuspendedShelter,
      isAdmin,
      adminReady,
      firebaseReady: isFirebaseConfigured(),
    }),
    [
      profile,
      profiles,
      profileLoading,
      shelterProfile,
      shelterProfileLoading,
      userAccountType,
      isCompanyAccount,
      isShelterAccount,
      isBusinessHome,
      isApprovedCompany,
      isPendingCompany,
      isRejectedCompany,
      isApprovedShelter,
      isPendingShelter,
      isRejectedShelter,
      isSuspendedShelter,
      isAdmin,
      adminReady,
    ]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
