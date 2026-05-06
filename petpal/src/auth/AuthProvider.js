import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [registrationInFlight, setRegistrationInFlight] = useState(false);
  const pendingAuthUserRef = useRef(null);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setInitializing(false);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (registrationInFlight) {
        pendingAuthUserRef.current = nextUser;
        setInitializing(false);
        return;
      }
      setUser(nextUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, [registrationInFlight]);

  const value = useMemo(
    () => ({
      user,
      initializing,
      registrationInFlight,
      beginRegistrationTransaction: () => setRegistrationInFlight(true),
      completeRegistrationTransaction: (success) => {
        setRegistrationInFlight(false);
        if (success) {
          setUser(auth?.currentUser || pendingAuthUserRef.current || null);
        } else {
          setUser(null);
        }
        pendingAuthUserRef.current = null;
      },
      signOut: () => (auth ? signOut(auth) : Promise.resolve()),
    }),
    [user, initializing, registrationInFlight]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

