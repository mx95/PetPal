import { useEffect } from 'react';

const OFFSET_VAR = '--pp-bottom-nav-offset';

/** Keep fixed bottom UI aligned when mobile browsers resize the visual viewport while scrolling. */
function syncBottomNavOffset() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  if (!vv) {
    root.style.setProperty(OFFSET_VAR, '0px');
    return;
  }
  const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  root.style.setProperty(OFFSET_VAR, `${offset}px`);
}

export function useVisualViewportBottom() {
  useEffect(() => {
    syncBottomNavOffset();
    const vv = window.visualViewport;
    if (!vv) return undefined;

    vv.addEventListener('resize', syncBottomNavOffset);
    vv.addEventListener('scroll', syncBottomNavOffset);
    window.addEventListener('resize', syncBottomNavOffset);
    window.addEventListener('orientationchange', syncBottomNavOffset);

    return () => {
      vv.removeEventListener('resize', syncBottomNavOffset);
      vv.removeEventListener('scroll', syncBottomNavOffset);
      window.removeEventListener('resize', syncBottomNavOffset);
      window.removeEventListener('orientationchange', syncBottomNavOffset);
      document.documentElement.style.removeProperty(OFFSET_VAR);
    };
  }, []);
}
