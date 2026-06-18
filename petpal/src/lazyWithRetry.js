import { lazy } from 'react';

const CHUNK_RELOAD_KEY = 'petpal_chunk_reload_attempts';
const MAX_AUTO_RELOADS = 1;

export function isChunkLoadError(error) {
  if (!error) return false;
  const name = String(error.name || '');
  const message = String(error.message || error.toString?.() || '');
  return name === 'ChunkLoadError' || /Loading chunk [\d]+ failed/i.test(message);
}

function reloadAttempts() {
  try {
    return Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
  } catch {
    return 0;
  }
}

/** One automatic full reload when a stale lazy chunk fails after deploy. */
export function reloadForStaleChunk() {
  if (typeof window === 'undefined') return false;
  const attempts = reloadAttempts();
  if (attempts >= MAX_AUTO_RELOADS) return false;
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(attempts + 1));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Call after a lazy route chunk loads successfully. */
export function noteChunkLoadSuccess() {
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
      const mod = await importFn();
      noteChunkLoadSuccess();
      return mod;
    } catch (error) {
      if (isChunkLoadError(error) && reloadForStaleChunk()) {
        return new Promise(() => {});
      }
      throw error;
    }
  });
}
