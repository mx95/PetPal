import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { isFirebaseConfigured } from '../firebase';
import { getDb } from '../firebaseDb';
import { CompanyContext } from './CompanyContext';
import { subscribeCompanyProfile, subscribeCompanyProfiles, subscribeIsAdmin } from './companyFirestore';

export function CompanyProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [profile, setProfile] = useState(/** @type {import('./companyTypes').CompanyProfile | null} */ (null));
  const [profiles, setProfiles] = useState(/** @type {import('./companyTypes').CompanyProfile[]} */ ([]));
  const [profileLoading, setProfileLoading] = useState(!!isFirebaseConfigured() && !!uid);
  const [userAccountType, setUserAccountType] = useState(/** @type {'individual' | 'company' | null} */ (null));
  const [isAdmin, setIsAdmin] = useState(false);
  /** False until the first admins/{uid} snapshot (avoids bouncing signed-in admins to /dashboard). */
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
  /** Business schedule home + nav — never for platform admins using a personal login. */
  const isBusinessHome =
    !isAdmin
    && (isApprovedCompany || (userAccountType === 'company' && !isApprovedCompany));

  const value = useMemo(
    () => ({
      profile,
      profiles,
      profileLoading,
      userAccountType,
      isCompanyAccount,
      isBusinessHome,
      isApprovedCompany,
      isPendingCompany,
      isRejectedCompany,
      isAdmin,
      adminReady,
      firebaseReady: isFirebaseConfigured(),
    }),
    [
      profile,
      profiles,
      profileLoading,
      userAccountType,
      isCompanyAccount,
      isBusinessHome,
      isApprovedCompany,
      isPendingCompany,
      isRejectedCompany,
      isAdmin,
      adminReady,
    ]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}
