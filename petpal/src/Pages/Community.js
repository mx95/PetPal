import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useGame } from '../game/GameContext';
import { usePets } from '../pets/PetsContext';
import PetAvatar from '../components/PetAvatar';
import { useCommunity } from '../social/CommunityContext';
import { WalkPostEmbed } from '../social/walkPostEmbed';
import { communityPosts, storyRingUsers } from '../data/communityMock';
import { fileToSmallVideoDataUrl, MAX_COMMUNITY_VIDEO_BYTES } from '../social/communityVideo';
import { filesToResizedDataUrls } from '../walk/walkPhotos';

function postKey(post) {
  return post.id;
}

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function PostCard({ post }) {
  const names = post.petNames?.length ? post.petNames : post.petName ? [post.petName] : [];
  const emoji = post.petEmoji || '🐾';
  const bylinePets = names.length ? `with ${names.join(', ')}` : null;
  const isCompany = post.authorKind === 'company';
  const hasImages = post.imageUrls && post.imageUrls.length > 0;
  const hasVideo = Boolean(post.videoUrl);
  const hasWalk = Boolean(post.walkEmbed);

  return (
    <article
      className={`pp-post${post.boosted ? ' pp-post--boosted' : ''}`}
      data-user={post.isUser ? 'yes' : undefined}
    >
      {post.boosted ? (
        <div className="pp-post__boostBadge" role="status">
          Promoted{post.boostPaymentPending ? ' (payment pending)' : ''}
        </div>
      ) : null}
      <header className="pp-post__head">
        <div className="pp-post__avatar" aria-hidden>
          {emoji}
        </div>
        <div className="pp-post__meta">
          <div className="pp-post__title">
            <span className="pp-post__human">{post.author}</span>
            {isCompany ? (
              <>
                <span className="pp-post__dot">·</span>
                <span className="pp-post__pet">Business</span>
              </>
            ) : bylinePets ? (
              <>
                <span className="pp-post__dot">·</span>
                <span className="pp-post__pet">{bylinePets}</span>
              </>
            ) : null}
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
                  Map
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {hasImages ? (
        <div
          className={`pp-post__media pp-post__media--photos ${post.imageUrls.length > 1 ? 'pp-post__media--multi' : ''}`}
          role="img"
          aria-label={names[0] ? `Photos with ${names[0]}` : 'Post photos'}
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
            aria-label={names[0] ? `Video with ${names[0]}` : 'Post video'}
          />
        </div>
      ) : null}
      {hasWalk && (hasImages || hasVideo) ? (
        <div className="pp-post__walkBlock">
          <WalkPostEmbed walkEmbed={post.walkEmbed} compact />
        </div>
      ) : null}
      {hasWalk && !hasImages && !hasVideo ? (
        <div className="pp-post__media pp-post__media--walkOnly" role="img" aria-label="Latest walk">
          <WalkPostEmbed walkEmbed={post.walkEmbed} />
        </div>
      ) : null}
      {!hasImages && !hasVideo && !hasWalk ? (
        <div
          className="pp-post__media"
          style={{ background: post.imageTint }}
          role="img"
          aria-label={isCompany ? 'Business post' : names[0] ? `Photo for ${names[0]}` : 'Post'}
        >
          <span className="pp-post__mediaIcon" aria-hidden>
            {isCompany ? '🏢' : '🐾'}
          </span>
        </div>
      ) : null}

      <div className="pp-post__actions">
        <button type="button" className="pp-post__action">
          ♥ {post.likes}
        </button>
        <button type="button" className="pp-post__action">
          💬 {post.comments}
        </button>
        <button type="button" className="pp-post__action">
          ↗ Share
        </button>
      </div>

      {post.caption ? (
        <p className="pp-post__caption">
          {post.caption}
        </p>
      ) : null}
      {post.tags?.length ? (
        <div className="pp-post__tags">
          {post.tags.map((t) => (
            <span key={t} className="pp-tag">
              #{t}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Pet-first social feed: owner + one or more pets on each post.
 */
export default function Community() {
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
  const postPhotoInputId = useId();
  const postVideoInputId = useId();
  const postPhotoRef = useRef(null);
  const postVideoRef = useRef(null);
  const [postPhotoBusy, setPostPhotoBusy] = useState(false);
  const [postFilesCount, setPostFilesCount] = useState(0);
  const [postHasVideo, setPostHasVideo] = useState(false);

  const taggedIds = useMemo(
    () => Object.entries(picked).filter(([, on]) => on).map(([id]) => id),
    [picked]
  );

  useEffect(() => {
    if (postKind === 'business') {
      setIncludeWalk(false);
    }
    setPostFilesCount(0);
    setPostHasVideo(false);
    if (postPhotoRef.current) postPhotoRef.current.value = '';
    if (postVideoRef.current) postVideoRef.current.value = '';
  }, [postKind]);

  useEffect(() => {
    if (!includeWalk || !taggedIds.length) return;
    if (!walkForPetId || !taggedIds.includes(walkForPetId)) {
      setWalkForPetId(taggedIds[0]);
    }
  }, [includeWalk, taggedIds, walkForPetId]);

  const feed = useMemo(() => {
    const mock = communityPosts.map((m) => ({ ...m, isUser: false }));
    return [...userPosts, ...mock];
  }, [userPosts]);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'You';

  function togglePet(id) {
    setPicked((p) => ({ ...p, [id]: !p[id] }));
  }

  async function submitPost(e) {
    e.preventDefault();
    const businessMode = isApprovedCompany && postKind === 'business' && companyProfile;
    const ids = Object.entries(picked)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (!businessMode && !ids.length) return;
    const text = caption.trim();
    const videoFile = postVideoRef.current?.files?.[0];
    const files = postPhotoRef.current?.files;
    let imageUrls;
    let videoDataUrl;
    if (videoFile || (files && files.length)) {
      setPostPhotoBusy(true);
      try {
        if (videoFile) {
          videoDataUrl = await fileToSmallVideoDataUrl(videoFile);
        }
        if (files && files.length) {
          const maxPh = videoDataUrl ? 3 : 4;
          const arr = Array.from(files).slice(0, maxPh);
          imageUrls = await filesToResizedDataUrls(arr);
        }
      } catch (err) {
        window.alert(err?.message || 'Could not add your media. Try a smaller file.');
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
    setPostFilesCount(0);
    setPostHasVideo(false);
    setBoostBusinessPost(false);
    if (postPhotoRef.current) postPhotoRef.current.value = '';
    if (postVideoRef.current) postVideoRef.current.value = '';
  }

  const hasPick = Object.values(picked).some(Boolean);
  const businessReady = isApprovedCompany && postKind === 'business' && companyProfile;
  const businessCanShare = Boolean(
    businessReady && (Boolean(caption.trim()) || postFilesCount > 0 || postHasVideo)
  );
  const petCanShare =
    hasPick &&
    (Boolean(caption.trim()) ||
      postFilesCount > 0 ||
      postHasVideo ||
      (includeWalk && latestWalk && Number(latestWalk.km) > 0));
  const canShare =
    businessCanShare || ((!isApprovedCompany || postKind === 'pets') && petCanShare);
  const maxVideoLabelMb = (MAX_COMMUNITY_VIDEO_BYTES / (1024 * 1024)).toFixed(1);

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge">Community</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              Sniff &amp; Share
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 560 }}>
              Post as <strong>{displayName}</strong>, tag pet(s), add photos or a short video, and optionally attach a
              walk card.
              {isApprovedCompany ? (
                <>
                  {' '}
                  <strong>Approved businesses</strong> can switch to a business post, link their verified map pin, and
                  mark <em>paid boost</em> (payment integration can be added later; boosted posts are highlighted for
                  now).
                </>
              ) : null}{' '}
              (Feed is stored on this device for now; company verification uses Firestore.)
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>
      </div>

      {pets.length > 0 || isApprovedCompany ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad">
            <h2 className="pp-sectionTitle">New post</h2>
            {isApprovedCompany && companyProfile ? (
              <div style={{ marginBottom: 12 }}>
                <div className="pp-label" style={{ marginBottom: 6 }}>
                  Post as
                </div>
                <div className="pp-community-walkStyle" role="group" aria-label="Post type">
                  <label>
                    <input
                      type="radio"
                      name="postKind"
                      checked={postKind === 'pets'}
                      onChange={() => setPostKind('pets')}
                    />
                    Pet moment
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="postKind"
                      checked={postKind === 'business'}
                      onChange={() => setPostKind('business')}
                    />
                    Business
                  </label>
                </div>
                {postKind === 'business' ? (
                  <p className="pp-subtle" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                    Map pin: <strong>{companyProfile.businessName}</strong> (verified in{' '}
                    <Link to="/company/apply" className="pp-link" style={{ display: 'inline', padding: 0 }}>
                      business settings
                    </Link>
                    ).
                  </p>
                ) : null}
              </div>
            ) : null}
            {isApprovedCompany && postKind === 'pets' && !pets.length ? (
              <p className="pp-subtle" style={{ marginBottom: 12 }}>
                Add pets under <Link to="/pets">My pets</Link> to use pet moment posts, or switch to a business post.
              </p>
            ) : null}
            {postKind === 'business' && isApprovedCompany ? (
              <form className="pp-form" onSubmit={submitPost} style={{ gap: 12 }}>
                <div>
                  <div className="pp-label">What&apos;s the update?</div>
                  <textarea
                    className="pp-input"
                    style={{ minHeight: 88, resize: 'vertical' }}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="e.g. This weekend: microchipping clinic, first hour free for members…"
                  />
                </div>
                <div>
                  <div className="pp-label">Photos (optional, up to 4)</div>
                  <input
                    id={postPhotoInputId}
                    ref={postPhotoRef}
                    className="pp-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={() => setPostFilesCount(postPhotoRef.current?.files?.length || 0)}
                    style={{ fontSize: 14 }}
                  />
                </div>
                <div>
                  <div className="pp-label">Short video (optional, one clip, max ~{maxVideoLabelMb} MB)</div>
                  <input
                    id={postVideoInputId}
                    ref={postVideoRef}
                    className="pp-input"
                    type="file"
                    accept="video/*"
                    onChange={() => setPostHasVideo(!!postVideoRef.current?.files?.[0])}
                    style={{ fontSize: 14 }}
                  />
                </div>
                <div>
                  <label className="pp-community-walkInclude">
                    <input
                      type="checkbox"
                      checked={boostBusinessPost}
                      onChange={(e) => setBoostBusinessPost(e.target.checked)}
                    />
                    <span>Paid boost (request)</span>
                  </label>
                  <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                    Highlights this post in the feed. In-app payment can be connected later; we mark the post as promoted
                    and &quot;payment pending&quot; until you confirm with the business.
                  </p>
                </div>
                <div>
                  <button type="submit" className="pp-btn pp-btnPrimary" disabled={!canShare || postPhotoBusy}>
                    {postPhotoBusy ? 'Processing…' : 'Share to feed'}
                  </button>
                </div>
              </form>
            ) : (
              <form className="pp-form" onSubmit={submitPost} style={{ gap: 12 }}>
                <div>
                  <div className="pp-label">What&apos;s the moment?</div>
                  <textarea
                    className="pp-input"
                    style={{ minHeight: 88, resize: 'vertical' }}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="e.g. Best sniff session at the new park…"
                  />
                </div>
                <div>
                  <div className="pp-label">Photos (optional, up to 4, or 3 if you add a video)</div>
                  <input
                    id={postPhotoInputId}
                    ref={postPhotoRef}
                    className="pp-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={() => setPostFilesCount(postPhotoRef.current?.files?.length || 0)}
                    style={{ fontSize: 14 }}
                  />
                  <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                    {postFilesCount > 0
                      ? `${postFilesCount} image(s) selected — will be resized for storage.`
                      : 'Add a caption, photos, a short video, or include your latest walk below.'}
                  </p>
                </div>
                <div>
                  <div className="pp-label">Short video (optional, one clip, max ~{maxVideoLabelMb} MB)</div>
                  <input
                    id={postVideoInputId}
                    ref={postVideoRef}
                    className="pp-input"
                    type="file"
                    accept="video/*"
                    onChange={() => setPostHasVideo(!!postVideoRef.current?.files?.[0])}
                    style={{ fontSize: 14 }}
                  />
                </div>
                {pets.length > 0 ? (
                  <div>
                    <div className="pp-label">Tag pet(s) on this post</div>
                    <div className="pp-community-pickPets" role="group" aria-label="Pets in post">
                      {pets.map((p) => (
                        <label key={p.id} className="pp-community-petChip">
                          <input
                            type="checkbox"
                            checked={!!picked[p.id]}
                            onChange={() => togglePet(p.id)}
                          />
                          <span className="pp-community-petChip__inner">
                            <PetAvatar pet={p} size={28} className="pp-community-petChip__avatar" />
                            {p.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
                {pets.length > 0 ? (
                  <div>
                    <div className="pp-label">Latest walk (optional)</div>
                    <label className="pp-community-walkInclude">
                      <input
                        type="checkbox"
                        checked={includeWalk}
                        disabled={!latestWalk || Number(latestWalk.km) <= 0}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setIncludeWalk(on);
                          if (on && taggedIds.length) setWalkForPetId(taggedIds[0]);
                        }}
                      />
                      <span>Include latest logged walk</span>
                    </label>
                    {!latestWalk || Number(latestWalk.km) <= 0 ? (
                      <p className="pp-subtle" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
                        Log a walk on the Dashboard first to attach it here.
                      </p>
                    ) : (
                      <div className="pp-community-walkOpts" style={{ marginTop: 10 }}>
                        <div className="pp-label" style={{ fontSize: 12, marginBottom: 6 }}>
                          Show as
                        </div>
                        <div className="pp-community-walkStyle" role="group" aria-label="Walk display style">
                          <label>
                            <input
                              type="radio"
                              name="walkStyle"
                              checked={walkStyle === 'map'}
                              disabled={!includeWalk}
                              onChange={() => setWalkStyle('map')}
                            />
                            Map-style route
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="walkStyle"
                              checked={walkStyle === 'bar'}
                              disabled={!includeWalk}
                              onChange={() => setWalkStyle('bar')}
                            />
                            Distance bar
                          </label>
                        </div>
                        {includeWalk && taggedIds.length > 0 ? (
                          <div style={{ marginTop: 10 }}>
                            <label className="pp-label" style={{ fontSize: 12 }} htmlFor="walk-for-pet">
                              Label walk for
                            </label>
                            <select
                              id="walk-for-pet"
                              className="pp-input"
                              style={{ marginTop: 4, maxWidth: 280, fontSize: 14 }}
                              value={walkForPetId}
                              onChange={(e) => setWalkForPetId(e.target.value)}
                            >
                              {taggedIds.map((id) => {
                                const p = pets.find((x) => x.id === id);
                                if (!p) return null;
                                return (
                                  <option key={id} value={id}>
                                    {getCategory(p).emoji} {p.name}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        ) : includeWalk ? (
                          <p className="pp-subtle" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                            Tag at least one pet to label the walk card.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
                <div>
                  <button type="submit" className="pp-btn pp-btnPrimary" disabled={!canShare || postPhotoBusy}>
                    {postPhotoBusy ? 'Processing…' : 'Share to feed'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="pp-col-12">
          <p className="pp-subtle">
            Add pets under{' '}
            <Link className="pp-link" to="/pets" style={{ padding: 0, display: 'inline' }}>
              My pets
            </Link>{' '}
            to post, or{' '}
            <Link className="pp-link" to="/register" style={{ padding: 0, display: 'inline' }}>
              register as a business
            </Link>{' '}
            to apply for a map listing and promoted posts.
          </p>
        </div>
      )}

      <div className="pp-col-12">
        <div className="pp-community-stories" aria-label="Stories">
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              className="pp-story-ring pp-story-ring--you"
              style={{ '--ring': '#5b37ff' }}
            >
              <span className="pp-story-ring__inner" aria-hidden>
                {p.photoDataUrl ? (
                  <img src={p.photoDataUrl} alt="" className="pp-story-ring__photo" width={40} height={40} />
                ) : (
                  getCategory(p).emoji
                )}
              </span>
              <span className="pp-story-ring__label">{p.name}</span>
            </button>
          ))}
          {storyRingUsers.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`pp-story-ring ${s.isYou ? 'pp-story-ring--you' : ''}`}
              style={{ '--ring': s.accent }}
            >
              <span className="pp-story-ring__inner" aria-hidden>
                {s.isYou ? 'You' : s.label[0]}
              </span>
              <span className="pp-story-ring__label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pp-col-12 pp-community-feed">
        {feed.map((post) => (
          <PostCard key={postKey(post)} post={post} />
        ))}
      </div>
    </div>
  );
}
