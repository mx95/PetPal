import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { isFirebaseConfigured } from '../firebase';
import { useI18n } from '../i18n/I18nContext';
import { subscribeNotifications } from '../notifications/notificationsFirestore';
import { syncPush } from '../notifications/pushMessaging';
import { subscribeBroadcastMessages, subscribeInboxReads } from './inboxFirestore';

const InboxContext = createContext({
  messages: [],
  readIds: new Set(),
  alerts: [],
  unreadCount: 0,
  loading: true,
});

export function InboxProvider({ children }) {
  const { user } = useAuth();
  const { language } = useI18n();
  const [alerts, setAlerts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [readIds, setReadIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured()) {
      setMessages([]);
      setReadIds(new Set());
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let msgReady = false;
    let readReady = false;
    const maybeDone = () => {
      if (msgReady && readReady) setLoading(false);
    };

    const unsubMsg = subscribeBroadcastMessages(
      (rows) => {
        setMessages(rows);
        msgReady = true;
        maybeDone();
      },
      () => {
        setMessages([]);
        msgReady = true;
        maybeDone();
      }
    );

    const unsubRead = subscribeInboxReads(
      user.uid,
      (ids) => {
        setReadIds(ids);
        readReady = true;
        maybeDone();
      },
      () => {
        setReadIds(new Set());
        readReady = true;
        maybeDone();
      }
    );

    return () => {
      unsubMsg();
      unsubRead();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured()) {
      setAlerts([]);
      return undefined;
    }
    return subscribeNotifications(
      user.uid,
      (rows) => setAlerts(rows),
      () => setAlerts([])
    );
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) void syncPush(user.uid, language);
  }, [user?.uid, language]);

  const unreadCount = useMemo(() => {
    const broadcastUnread = messages.filter((m) => !readIds.has(m.id)).length;
    const alertUnread = alerts.filter((a) => !a.read).length;
    return broadcastUnread + alertUnread;
  }, [messages, readIds, alerts]);

  const value = useMemo(
    () => ({ messages, readIds, alerts, unreadCount, loading }),
    [messages, readIds, alerts, unreadCount, loading]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  return useContext(InboxContext);
}
