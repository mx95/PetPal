import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { completeSocialRedirectIfNeeded } from './socialAuth';

const AuthContext = createContext(null);

/** Never leave the opening splash forever if Auth/IndexedDB stalls (common on iOS). */
const AUTH_INIT_TIMEOUT_MS = 10000;

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

    let cancelled = false;
    const finishInit = () => {
      if (!cancelled) setInitializing(false);
    };

    const safetyTimer = window.setTimeout(finishInit, AUTH_INIT_TIMEOUT_MS);

    // After Google/Apple redirect, Firebase may not emit onAuthStateChanged until
    // getRedirectResult() is consumed. Login/Register are not always mounted (e.g.
    // return lands on `/`), so kick this off from the auth root.
    void completeSocialRedirectIfNeeded().catch((err) => {
      console.warn('[auth] social redirect result failed', err?.code || err);
    });

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (cancelled) return;
      if (registrationInFlight) {
        pendingAuthUserRef.current = nextUser;
        finishInit();
        window.clearTimeout(safetyTimer);
        return;
      }
      setUser(nextUser);
      finishInit();
      window.clearTimeout(safetyTimer);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      unsubscribe();
    };
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
