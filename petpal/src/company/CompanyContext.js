import React, { createContext, useContext } from 'react';

export const CompanyContext = createContext(null);

const GUEST_COMPANY = {
  profile: null,
  profiles: [],
  profileLoading: false,
  userAccountType: null,
  isCompanyAccount: false,
  isBusinessHome: false,
  isApprovedCompany: false,
  isPendingCompany: false,
  isRejectedCompany: false,
  isAdmin: false,
  adminReady: true,
  firebaseReady: false,
};

export function useCompany() {
  return useContext(CompanyContext) || GUEST_COMPANY;
}
