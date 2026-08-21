import React, { createContext, useContext } from 'react';

export const InboxContext = createContext({
  messages: [],
  readIds: new Set(),
  unreadCount: 0,
  loading: true,
});

export function useInbox() {
  return useContext(InboxContext);
}
