import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { categoryEmoji } from '../pets/petCategories';
import { usePets } from '../pets/PetsContext';
import { loadUserFeed, saveUserFeed } from './communityStorage';

const CommunityContext = createContext(null);

function newPostId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `up_${crypto.randomUUID()}`;
  return `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function CommunityProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { pets } = usePets();
  const [userPosts, setUserPosts] = useState([]);

  useEffect(() => {
    if (!uid) {
      setUserPosts([]);
      return;
    }
    setUserPosts(loadUserFeed(uid));
  }, [uid]);

  /**
   * @param {string} caption
   * @param {string[]} petIds
   */
  const addUserPost = useCallback(
    (caption, petIds) => {
      const text = (caption || '').trim();
      if (!text || !petIds.length) return;
      const names = petIds
        .map((id) => pets.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => p.name);
      if (!names.length) return;
      const author = user?.displayName || user?.email?.split('@')[0] || 'You';
      const tints = [
        'linear-gradient(135deg, #ffe8f0 0%, #e8f4ff 100%)',
        'linear-gradient(135deg, #e8f0ff 0%, #f3e8ff 100%)',
        'linear-gradient(135deg, #ecfdf3 0%, #fff7ed 100%)',
      ];
      const first = pets.find((p) => p.id === petIds[0]);
      const post = {
        id: newPostId(),
        isUser: true,
        author,
        petNames: names,
        petIds,
        petEmoji: categoryEmoji(first?.categoryId) || '🐾',
        timeLabel: 'now',
        caption: text,
        tags: ['sniffshare'],
        likes: 0,
        comments: 0,
        imageTint: tints[Math.floor(Math.random() * tints.length)],
      };
      setUserPosts((prev) => {
        const next = [post, ...prev];
        if (uid) saveUserFeed(uid, next);
        return next;
      });
    },
    [pets, user, uid]
  );

  const value = useMemo(
    () => ({
      userPosts,
      addUserPost,
    }),
    [userPosts, addUserPost]
  );

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error('useCommunity must be used within CommunityProvider');
  return ctx;
}
