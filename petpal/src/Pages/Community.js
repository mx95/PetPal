import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useGame } from '../game/GameContext';
import { usePets } from '../pets/PetsContext';
import { useCommunity } from '../social/CommunityContext';
import { WalkPostEmbed } from '../social/walkPostEmbed';
import { communityPosts, storyRingUsers } from '../data/communityMock';
import { filesToResizedDataUrls } from '../walk/walkPhotos';

function postKey(post) {
  return post.id;
}

function PostCard({ post }) {
  const names = post.petNames?.length ? post.petNames : post.petName ? [post.petName] : [];
  const emoji = post.petEmoji || '🐾';
  const bylinePets = names.length ? `with ${names.join(', ')}` : null;

  return (
    <article className="pp-post" data-user={post.isUser ? 'yes' : undefined}>
      <header className="pp-post__head">
        <div className="pp-post__avatar" aria-hidden>
          {emoji}
        </div>
        <div className="pp-post__meta">
          <div className="pp-post__title">
            <span className="pp-post__human">{post.author}</span>
            {bylinePets ? (
              <>
                <span className="pp-post__dot">·</span>
                <span className="pp-post__pet">{bylinePets}</span>
              </>
            ) : null}
          </div>
          <div className="pp-post__time">{post.timeLabel}</div>
        </div>
      </header>

      {post.imageUrls && post.imageUrls.length > 0 ? (
        <>
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
          {post.walkEmbed ? (
            <div className="pp-post__walkBlock">
              <WalkPostEmbed walkEmbed={post.walkEmbed} compact />
            </div>
          ) : null}
        </>
      ) : post.walkEmbed ? (
        <div className="pp-post__media pp-post__media--walkOnly" role="img" aria-label="Latest walk">
          <WalkPostEmbed walkEmbed={post.walkEmbed} />
        </div>
      ) : (
        <div
          className="pp-post__media"
          style={{ background: post.imageTint }}
          role="img"
          aria-label={names[0] ? `Photo for ${names[0]}` : 'Post'}
        >
          <span className="pp-post__mediaIcon" aria-hidden>
            🐾
          </span>
        </div>
      )}

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
  const { pets, getCategory } = usePets();
  const { latestWalk } = useGame();
  const { userPosts, addUserPost } = useCommunity();
  const [caption, setCaption] = useState('');
  const [picked, setPicked] = useState(() => ({}));
  const [includeWalk, setIncludeWalk] = useState(false);
  const [walkStyle, setWalkStyle] = useState('map');
  const [walkForPetId, setWalkForPetId] = useState('');
  const postPhotoInputId = useId();
  const postPhotoRef = useRef(null);
  const [postPhotoBusy, setPostPhotoBusy] = useState(false);
  const [postFilesCount, setPostFilesCount] = useState(0);

  const taggedIds = useMemo(
    () => Object.entries(picked).filter(([, on]) => on).map(([id]) => id),
    [picked]
  );

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
    const ids = Object.entries(picked)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (!ids.length) return;
    const text = caption.trim();
    const files = postPhotoRef.current?.files;
    let imageUrls;
    if (files && files.length) {
      setPostPhotoBusy(true);
      try {
        const arr = Array.from(files).slice(0, 4);
        imageUrls = await filesToResizedDataUrls(arr);
      } finally {
        setPostPhotoBusy(false);
      }
    }
    const walkPet = pets.find((p) => p.id === walkForPetId);
    const walkEmbed =
      includeWalk && latestWalk && Number(latestWalk.km) > 0
        ? {
            style: walkStyle === 'bar' ? 'bar' : 'map',
            km: latestWalk.km,
            createdAt: latestWalk.createdAt,
            petName: walkPet?.name,
          }
        : undefined;
    if (!text && (!imageUrls || imageUrls.length === 0) && !walkEmbed) return;
    addUserPost(caption, ids, imageUrls, walkEmbed);
    setCaption('');
    setPicked({});
    setIncludeWalk(false);
    setWalkStyle('map');
    setWalkForPetId('');
    setPostFilesCount(0);
    if (postPhotoRef.current) postPhotoRef.current.value = '';
  }

  const hasPick = Object.values(picked).some(Boolean);
  const canShare =
    hasPick &&
    (Boolean(caption.trim()) || postFilesCount > 0 || (includeWalk && latestWalk && Number(latestWalk.km) > 0));

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge">Community</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              Sniff &amp; Share
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 520 }}>
              Post as <strong>{displayName}</strong>, tag pet(s), add up to four photos, and optionally attach your
              latest logged walk as a map graphic or distance bar. You need a caption, photo(s), or a walk card. (Stored
              on this device for now; Firestore can sync later.)
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>
      </div>

      {pets.length > 0 ? (
        <div className="pp-col-12">
          <div className="pp-card pp-pad">
            <h2 className="pp-sectionTitle">New post</h2>
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
                <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                  {postFilesCount > 0
                    ? `${postFilesCount} image(s) selected — will be resized for storage.`
                    : 'Add a caption, photos, or include your latest walk below.'}
                </p>
              </div>
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
                      <span>
                        {getCategory(p).emoji} {p.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
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
              <div>
                <button type="submit" className="pp-btn pp-btnPrimary" disabled={!canShare || postPhotoBusy}>
                  {postPhotoBusy ? 'Processing…' : 'Share to feed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="pp-col-12">
          <p className="pp-subtle">
            Add pets under{' '}
            <Link className="pp-link" to="/pets" style={{ padding: 0, display: 'inline' }}>
              My pets
            </Link>{' '}
            to post with their names.
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
                {getCategory(p).emoji}
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
