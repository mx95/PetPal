const PREFS_KEY = 'petpal_inbox_browser_notify_v1';

export function loadBrowserNotifyEnabled() {
  try {
    return localStorage.getItem(PREFS_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveBrowserNotifyEnabled(enabled) {
  try {
    localStorage.setItem(PREFS_KEY, enabled ? '1' : '0');
  } catch {
    // ignore quota
  }
}

export async function ensureBrowserNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * @param {{ title: string, body: string, tag?: string, link?: string|null }} payload
 */
export function fireBrowserNotification(payload) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try {
    const n = new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag || 'petpal-inbox',
    });
    if (payload.link && typeof window !== 'undefined') {
      n.onclick = () => {
        window.focus();
        if (payload.link.startsWith('http')) {
          window.location.href = payload.link;
        } else {
          window.location.pathname = payload.link;
        }
        n.close();
      };
    }
    return true;
  } catch {
    return false;
  }
}
