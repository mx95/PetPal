import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { isFirebaseConfigured } from '../firebase';
import { subscribeBroadcastMessages, subscribeInboxReads } from './inboxFirestore';

const InboxContext = createContext({
  messages: [],
  readIds: new Set(),
  unreadCount: 0,
  loading: true,
});

export function InboxProvider({ children }) {
  const { user } = useAuth();
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

  const unreadCount = useMemo(() => {
    if (!messages.length) return 0;
    return messages.filter((m) => !readIds.has(m.id)).length;
  }, [messages, readIds]);

  const value = useMemo(
    () => ({ messages, readIds, unreadCount, loading }),
    [messages, readIds, unreadCount, loading]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  return useContext(InboxContext);
}
