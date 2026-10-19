import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useInbox } from '../inbox/InboxContext';
import { NOTIFICATION_TYPE_ICONS } from '../inbox/notificationTypes';
import { fireBrowserNotification, loadBrowserNotifyEnabled } from '../inbox/notificationPrefs';

/** Fire browser notifications when new unread inbox items arrive (tab can be in background). */
export function InboxNotificationHost() {
  const { user } = useAuth();
  const { messages, loading } = useInbox();
  const { t } = useI18n();
  const seenRef = useRef(new Set());
  const primedRef = useRef(false);

  useEffect(() => {
    if (!user?.uid || loading) return;

    const unread = messages.filter((m) => !m.read);
    const currentKeys = new Set(unread.map((m) => m.inboxKey));

    if (!primedRef.current) {
      unread.forEach((m) => seenRef.current.add(m.inboxKey));
      primedRef.current = true;
      return;
    }

    if (!loadBrowserNotifyEnabled()) {
      unread.forEach((m) => seenRef.current.add(m.inboxKey));
      return;
    }

    for (const message of unread) {
      if (seenRef.current.has(message.inboxKey)) continue;
      seenRef.current.add(message.inboxKey);
      const icon = NOTIFICATION_TYPE_ICONS[message.type] || NOTIFICATION_TYPE_ICONS.system;
      fireBrowserNotification({
        title: `${icon} ${message.title}`,
        body: message.body,
        tag: message.inboxKey,
        link: message.link || '/inbox',
      });
    }

    for (const key of [...seenRef.current]) {
      if (!currentKeys.has(key)) seenRef.current.delete(key);
    }
  }, [user?.uid, messages, loading, t]);

  useEffect(() => {
    if (!user?.uid) {
      seenRef.current = new Set();
      primedRef.current = false;
    }
  }, [user?.uid]);

  return null;
}
