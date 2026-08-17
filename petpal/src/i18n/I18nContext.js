import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './locales/en';

const STORAGE_KEY = 'petpal_locale';
export const SUPPORTED = /** @type {const} */ (['en', 'el', 'ru']);
const FALLBACK = 'en';

const LAZY_LOCALE_LOADERS = {
  el: () => import('./locales/el'),
  ru: () => import('./locales/ru'),
};

/**
 * @param {object} obj
 * @param {string} path dot-separated
 */
function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function readStoredLocale() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && SUPPORTED.includes(/** @type {any} */ (raw))) return raw;
  } catch {
    // ignore
  }
  return null;
}

function writeStoredLocale(next) {
  try {
    if (SUPPORTED.includes(next)) localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
}

const I18nContext = createContext(
  /** @type {{ language: string, setLanguage: (l: string) => void, t: (key: string) => string, catalog: object }} | null */ (null)
);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => readStoredLocale() || FALLBACK);
  const [localeCatalog, setLocaleCatalog] = useState(en);

  useEffect(() => {
    const next = SUPPORTED.includes(language) ? language : FALLBACK;
    const lang = next === 'el' ? 'el' : next === 'ru' ? 'ru' : 'en';
    document.documentElement.setAttribute('lang', lang);
  }, [language]);

  useEffect(() => {
    if (language === FALLBACK) {
      setLocaleCatalog(en);
      return undefined;
    }
    const loader = LAZY_LOCALE_LOADERS[language];
    if (!loader) {
      setLocaleCatalog(en);
      return undefined;
    }
    let cancelled = false;
    loader()
      .then((mod) => {
        if (!cancelled) setLocaleCatalog(mod.default || mod);
      })
      .catch(() => {
        if (!cancelled) setLocaleCatalog(en);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback((l) => {
    const next = SUPPORTED.includes(l) ? l : FALLBACK;
    setLanguageState(next);
    writeStoredLocale(next);
  }, []);

  const t = useCallback(
    (key, params) => {
      let v = getByPath(localeCatalog, key);
      if (v == null && language !== FALLBACK) v = getByPath(en, key);
      let s = typeof v === 'string' ? v : v != null ? String(v) : key;
      if (params && typeof params === 'object' && typeof s === 'string') {
        for (const [k, val] of Object.entries(params)) {
          s = s.split(`{${k}}`).join(String(val));
        }
      }
      return s;
    },
    [language, localeCatalog]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      catalog: localeCatalog,
    }),
    [language, setLanguage, t, localeCatalog]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
