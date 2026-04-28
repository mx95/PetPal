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
   * @param {string[]|undefined} imageDataUrls
   * @param {{ style: 'map'|'bar', km: number, createdAt: string, petName?: string } | null | undefined} walkEmbed
   * @param {{ postAs: 'company', businessName: string, lat: number, lng: number, boosted?: boolean, boostPaymentPending?: boolean } | undefined} companyOpts
   * @param {string|undefined} [videoDataUrl] — one short clip, data: URL, max size enforced in the UI
   */
  const addUserPost = useCallback(
    (caption, petIds, imageDataUrls, walkEmbed, companyOpts, videoDataUrl) => {
      const text = (caption || '').trim();
      const video =
        typeof videoDataUrl === 'string' && videoDataUrl.startsWith('data:') && /data:video\//.test(videoDataUrl)
          ? videoDataUrl
          : undefined;
      const maxImages = video ? 3 : 4;
      const images = Array.isArray(imageDataUrls)
        ? imageDataUrls.filter((s) => typeof s === 'string' && s.startsWith('data:')).slice(0, maxImages)
        : [];
      const isCompany = Boolean(
        companyOpts &&
          companyOpts.postAs === 'company' &&
          String(companyOpts.businessName || '').trim().length > 0 &&
          Number.isFinite(Number(companyOpts.lat)) &&
          Number.isFinite(Number(companyOpts.lng))
      );
      if (!isCompany && !petIds.length) return;
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
      if (!text && images.length === 0 && !we && !video) return;
      let names = [];
      if (!isCompany) {
        names = petIds
          .map((id) => pets.find((p) => p.id === id))
          .filter(Boolean)
          .map((p) => p.name);
        if (!names.length) return;
      }
      const author = isCompany
        ? String(companyOpts.businessName).trim()
        : user?.displayName || user?.email?.split('@')[0] || 'You';
      const tints = [
        'linear-gradient(135deg, #ffe8f0 0%, #e8f4ff 100%)',
        'linear-gradient(135deg, #e8f0ff 0%, #f3e8ff 100%)',
        'linear-gradient(135deg, #ecfdf3 0%, #fff7ed 100%)',
      ];
      const first = !isCompany ? pets.find((p) => p.id === petIds[0]) : null;
      const boosted = Boolean(isCompany && companyOpts.boosted);
      const post = {
        id: newPostId(),
        isUser: true,
        author,
        authorKind: isCompany ? 'company' : 'pet_owner',
        petNames: names,
        petIds: isCompany ? [] : petIds,
        petEmoji: isCompany ? '🏢' : categoryEmoji(first?.categoryId) || '🐾',
        timeLabel: 'now',
        caption: text,
        imageUrls: images.length > 0 ? images : undefined,
        videoUrl: video,
        walkEmbed: we,
        tags: isCompany ? ['sniffshare', 'business'] : ['sniffshare'],
        likes: 0,
        comments: 0,
        companyLocation: isCompany ? { lat: companyOpts.lat, lng: companyOpts.lng } : undefined,
        boosted,
        boostPaymentPending: boosted ? Boolean(companyOpts.boostPaymentPending) : false,
        imageTint: images.length > 0 || we || video ? undefined : tints[Math.floor(Math.random() * tints.length)],
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
