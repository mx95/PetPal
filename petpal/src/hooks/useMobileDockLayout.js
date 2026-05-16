import { useEffect } from 'react';

const BODY_CLASS = 'pp-mobile-dock';

/**
 * On phones, scroll only `.pp-main` so `position:fixed` bottom nav stays on the screen
 * when the browser chrome shows/hides (iOS Safari / mobile Chrome).
 */
export function useMobileDockLayout(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;

    const mq = window.matchMedia('(max-width: 720px)');
    const sync = () => {
      if (mq.matches) document.body.classList.add(BODY_CLASS);
      else document.body.classList.remove(BODY_CLASS);
    };

    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      document.body.classList.remove(BODY_CLASS);
    };
  }, [enabled]);
}
