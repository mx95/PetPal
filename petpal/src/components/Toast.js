import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * @typedef {{ id: number, message: string, kind: 'info' | 'success' | 'error', duration: number }} Toast
 */

const ToastContext = createContext(/** @type {{ show: (m: string, opts?: { kind?: 'info'|'success'|'error', duration?: number }) => void } | null} */(null));

/**
 * Simple, dependency-free toast provider. Safe to wrap the whole app — toasts auto-dismiss
 * and respect `prefers-reduced-motion` via CSS.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState(/** @type {Toast[]} */ ([]));
  const counter = useRef(1);
  const timers = useRef(/** @type {Map<number, ReturnType<typeof setTimeout>>} */ (new Map()));

  const dismiss = useCallback((id) => {
    setToasts((xs) => xs.filter((x) => x.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message, opts) => {
      if (!message) return;
      const id = counter.current++;
      const kind = opts?.kind || 'info';
      const duration = Math.max(1200, Math.min(8000, opts?.duration ?? 3500));
      setToasts((xs) => [...xs, { id, message: String(message), kind, duration }]);
      const handle = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, handle);
    },
    [dismiss]
  );

  useEffect(() => {
    const ts = timers.current;
    return () => {
      ts.forEach((t) => clearTimeout(t));
      ts.clear();
    };
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pp-toastViewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            className={`pp-toast pp-toast--${toast.kind}`}
            onClick={() => dismiss(toast.id)}
          >
            <span className="pp-toast__icon" aria-hidden>
              {toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i'}
            </span>
            <span className="pp-toast__msg">{toast.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Returns `{ show(message, opts?) }`. Safe to call even without provider (no-op). */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { show: () => {} };
  }
  return ctx;
}
