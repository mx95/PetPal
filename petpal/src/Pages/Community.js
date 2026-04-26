import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { usePets } from '../pets/PetsContext';
import { useCommunity } from '../social/CommunityContext';
import { communityPosts, storyRingUsers } from '../data/communityMock';

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

      <p className="pp-post__caption">
        {post.caption}
      </p>
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
  const { userPosts, addUserPost } = useCommunity();
  const [caption, setCaption] = useState('');
  const [picked, setPicked] = useState(() => ({}));

  const feed = useMemo(() => {
    const mock = communityPosts.map((m) => ({ ...m, isUser: false }));
    return [...userPosts, ...mock];
  }, [userPosts]);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'You';

  function togglePet(id) {
    setPicked((p) => ({ ...p, [id]: !p[id] }));
  }

  function submitPost(e) {
    e.preventDefault();
    const ids = Object.entries(picked)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (!caption.trim() || !ids.length) return;
    addUserPost(caption, ids);
    setCaption('');
    setPicked({});
  }

  const hasPick = Object.values(picked).some(Boolean);

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
              Post as <strong>{displayName}</strong> and pick which pet(s) show on the line — one or
              more. (Posts stored on this device for now; Firestore can sync later.)
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
                <button type="submit" className="pp-btn pp-btnPrimary" disabled={!caption.trim() || !hasPick}>
                  Share to feed
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
