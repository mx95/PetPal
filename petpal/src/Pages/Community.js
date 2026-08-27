import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useGame } from '../game/GameContext';
import { useLostPet } from '../lostPet/LostPetContext';
import { usePets } from '../pets/PetsContext';
import PetAvatar from '../components/PetAvatar';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';
import { useCommunity } from '../social/CommunityContext';
import { lostListingToFeedPost, strayListingToFeedPost } from '../social/communityFeedNormalize';
import { WalkPostEmbed } from '../social/walkPostEmbed';
import { fileToSmallVideoDataUrl, MAX_COMMUNITY_VIDEO_BYTES } from '../social/communityVideo';
import { useStrayListings } from '../stray/useStrayListings';
import { filesToResizedDataUrls } from '../walk/walkPhotos';

function postKey(post) {
  return post.id;
}

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function PostCard({ post, taggedPet, authorLetter }) {
  const { t } = useI18n();
  const { show: showToast } = useToast();
  const [liked, setLiked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [localComments, setLocalComments] = useState(() => []);
  const baseLikes = Number(post.likes) || 0;
  const shownLikes = baseLikes + (liked ? 1 : 0);
  const feedKind = post.feedKind || 'community';
  const names = post.petNames?.length ? post.petNames : post.petName ? [post.petName] : [];
  const emoji = post.petEmoji || '🐾';
  const bylinePets = names.length ? t('community.authorWithPets', { names: names.join(', ') }) : null;
  const isCompany = post.authorKind === 'company';
  const hasImages = post.imageUrls && post.imageUrls.length > 0;
  const hasVideo = Boolean(post.videoUrl);
  const hasWalk = Boolean(post.walkEmbed);
  const humanLetter = (authorLetter || post.author || '?').trim().charAt(0).toUpperCase();

  const shownComments = (Number(post.comments) || 0) + localComments.length;

  async function copyAuthor() {
    const val = String(post.author || '').trim();
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      showToast(t('community.copied'));
    } catch {
      showToast(val);
    }
  }

  function submitComment() {
    const text = String(commentDraft || '').trim().slice(0, 220);
    if (!text) return;
    setLocalComments((prev) => [{ id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, text }, ...prev].slice(0, 20));
    setCommentDraft('');
    setCommentsOpen(true);
  }

  return (
    <article
      className={`pp-post pp-post--card${post.boosted ? ' pp-post--boosted' : ''}${
        feedKind === 'lostPet' ? ' pp-post--feedLost' : ''
      }${feedKind === 'stray' ? ' pp-post--feedStray' : ''}`}
      data-user={post.isUser ? 'yes' : undefined}
      data-feed-kind={feedKind}
    >
      {post.boosted ? (
        <div className="pp-post__boostBadge" role="status">
          {post.boostPaymentPending ? t('community.postPromotedPending') : t('community.postPromoted')}
        </div>
      ) : null}
      <header className="pp-post__head pp-post__head--card">
        <div className="pp-post__actorRow">
          <div className="pp-post__avatarsPair">
            <div className="pp-post__humanAvatar">{isCompany ? '🏢' : humanLetter}</div>
            {!isCompany ? (
              taggedPet ? (
                <PetAvatar pet={taggedPet} size={40} className="pp-post__petFace pp-post__petFace--feed" />
              ) : (
                <div className="pp-post__petAvatarFallback" aria-hidden>
                  {emoji}
                </div>
              )
            ) : null}
          </div>
          <div className="pp-post__meta">
          <div className="pp-post__title">
            <button type="button" className="pp-post__human" onClick={copyAuthor} title={t('community.copyAuthor')}>
              {post.author}
              <span aria-hidden style={{ marginLeft: 6, opacity: 0.7, fontWeight: 900 }}>
                ▾
              </span>
            </button>
            {isCompany ? (
              <>
                <span className="pp-post__dot">·</span>
                <span className="pp-post__pet">{t('community.business')}</span>
              </>
            ) : bylinePets ? (
              <>
                <span className="pp-post__dot">·</span>
                <span className="pp-post__pet">{bylinePets}</span>
              </>
            ) : (
              <>
                <span className="pp-post__dot">·</span>
                <span className="pp-post__pet">{t('community.feedPackMoments')}</span>
              </>
            )}
          </div>
          <div className="pp-post__time">
            {post.timeLabel}
            {isCompany && post.companyLocation && (
              <>
                <span className="pp-post__dot" style={{ color: '#98a2b3' }} aria-hidden>
                  {' '}
                  ·{' '}
                </span>
                <a
                  className="pp-link"
                  style={{ display: 'inline', fontSize: 12, padding: 0, fontWeight: 700 }}
                  href={mapsLink(post.companyLocation.lat, post.companyLocation.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('community.mapLink')}
                </a>
              </>
            )}
          </div>
        </div>
        </div>
      </header>

      {feedKind === 'lostPet' || feedKind === 'stray' ? (
        <div
          className={`pp-post__feedRibbon pp-post__feedRibbon--${feedKind === 'lostPet' ? 'lost' : 'stray'}`}
          role="status"
        >
          {feedKind === 'lostPet' ? t('community.feedRibbonLost') : t('community.feedRibbonStray')}
          {feedKind === 'lostPet' && post.isDemoLost ? (
            <span className="pp-post__feedRibbonBadge"> {t('community.feedBadgeDemo')}</span>
          ) : null}
          {feedKind === 'stray' && post.straySampleMarker ? (
            <span className="pp-post__feedRibbonBadge"> {t('community.feedBadgeDemo')}</span>
          ) : null}
        </div>
      ) : null}

      {hasImages ? (
        <div
          className={`pp-post__media pp-post__media--photos ${post.imageUrls.length > 1 ? 'pp-post__media--multi' : ''}`}
          role="img"
          aria-label={names[0] ? t('community.photosWithPet', { name: names[0] }) : t('community.postPhotos')}
        >
          {post.imageUrls.length === 1 ? (
            <img src={post.imageUrls[0]} alt="" className="pp-post__img" />
          ) : (
            <div className="pp-post__imgGrid">
              {post.imageUrls.map((src, i) => (
                <img key={i} src={src} alt="" className="pp-post__imgCell" />
              ))}
            </div>
          )}
        </div>
      ) : null}
      {hasVideo ? (
        <div className="pp-post__media pp-post__media--photos pp-post__media--video" style={{ width: '100%' }}>
          <video
            src={post.videoUrl}
            className="pp-post__video"
            controls
            playsInline
            preload="metadata"
            aria-label={names[0] ? t('community.videoWithPet', { name: names[0] }) : t('community.postVideo')}
          />
        </div>
      ) : null}
      {hasWalk && (hasImages || hasVideo) ? (
        <div className="pp-post__walkBlock">
          <WalkPostEmbed walkEmbed={post.walkEmbed} compact />
        </div>
      ) : null}
      {hasWalk && !hasImages && !hasVideo ? (
        <div className="pp-post__media pp-post__media--walkOnly" role="img" aria-label={t('community.latestWalk')}>
          <WalkPostEmbed walkEmbed={post.walkEmbed} />
        </div>
      ) : null}
      {!hasImages && !hasVideo && !hasWalk ? (
        <div
          className="pp-post__media"
          style={{ background: post.imageTint }}
          role="img"
          aria-label={
            isCompany
              ? t('community.businessPost')
              : names[0]
                ? t('community.photoForPet', { name: names[0] })
                : t('community.postMedia')
          }
        >
          <span className="pp-post__mediaIcon" aria-hidden>
            {isCompany ? '🏢' : feedKind === 'lostPet' ? '🆘' : feedKind === 'stray' ? '🏡' : '🐾'}
          </span>
        </div>
      ) : null}

      {post.caption ? (
        <p
          className={`pp-post__caption pp-post__caption--card${
            feedKind === 'lostPet' || feedKind === 'stray' ? ' pp-post__caption--preLine' : ''
          }`}
        >
          {feedKind === 'community' ? (
            <>
              <span className="pp-post__captionAuthor">{post.author}</span> {post.caption}
            </>
          ) : (
            post.caption
          )}
        </p>
      ) : null}

      <div className="pp-post__engage">
        <button
          type="button"
          className={`pp-post__action pp-post__action--heart ${liked ? 'pp-post__action--on' : ''}`}
          onClick={() => setLiked((v) => !v)}
          aria-pressed={liked}
          aria-label={t('community.feedLike')}
        >
          {liked ? '❤️' : '🤍'} <span>{shownLikes}</span>
        </button>
        <button
          type="button"
          className="pp-post__action"
          aria-label={t('community.feedComment')}
          aria-expanded={commentsOpen}
          onClick={() => setCommentsOpen((v) => !v)}
        >
          💬 <span>{shownComments}</span>
        </button>
        <button type="button" className="pp-post__action pp-post__action--share" aria-label={t('community.feedShare')}>
          ↗
        </button>
      </div>

      {commentsOpen ? (
        <div className="pp-post__comments">
          <div className="pp-post__commentComposer">
            <input
              className="pp-input"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder={t('community.writeComment')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitComment();
              }}
            />
            <button type="button" className="pp-btn pp-btn--primary" onClick={submitComment}>
              {t('community.postComment')}
            </button>
          </div>
          {localComments.length === 0 ? (
            <div className="pp-muted" style={{ marginTop: 8, fontSize: 13 }}>
              {t('community.noComments')}
            </div>
          ) : (
            <div className="pp-stack" style={{ marginTop: 10 }}>
              {localComments.map((c) => (
                <div key={c.id} className="pp-rowBetween pp-rowBetween--card" style={{ padding: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{c.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {post.tags?.length ? (
        <div className="pp-post__tags">
          {post.tags.map((tg) => (
            <span key={tg} className="pp-tag">
              #{tg}
            </span>
          ))}
        </div>
      ) : null}

      {(feedKind === 'lostPet' || feedKind === 'stray') && (
        <div className="pp-post__premiumFeedLinkWrap">
          <Link
            className="pp-link"
            style={{ padding: 0 }}
            to={feedKind === 'lostPet' ? '/lost-pet' : '/shelters'}
          >
            {feedKind === 'lostPet' ? t('community.feedPremiumLinkLost') : t('community.feedPremiumLinkStray')} →
          </Link>
        </div>
      )}
    </article>
  );
}

/**
 * Pet-first social feed: owner + one or more pets on each post.
 */
export default function Community() {
  const { show: showToast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const { isApprovedCompany, profile: companyProfile } = useCompany();
  const { pets, getCategory } = usePets();
  const { latestWalk } = useGame();
  const { userPosts, addUserPost } = useCommunity();
  const [postKind, setPostKind] = useState(/** @type {'pets' | 'business'} */ ('pets'));
  const [boostBusinessPost, setBoostBusinessPost] = useState(false);
  const [caption, setCaption] = useState('');
  const [picked, setPicked] = useState(() => ({}));
  const [includeWalk, setIncludeWalk] = useState(false);
  const [walkStyle, setWalkStyle] = useState('map');
  const [walkForPetId, setWalkForPetId] = useState('');
  const [feedFilter, setFeedFilter] = useState(() => 'all');
  const hiddenPhotoInputId = useId();
  const hiddenVideoInputId = useId();
  const hiddenPhotoElRef = useRef(null);
  const hiddenVideoElRef = useRef(null);
  const composeSheetRef = useRef(null);
  const composeTextareaRef = useRef(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [stagedPhotos, setStagedPhotos] = useState(/** @type {File[]} */ ([]));
  const [stagedVideo, setStagedVideo] = useState(/** @type {File|null} */ (null));
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState(/** @type {string[]} */ ([]));
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(/** @type {string|null} */ (null));
  const [postPhotoBusy, setPostPhotoBusy] = useState(false);

  const taggedIds = useMemo(
    () => Object.entries(picked).filter(([, on]) => on).map(([id]) => id),
    [picked]
  );

  const displayName = user?.displayName || user?.email?.split('@')[0] || t('community.you');
  const { activeListings } = useLostPet();
  const { availableFeed: strayFeedRows } = useStrayListings();

  const unifiedFeed = useMemo(() => {
    const communityPieces = [];
    userPosts.forEach((p) => {
      communityPieces.push({
        ...p,
        feedKind: p.feedKind || 'community',
        sortAt: typeof p.sortAt === 'number' ? p.sortAt : 0,
      });
    });
    const lostMerged = activeListings.map((lo) => lostListingToFeedPost(lo, displayName, t));

    const strayPieces = strayFeedRows.map((row) => strayListingToFeedPost(row, t));

    const merged = [...communityPieces, ...lostMerged, ...strayPieces];
    merged.sort((a, b) => (Number(b.sortAt) || 0) - (Number(a.sortAt) || 0));
    return merged;
  }, [userPosts, activeListings, strayFeedRows, displayName, t]);

  const filteredFeed = useMemo(() => {
    if (feedFilter === 'all') return unifiedFeed;
    return unifiedFeed.filter((p) => (p.feedKind || 'community') === feedFilter);
  }, [unifiedFeed, feedFilter]);

  useEffect(() => {
    if (postKind === 'business') {
      setIncludeWalk(false);
    }
    setStagedPhotos([]);
    setStagedVideo(null);
  }, [postKind]);

  useEffect(() => {
    const urls = stagedPhotos.map((f) => URL.createObjectURL(f));
    setPhotoPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [stagedPhotos]);

  useEffect(() => {
    if (!stagedVideo) {
      setVideoPreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(stagedVideo);
    setVideoPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [stagedVideo]);

  useEffect(() => {
    if (!includeWalk) return;
    const poolIds = taggedIds.length ? taggedIds : pets.map((p) => p.id);
    if (!poolIds.length) return;
    if (!walkForPetId || !poolIds.includes(walkForPetId)) {
      setWalkForPetId(poolIds[0]);
    }
  }, [includeWalk, taggedIds, walkForPetId, pets]);

  useEffect(() => {
    if (!composerOpen) return;
    const tid = window.setTimeout(() => composeTextareaRef.current?.focus(), 180);
    return () => window.clearTimeout(tid);
  }, [composerOpen]);

  useEffect(() => {
    if (!composerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setComposerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [composerOpen]);

  useEffect(() => {
    if (!composerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [composerOpen]);

  function togglePet(id) {
    setPicked((p) => ({ ...p, [id]: !p[id] }));
  }

  async function submitPost(e) {
    e.preventDefault();
    const businessMode = isApprovedCompany && postKind === 'business' && companyProfile;
    const ids = taggedIds;
    let imageUrls;
    let videoDataUrl;
    const videoFile = stagedVideo;

    const maxImagesCap = videoFile ? 3 : 4;
    const photosSlice = stagedPhotos.slice(0, maxImagesCap);
    if (videoFile || photosSlice.length > 0) {
      setPostPhotoBusy(true);
      try {
        if (videoFile) {
          videoDataUrl = await fileToSmallVideoDataUrl(videoFile);
        }
        if (photosSlice.length) {
          const maxPh = videoDataUrl ? 3 : 4;
          imageUrls = await filesToResizedDataUrls(photosSlice.slice(0, maxPh));
        }
      } catch (err) {
        showToast(err?.message || t('community.mediaAddError'), { kind: 'error' });
        return;
      } finally {
        setPostPhotoBusy(false);
      }
    }
    const walkPet = pets.find((p) => p.id === walkForPetId);
    const walkEmbed =
      !businessMode && includeWalk && latestWalk && Number(latestWalk.km) > 0
        ? {
            style: walkStyle === 'bar' ? 'bar' : 'map',
            km: latestWalk.km,
            createdAt: latestWalk.createdAt,
            petName: walkPet?.name,
          }
        : undefined;
    const text = caption.trim();
    if (!text && (!imageUrls || imageUrls.length === 0) && !videoDataUrl && !walkEmbed) return;
    if (businessMode) {
      addUserPost(
        caption,
        [],
        imageUrls,
        undefined,
        {
          postAs: 'company',
          businessName: companyProfile.businessName,
          lat: companyProfile.lat,
          lng: companyProfile.lng,
          boosted: boostBusinessPost,
          boostPaymentPending: boostBusinessPost,
        },
        videoDataUrl
      );
    } else {
      addUserPost(caption, ids, imageUrls, walkEmbed, undefined, videoDataUrl);
    }
    setCaption('');
    setPicked({});
    setIncludeWalk(false);
    setWalkStyle('map');
    setWalkForPetId('');
    setStagedPhotos([]);
    setStagedVideo(null);
    setBoostBusinessPost(false);
    setMoreDetailsOpen(false);
    setComposerOpen(false);
  }

  const businessReady = isApprovedCompany && postKind === 'business' && companyProfile;
  const petBodyReady =
    Boolean(caption.trim()) || stagedPhotos.length > 0 || Boolean(stagedVideo) || !!(includeWalk && latestWalk && Number(latestWalk.km) > 0);
  const businessBodyReady =
    Boolean(caption.trim()) || stagedPhotos.length > 0 || Boolean(stagedVideo);
  const businessCanShare = Boolean(businessReady && businessBodyReady);
  const petCanShare = postKind === 'pets' && petBodyReady;
  const canShare =
    (isApprovedCompany && postKind === 'business' && businessCanShare) || petCanShare;
  const teaserPetName = pets[0]?.name || '';
  const maxVideoLabelMb = (MAX_COMMUNITY_VIDEO_BYTES / (1024 * 1024)).toFixed(1);

  function onHiddenPhotoPick(e) {
    const fs = e.target.files;
    if (fs?.length) {
      const add = Array.from(fs).filter((f) => f.type.startsWith('image/'));
      const cap = stagedVideo ? 3 : 4;
      setStagedPhotos((prev) => [...prev, ...add].slice(0, cap));
      setComposerOpen(true);
    }
    e.target.value = '';
  }

  function onHiddenVideoPick(e) {
    const f = e.target.files?.[0];
    if (f) {
      setStagedVideo(f);
      setStagedPhotos((prev) => prev.slice(0, 3));
      setComposerOpen(true);
    }
    e.target.value = '';
  }

  function removeStagedPhotoAt(index) {
    setStagedPhotos((prev) => prev.filter((_, j) => j !== index));
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge">{t('community.badge')}</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('community.title')}
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 560 }}>
              {t('community.intro', { name: displayName })}
              {isApprovedCompany ? (
                <>
                  {' '}
                  {t('community.introBusiness')}
                </>
              ) : null}{' '}
              {t('community.introFeed')}
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            {t('common.backDashboard')}
          </Link>
        </div>
      </div>

      {pets.length > 0 || isApprovedCompany ? (
        <div className="pp-col-12 pp-createPost">
          <input
            id={hiddenPhotoInputId}
            ref={hiddenPhotoElRef}
            type="file"
            accept="image/*"
            multiple
            className="pp-visuallyHidden"
            onChange={onHiddenPhotoPick}
          />
          <input
            id={hiddenVideoInputId}
            ref={hiddenVideoElRef}
            type="file"
            accept="video/*"
            className="pp-visuallyHidden"
            onChange={onHiddenVideoPick}
          />

          <div className="pp-composeTeaser">
            {isApprovedCompany && companyProfile ? (
              <div className="pp-composeTeaser__mode" role="tablist" aria-label={t('community.postAs')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={postKind === 'pets'}
                  className={`pp-composeModePill ${postKind === 'pets' ? 'pp-composeModePill--on' : ''}`}
                  onClick={() => setPostKind('pets')}
                >
                  {t('community.moment')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={postKind === 'business'}
                  className={`pp-composeModePill ${postKind === 'business' ? 'pp-composeModePill--on' : ''}`}
                  onClick={() => setPostKind('business')}
                >
                  {t('community.business')}
                </button>
              </div>
            ) : null}

            {isApprovedCompany && postKind === 'pets' && !pets.length ? (
              <p className="pp-subtle pp-composeTeaser__hint">{t('community.noPetsHint')}</p>
            ) : (
              <div className="pp-composeTeaser__card">
                <div className="pp-composeTeaser__row">
                  <span className="pp-composeTeaser__avatar" aria-hidden>
                    {displayName.trim().charAt(0).toUpperCase()}
                  </span>
                  <button type="button" className="pp-composeTeaser__fakeInput" onClick={() => setComposerOpen(true)}>
                    {postKind === 'business'
                      ? t('community.composerBusinessTeaser')
                      : teaserPetName
                        ? t('community.composerPlaceholder', { name: teaserPetName })
                        : t('community.composerPlaceholderNeutral')}
                  </button>
                </div>
                <div className="pp-composeTeaser__tools">
                  <button
                    type="button"
                    className="pp-composeToolBtn"
                    aria-label={t('community.composerAddPhoto')}
                    onClick={() => hiddenPhotoElRef.current?.click()}
                  >
                    📷
                  </button>
                  <button
                    type="button"
                    className="pp-composeToolBtn"
                    aria-label={t('community.composerAddVideo')}
                    onClick={() => hiddenVideoElRef.current?.click()}
                  >
                    🎥
                  </button>
                  {postKind === 'pets' && pets.length > 0 ? (
                    <button
                      type="button"
                      className="pp-composeToolBtn"
                      aria-label={t('community.composerTagPet')}
                      onClick={() => setComposerOpen(true)}
                    >
                      🐾
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {composerOpen ? (
            <div
              className="pp-composeOverlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pp-compose-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setComposerOpen(false);
              }}
            >
              <div ref={composeSheetRef} className="pp-composeSheet" onClick={(e) => e.stopPropagation()}>
                <div className="pp-composeSheet__topBar">
                  <h2 id="pp-compose-title" className="pp-composeSheet__title">
                    {t('community.composerTitle')}
                  </h2>
                  <button
                    type="button"
                    className="pp-composeSheet__close"
                    onClick={() => setComposerOpen(false)}
                    aria-label={t('community.composerCloseAria')}
                  >
                    ✕
                  </button>
                </div>

                <form className="pp-composeForm" onSubmit={submitPost}>
                  {isApprovedCompany && companyProfile ? (
                    <div className="pp-composeSheet__mode" role="group" aria-label={t('community.postAs')}>
                      <button
                        type="button"
                        className={`pp-composeModePill ${postKind === 'pets' ? 'pp-composeModePill--on' : ''}`}
                        onClick={() => setPostKind('pets')}
                      >
                        {t('community.moment')}
                      </button>
                      <button
                        type="button"
                        className={`pp-composeModePill ${postKind === 'business' ? 'pp-composeModePill--on' : ''}`}
                        onClick={() => setPostKind('business')}
                      >
                        {t('community.business')}
                      </button>
                    </div>
                  ) : null}

                  {postKind === 'business' && companyProfile ? (
                    <p className="pp-subtle pp-composePinLine">
                      {t('community.mapPin')} <strong>{companyProfile.businessName}</strong> ·{' '}
                      <Link to="/company/apply" className="pp-link" style={{ display: 'inline', padding: 0 }}>
                        {t('community.businessSettings')}
                      </Link>
                    </p>
                  ) : null}

                  <label className="pp-visuallyHidden" htmlFor="pp-compose-textarea">
                    {t('community.newPost')}
                  </label>
                  <textarea
                    id="pp-compose-textarea"
                    ref={composeTextareaRef}
                    className="pp-composeTextarea"
                    rows={4}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={
                      postKind === 'business'
                        ? t('community.composerBusinessPlaceholder')
                        : teaserPetName
                          ? t('community.composerPlaceholder', { name: teaserPetName })
                          : t('community.composerPlaceholderNeutral')
                    }
                  />

                  {(photoPreviewUrls.length > 0 || videoPreviewUrl) && (
                    <div className="pp-composePreviews">
                      {photoPreviewUrls.map((url, i) => (
                        <div key={`${url}-${i}`} className="pp-composePreviewTile">
                          <img src={url} alt="" className="pp-composePreviewImg" />
                          <button
                            type="button"
                            className="pp-composePreviewRemove"
                            onClick={() => removeStagedPhotoAt(i)}
                            aria-label={t('community.composerRemovePhoto')}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {videoPreviewUrl ? (
                        <div className="pp-composePreviewTile pp-composePreviewTile--video">
                          <video src={videoPreviewUrl} className="pp-composePreviewVideo" controls muted playsInline />
                          <button
                            type="button"
                            className="pp-composePreviewRemove"
                            onClick={() => setStagedVideo(null)}
                            aria-label={t('community.composerRemoveVideo')}
                          >
                            ×
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="pp-composeMediaRow">
                    <button type="button" className="pp-composeMediaBtn" onClick={() => hiddenPhotoElRef.current?.click()}>
                      📷 {t('community.composerPhotoLabel')}
                    </button>
                    <button type="button" className="pp-composeMediaBtn" onClick={() => hiddenVideoElRef.current?.click()}>
                      🎥 {t('community.composerVideoLabel')}
                    </button>
                  </div>

                  {postKind === 'pets' && pets.length > 0 ? (
                    <div className="pp-composeChipsBlock">
                      <div className="pp-composeChipsLabel">{t('community.composerTagLabel')}</div>
                      <div className="pp-composeChips" role="group" aria-label={t('community.composerTagLabel')}>
                        {pets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={`pp-composePetChip ${picked[p.id] ? 'pp-composePetChip--on' : ''}`}
                            aria-pressed={!!picked[p.id]}
                            onClick={() => togglePet(p.id)}
                          >
                            <PetAvatar pet={p} size={32} className="pp-composePetChip__av" />
                            <span>{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="pp-composeMoreToggle"
                    aria-expanded={moreDetailsOpen}
                    onClick={() => setMoreDetailsOpen((v) => !v)}
                  >
                    {t('community.composerMoreDetails')}
                    <span className="pp-composeMoreToggle__chev">{moreDetailsOpen ? '▴' : '▾'}</span>
                  </button>

                  {moreDetailsOpen ? (
                    <div className="pp-composeDetails">
                      {postKind === 'business' && isApprovedCompany ? (
                        <label className="pp-composeBoost">
                          <input
                            type="checkbox"
                            checked={boostBusinessPost}
                            onChange={(e) => setBoostBusinessPost(e.target.checked)}
                          />
                          <span>{t('community.composerBoostLabel')}</span>
                        </label>
                      ) : null}

                      {postKind === 'pets' && pets.length > 0 ? (
                        <div className="pp-composeWalkBlock">
                          <label className="pp-composeWalkRow">
                            <input
                              type="checkbox"
                              checked={includeWalk}
                              disabled={!latestWalk || Number(latestWalk.km) <= 0}
                              onChange={(e) => setIncludeWalk(e.target.checked)}
                            />
                            <span>{t('community.walkOptional')}</span>
                          </label>
                          {!latestWalk || Number(latestWalk.km) <= 0 ? (
                            <p className="pp-subtle pp-composeWalkHint">{t('community.noWalkYet')}</p>
                          ) : (
                            <>
                              <div className="pp-composeWalkStyles" role="radiogroup">
                                <button
                                  type="button"
                                  className={`pp-composeWalkStyleBtn ${walkStyle === 'map' ? 'pp-composeWalkStyleBtn--on' : ''}`}
                                  onClick={() => setWalkStyle('map')}
                                >
                                  {t('community.walkStyleMap')}
                                </button>
                                <button
                                  type="button"
                                  className={`pp-composeWalkStyleBtn ${walkStyle === 'bar' ? 'pp-composeWalkStyleBtn--on' : ''}`}
                                  onClick={() => setWalkStyle('bar')}
                                >
                                  {t('community.walkStyleBar')}
                                </button>
                              </div>
                              {includeWalk ? (
                                <div className="pp-composeWalkFor">
                                  <span className="pp-composeWalkForLabel">{t('community.walkLabelFor')}</span>
                                  <div className="pp-composeWalkChips">
                                    {(taggedIds.length ? taggedIds : pets.map((p) => p.id)).map((id) => {
                                      const p = pets.find((x) => x.id === id);
                                      if (!p) return null;
                                      return (
                                        <button
                                          key={id}
                                          type="button"
                                          className={`pp-composeWalkChip ${walkForPetId === id ? 'pp-composeWalkChip--on' : ''}`}
                                          onClick={() => setWalkForPetId(id)}
                                        >
                                          {getCategory(p).emoji} {p.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="pp-subtle pp-composeVideoCap" style={{ fontSize: 12, marginBottom: 0 }}>
                    {t('community.composerVideoHint', { mb: maxVideoLabelMb })}
                  </p>

                  <div className="pp-composeFooter">
                    <button
                      type="submit"
                      className="pp-btn pp-btnPrimary pp-composeShareBtn"
                      disabled={!canShare || postPhotoBusy}
                    >
                      {postPhotoBusy ? t('community.composerPosting') : t('community.shareCta')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="pp-col-12">
          <p className="pp-subtle">
            {t('community.noPetsCtaStart')}{' '}
            <Link className="pp-link" to="/pets" style={{ padding: 0, display: 'inline' }}>
              {t('community.noPetsCtaMyPets')}
            </Link>{' '}
            {t('community.noPetsCtaMiddle')}{' '}
            <Link className="pp-link" to="/register" style={{ padding: 0, display: 'inline' }}>
              {t('community.noPetsCtaRegister')}
            </Link>{' '}
            {t('community.noPetsCtaEnd')}
          </p>
        </div>
      )}

      {pets.length > 0 ? (
        <div className="pp-col-12">
          <div className="pp-community-petStrip" aria-label={t('community.yourPetsStrip')} role="list">
            {pets.map((p) => (
              <div key={p.id} className="pp-community-petStrip__item" role="listitem">
                <span className="pp-community-petStrip__avatar" aria-hidden>
                  {p.photoDataUrl ? (
                    <img src={p.photoDataUrl} alt="" className="pp-story-ring__photo" width={40} height={40} />
                  ) : (
                    getCategory(p).emoji
                  )}
                </span>
                <span className="pp-community-petStrip__label">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pp-col-12">
        <div className="pp-community-feedToolbar pp-card pp-pad" style={{ marginBottom: 12 }}>
          <div className="pp-label" id="community-feed-filter-label">
            {t('community.feedFilterLabel')}
          </div>
          <p className="pp-subtle pp-community-feedToolbar__hint" style={{ marginTop: 4, marginBottom: 10 }}>
            {t('community.feedFilterHint')}
          </p>
          <div className="pp-community-feedFilter" role="radiogroup" aria-labelledby="community-feed-filter-label">
            {[
              { v: 'all', key: 'feedFilterAll' },
              { v: 'community', key: 'feedFilterCommunity' },
              { v: 'lostPet', key: 'feedFilterLost' },
              { v: 'stray', key: 'feedFilterStray' },
            ].map(({ v, key }) => (
              <label key={v} className="pp-community-feedFilter__opt">
                <input
                  type="radio"
                  name="communityFeedFilter"
                  value={v}
                  checked={feedFilter === v}
                  onChange={() => setFeedFilter(v)}
                />
                <span>{t(`community.${key}`)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="pp-col-12 pp-community-feed">
        {filteredFeed.length === 0 ? (
          <p className="pp-subtle">{t('community.feedEmptyFiltered')}</p>
        ) : (
          filteredFeed.map((post) => {
            const pid = post.petIds?.[0];
            const tagged = pid ? pets.find((p) => p.id === pid) : null;
            return (
              <PostCard
                key={postKey(post)}
                post={post}
                taggedPet={tagged}
                authorLetter={post.isUser ? displayName.trim().charAt(0).toUpperCase() : undefined}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
