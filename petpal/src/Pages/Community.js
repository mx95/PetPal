import React from 'react';
import { Link } from 'react-router-dom';
import { communityPosts, storyRingUsers } from '../data/communityMock';

/**
 * Pet-first social feed: familiar “stories + scroll” rhythm, but centered on
 * pets and walks (not generic photo grid).
 */
export default function Community() {
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
              A feed built for pets and the people who walk them — moments, walks, and wins. (Demo
              posts; connect Firestore later.)
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-community-stories" aria-label="Stories">
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
        {communityPosts.map((post) => (
          <article key={post.id} className="pp-post">
            <header className="pp-post__head">
              <div className="pp-post__avatar" aria-hidden>
                {post.petEmoji}
              </div>
              <div className="pp-post__meta">
                <div className="pp-post__title">
                  <span className="pp-post__pet">{post.petName}</span>
                  <span className="pp-post__dot">·</span>
                  <span className="pp-post__human">{post.author}</span>
                </div>
                <div className="pp-post__time">{post.timeLabel}</div>
              </div>
            </header>

            <div
              className="pp-post__media"
              style={{ background: post.imageTint }}
              role="img"
              aria-label={`Photo place for ${post.petName}`}
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
              <strong>{post.petName}</strong> {post.caption}
            </p>
            <div className="pp-post__tags">
              {post.tags.map((t) => (
                <span key={t} className="pp-tag">
                  #{t}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
