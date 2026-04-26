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
   * @param {string[]|undefined} imageDataUrls - optional resized data URLs (e.g. from `filesToResizedDataUrls`)
   * @param {{ style: 'map'|'bar', km: number, createdAt: string, petName?: string } | null | undefined} walkEmbed
   */
  const addUserPost = useCallback(
    (caption, petIds, imageDataUrls, walkEmbed) => {
      const text = (caption || '').trim();
      const images = Array.isArray(imageDataUrls) ? imageDataUrls.filter((s) => typeof s === 'string' && s.startsWith('data:')).slice(0, 4) : [];
      if (!petIds.length) return;
      const we =
        walkEmbed &&
        typeof walkEmbed === 'object' &&
        (walkEmbed.style === 'map' || walkEmbed.style === 'bar') &&
        Number(walkEmbed.km) > 0
          ? {
              style: walkEmbed.style,
              km: Math.round(Number(walkEmbed.km) * 100) / 100,
              createdAt: String(walkEmbed.createdAt || new Date().toISOString()),
              petName: walkEmbed.petName ? String(walkEmbed.petName).trim() : undefined,
            }
          : undefined;
      if (!text && images.length === 0 && !we) return;
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
        imageUrls: images.length > 0 ? images : undefined,
        walkEmbed: we,
        tags: ['sniffshare'],
        likes: 0,
        comments: 0,
        imageTint: images.length > 0 || we ? undefined : tints[Math.floor(Math.random() * tints.length)],
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
