import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { isFirebaseConfigured } from '../firebase';
import { countUnreadInboxMessages, mergeInboxMessages } from './inboxMerge';
import { subscribeBroadcastMessages, subscribeInboxReads } from './inboxFirestore';
import { subscribeUserNotifications } from './userNotificationsFirestore';

const InboxContext = createContext({
  messages: [],
  readIds: new Set(),
  unreadCount: 0,
  loading: true,
});

export function InboxProvider({ children }) {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [readIds, setReadIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured()) {
      setBroadcasts([]);
      setPersonal([]);
      setReadIds(new Set());
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let broadcastReady = false;
    let personalReady = false;
    let readReady = false;
    const maybeDone = () => {
      if (broadcastReady && personalReady && readReady) setLoading(false);
    };

    const unsubBroadcast = subscribeBroadcastMessages(
      (rows) => {
        setBroadcasts(rows);
        broadcastReady = true;
        maybeDone();
      },
      () => {
        setBroadcasts([]);
        broadcastReady = true;
        maybeDone();
      }
    );

    const unsubPersonal = subscribeUserNotifications(
      user.uid,
      (rows) => {
        setPersonal(rows);
        personalReady = true;
        maybeDone();
      },
      () => {
        setPersonal([]);
        personalReady = true;
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
      unsubBroadcast();
      unsubPersonal();
      unsubRead();
    };
  }, [user?.uid]);

  const messages = useMemo(() => mergeInboxMessages(broadcasts, personal, readIds), [broadcasts, personal, readIds]);

  const unreadCount = useMemo(() => countUnreadInboxMessages(messages), [messages]);

  const value = useMemo(
    () => ({ messages, readIds, unreadCount, loading }),
    [messages, readIds, unreadCount, loading]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  return useContext(InboxContext);
}
