import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';

const TRACKER = `${process.env.PUBLIC_URL || ''}/images/shop/gps-tracker-v4.png`;
const HERO = `${process.env.PUBLIC_URL || ''}/images/home-hero.jpg`;

/** Dev-only static preview of the My Pets / Edit / Public redesign (no auth). */
export default function DevPetsUxPreview() {
  const [pane, setPane] = useState('list');
  if (process.env.NODE_ENV === 'production') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="pp-grid" style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 40 }}>
      <div className="pp-col-12" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {[
          ['list', 'My Pets'],
          ['add', 'Add'],
          ['edit', 'Edit hub'],
          ['gps', 'GPS'],
          ['public', 'Public'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`pp-btn ${pane === id ? 'pp-btnPrimary' : ''}`}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {pane === 'list' ? (
        <div className="pp-col-12">
          <h1 className="pp-h1 pp-myPetsHeader__title">My pets</h1>
          <p className="pp-myPetsHeader__sub">Your pack, all in one place.</p>
          <button type="button" className="pp-btn pp-btnPrimary pp-myPetsAddWide">+ Add a pet</button>
          <ul className="pp-petList" style={{ marginTop: 14 }}>
            <li className="pp-petList__item pp-petCardFriendly">
              <div className="pp-petCardFriendly__top">
                <img className="pp-petAvatar" src={HERO} alt="" width={64} height={64} style={{ width: 64, height: 64, objectPosition: '30% 40%' }} />
                <div>
                  <div className="pp-petList__name">Odin <span className="pp-petGender is-m">♂</span></div>
                  <div className="pp-petList__meta">Jack Russell · 4 years old</div>
                  <div className="pp-petList__tags">
                    <span className="pp-petTag pp-petTag--soft is-on">GPS linked</span>
                    <span className="pp-petTag pp-petTag--soft is-profile">Profile active</span>
                  </div>
                </div>
              </div>
              <div className="pp-petCardFriendly__actions">
                <button type="button" className="pp-btn pp-btnOutline pp-petCardFriendly__manage">Manage</button>
                <button type="button" className="pp-btn pp-petCardFriendly__more" aria-label="More">⋯</button>
              </div>
            </li>
          </ul>
        </div>
      ) : null}

      {pane === 'add' ? (
        <div className="pp-modalCard pp-modalCard--petAdd pp-pad">
          <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>Add a pet</h2>
          <p className="pp-subtle">Start with the basics — you can link GPS later.</p>
          <div className="pp-speciesGrid">
            <button type="button" className="pp-speciesChip is-on"><span>🐕</span>Dog</button>
            <button type="button" className="pp-speciesChip"><span>🐈</span>Cat</button>
            <button type="button" className="pp-speciesChip"><span>🐰</span>Rabbit</button>
            <button type="button" className="pp-speciesChip"><span>🐾</span>Other</button>
          </div>
          <div className="pp-photoDrop">
            <span className="pp-photoDrop__ico">📷</span>
            <strong>Add a photo</strong>
            <span>Optional — helps if someone finds them</span>
          </div>
          <div className="pp-label">Name *</div>
          <input className="pp-input" placeholder="e.g. Odin" readOnly />
          <div className="pp-label" style={{ marginTop: 10 }}>Breed *</div>
          <input className="pp-input" placeholder="e.g. Jack Russell" readOnly />
          <p className="pp-subtle" style={{ fontSize: 12 }}>Tracker IMEI is set later under GPS — keeps this screen light.</p>
          <button type="button" className="pp-btn pp-btnPrimary" style={{ width: '100%', marginTop: 12 }}>Add to my pack</button>
        </div>
      ) : null}

      {pane === 'edit' ? (
        <div className="pp-modalCard pp-modalCard--petEdit pp-pad">
          <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>Edit Odin</h2>
          <p className="pp-subtle">Manage pet details and devices.</p>
          <div className="pp-editHubStrip">
            <img className="pp-petAvatar" src={HERO} alt="" width={72} height={72} style={{ width: 72, height: 72, objectPosition: '30% 40%' }} />
            <div>
              <div className="pp-petList__name">Odin <span className="pp-petGender is-m">♂</span></div>
              <div className="pp-petList__meta">Jack Russell · 4 years old</div>
              <span className="pp-btnGhostSm">Change photo</span>
            </div>
          </div>
          <div className="pp-editNavList">
            <div className="pp-editNavItem"><span className="pp-editNavIco is-purple">📄</span><span><strong>Basic details</strong><small>Name, breed, gender, birthday and colour</small></span><span className="pp-editNavChev">›</span></div>
            <div className="pp-editNavItem"><span className="pp-editNavIco is-green">📍</span><span><strong>GPS tracker <span className="pp-petTag pp-petTag--soft is-on">Linked</span></strong><small>Link or change your tracker</small></span><span className="pp-editNavChev">›</span></div>
            <div className="pp-editNavItem"><span className="pp-editNavIco is-blue">🐾</span><span><strong>Public profile <span className="pp-petTag pp-petTag--soft is-profile">Active</span></strong><small>View and share — works even without an NFC tag</small></span><span className="pp-editNavChev">›</span></div>
            <div className="pp-editNavItem"><span className="pp-editNavIco is-pink">♥</span><span><strong>More about Odin</strong><small>Description, marks and social preferences</small></span><span className="pp-editNavChev">›</span></div>
          </div>
          <button type="button" className="pp-btn pp-btnPrimary" style={{ width: '100%', marginTop: 16 }}>Save changes</button>
        </div>
      ) : null}

      {pane === 'gps' ? (
        <div className="pp-modalCard pp-pad">
          <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>GPS Tracker</h2>
          <label className="pp-shopTrackerOpt pp-gpsLiveToggle">
            <span className="pp-editNavIco is-green">📍</span>
            <span className="pp-shopTrackerOpt__copy">
              <strong>Show on Live map</strong>
              <small>When enabled, Odin will appear on the Live map with a linked tracker.</small>
            </span>
            <span className="pp-shopTrackerOpt__meta"><span className="pp-shopTrackerOpt__switch" aria-hidden /></span>
          </label>
          <div className="pp-gpsLinkedCard">
            <div className="pp-gpsLinkedCard__row">
              <img className="pp-gpsLinkedCard__img" src={TRACKER} alt="" />
              <div>
                <span className="pp-petTag pp-petTag--soft is-on">Tracker linked</span>
                <p className="pp-petList__meta" style={{ marginTop: 8 }}>IMEI: 8680220306666528</p>
              </div>
            </div>
            <div className="pp-gpsLinkedCard__actions">
              <button type="button" className="pp-btn pp-btnOutline">Change tracker</button>
              <button type="button" className="pp-btn pp-btnDangerOutline">Unlink</button>
            </div>
          </div>
          <div className="pp-helpBar"><span className="pp-editNavIco is-blue">i</span>Where to find the IMEI?<span className="pp-editNavChev">›</span></div>
        </div>
      ) : null}

      {pane === 'public' ? (
        <article className="pp-publicPet__sheet">
          <div className="pp-publicPet__banner">
            <img className="pp-publicPet__bannerImg" src={HERO} alt="" />
          </div>
          <div className="pp-publicPet__sheetBody">
            <header className="pp-publicPet__identity">
              <img className="pp-publicPet__avatar" src={HERO} alt="Odin" style={{ objectPosition: '30% 40%' }} />
              <div className="pp-publicPet__identityText">
                <h1>Odin <span className="pp-publicPet__gender is-m">♂</span></h1>
                <p className="pp-publicPet__metaLine">Jack Russell · 4 years old · White &amp; brown</p>
              </div>
            </header>
            <div className="pp-publicPet__foundNote" role="note">
              <span>⚠</span>
              <div>
                <strong>Found this pet?</strong>
                <span> Please contact the owner — keep them calm and stay nearby if you can.</span>
              </div>
            </div>
            <div className="pp-publicPet__contactBar">
              <button type="button" className="pp-btn pp-btnPrimary pp-publicPet__contactMain">Contact owner</button>
              <span className="pp-publicPet__iconBtn">☎</span>
              <span className="pp-publicPet__iconBtn">💬</span>
              <span className="pp-publicPet__iconBtn">✉</span>
            </div>
            <section className="pp-publicPet__section">
              <h2>About me</h2>
              <p className="pp-publicPet__about">Friendly, active and loves to play!</p>
            </section>
            <section className="pp-publicPet__section">
              <h2>Friendly with</h2>
              <div className="pp-publicPet__friendlyRow">
                <span className="pp-publicPet__friendlyChip is-yes">Dogs</span>
                <span className="pp-publicPet__friendlyChip is-yes">People</span>
                <span className="pp-publicPet__friendlyChip is-yes">Children</span>
              </div>
            </section>
            <section className="pp-publicPet__section">
              <h2>Details</h2>
              <dl className="pp-publicPet__kv">
                <div className="pp-publicPet__kvRow"><dt>Breed</dt><dd>Jack Russell</dd></div>
                <div className="pp-publicPet__kvRow"><dt>Colour</dt><dd>White &amp; brown</dd></div>
              </dl>
            </section>
          </div>
        </article>
      ) : null}
    </div>
  );
}
