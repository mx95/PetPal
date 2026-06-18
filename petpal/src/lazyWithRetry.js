import { lazy } from 'react';

const CHUNK_RELOAD_KEY = 'petpal_chunk_reload';

export function isChunkLoadError(error) {
  if (!error) return false;
  const name = String(error.name || '');
  const message = String(error.message || error.toString?.() || '');
  return name === 'ChunkLoadError' || /Loading chunk [\d]+ failed/i.test(message);
}

/** One automatic full reload per session when a stale lazy chunk fails after deploy. */
export function reloadForStaleChunk() {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {() => Promise<{ default: React.ComponentType }>} importFn
 */
export function lazyWithRetry(importFn) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      if (isChunkLoadError(error) && reloadForStaleChunk()) {
        return new Promise(() => {});
      }
      throw error;
    }
  });
}
