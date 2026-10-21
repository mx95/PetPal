import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';

const TRACKER = `${process.env.PUBLIC_URL || ''}/images/shop/gps-tracker-v4.png`;
const HERO = `${process.env.PUBLIC_URL || ''}/images/home-hero.jpg`;

function IconGreenTick({ size = 28, soft = false }) {
  if (soft) {
    return (
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#d1fadf" />
        <path d="M10.5 16.2l3.2 3.2 7.8-7.8" fill="none" stroke="#039855" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#12b76a" />
      <path d="M10.5 16.2l3.2 3.2 7.8-7.8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Dev-only static preview of the redesign CSS (production redirects home). */
export default function DevPetsUxPreview() {
  const [pane, setPane] = useState('list');
  const [addMoreOpen, setAddMoreOpen] = useState(true);
  if (process.env.NODE_ENV === 'production') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="pp-devPetsUx" style={{ maxWidth: 420, margin: '0 auto', padding: '12px 12px 48px', width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {[
          ['list', 'My Pets'],
          ['add', 'Add'],
          ['edit', 'Edit'],
          ['gps', 'GPS'],
          ['gpsEmpty', 'GPS empty'],
          ['nfc', 'NFC'],
          ['public', 'Public'],
          ['success', 'Added'],
          ['profileHub', 'Profile'],
          ['profileContact', 'Contact'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`pp-btn ${pane === id ? 'pp-btnPrimary' : ''}`}
            style={{ minHeight: 34, fontSize: 12, padding: '0 10px' }}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {pane === 'list' ? (
        <div>
          <h1 className="pp-h1 pp-myPetsHeader__title">My pets</h1>
          <p className="pp-myPetsHeader__sub">Your pack, all in one place.</p>
          <div className="pp-myPetsToolbar">
            <div className="pp-petSearchBox pp-myPetsToolbar__search">
              <span aria-hidden>⌕</span>
              <input className="pp-input pp-myPetsToolbar__searchInput" placeholder="Search pets…" readOnly />
            </div>
            <button type="button" className="pp-btn" style={{ width: 46, minHeight: 46, padding: 0 }} aria-label="Filter">☰</button>
          </div>
          <button type="button" className="pp-btn pp-btnPrimary pp-myPetsAddWide">+ Add a pet</button>
          <ul className="pp-petList" style={{ marginTop: 14 }}>
            <li className="pp-petList__item pp-petCardFriendly">
              <div className="pp-petCardFriendly__top">
                <img className="pp-petAvatar" src={HERO} alt="" width={64} height={64} style={{ width: 64, height: 64, objectPosition: '28% 42%' }} />
                <div className="pp-petCardFriendly__main">
                  <div className="pp-petList__name">Odin <span className="pp-petGender is-m">♂</span></div>
                  <div className="pp-petList__meta">Jack Russell · 4 years old</div>
                  <div className="pp-petList__tags">
                    <span className="pp-petTag pp-petTag--soft is-on">GPS linked</span>
                    <span className="pp-petTag pp-petTag--soft is-profile">Profile active</span>
                  </div>
                </div>
                <span className="pp-petCardFriendly__chev">›</span>
              </div>
              <button type="button" className="pp-btn pp-petCardFriendly__publicBtn">👁 View public profile</button>
              <div className="pp-petCardFriendly__actions">
                <button type="button" className="pp-btn pp-btnOutline pp-petCardFriendly__manage">Manage</button>
                <button type="button" className="pp-btn pp-petCardFriendly__more">⋯</button>
              </div>
              <div className="pp-petCardFriendly__quick">
                <button type="button" className="pp-btn pp-petCardFriendly__quickBtn"><span aria-hidden>💊</span><span>Medication schedule</span></button>
                <button type="button" className="pp-btn pp-petCardFriendly__quickBtn"><span aria-hidden>↗</span><span>Share with family</span></button>
              </div>
            </li>
          </ul>
        </div>
      ) : null}

      {pane === 'add' ? (
        <div className="pp-modalCard pp-modalCard--petAdd pp-pad">
          <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>Add a pet</h2>
          <p className="pp-subtle">Start with the basics — you can link GPS later.</p>
          <div className="pp-speciesCarousel">
            {[
              ['🐕', 'Dog', true],
              ['🐈', 'Cat'],
              ['🐰', 'Rabbit'],
              ['🐦', 'Bird'],
              ['🐴', 'Horse'],
              ['🦎', 'Reptile'],
              ['🐠', 'Fish'],
              ['🐹', 'Small'],
              ['🐾', 'Other'],
            ].map(([emoji, label, on]) => (
              <button key={label} type="button" className={`pp-speciesChip${on ? ' is-on' : ''}`}>
                <span className="pp-speciesChip__ico">{emoji}</span>
                <span className="pp-speciesChip__label">{label}</span>
              </button>
            ))}
          </div>
          <div className="pp-photoDrop pp-photoDrop--compact">
            <span className="pp-photoDrop__ico">📷</span>
            <strong>Add a photo</strong>
            <span>Optional — helps if someone finds them</span>
          </div>
          <div className="pp-label">Name *</div>
          <input className="pp-input" placeholder="e.g. Odin" readOnly />
          <div className="pp-label" style={{ marginTop: 10 }}>Breed *</div>
          <input className="pp-input" placeholder="e.g. Jack Russell" readOnly />
          <div className="pp-label" style={{ marginTop: 10 }}>Gender</div>
          <div className="pp-genderSeg">
            <button type="button" className="pp-genderSeg__btn is-on">Male</button>
            <button type="button" className="pp-genderSeg__btn">Female</button>
          </div>
          <div className="pp-label" style={{ marginTop: 10 }}>Date of birth *</div>
          <label className="pp-dateField">
            <span className="pp-dateField__ico" aria-hidden>📅</span>
            <input className="pp-input pp-dateField__input" type="date" defaultValue="2021-06-12" readOnly />
          </label>
          <div className="pp-label" style={{ marginTop: 10 }}>Colour *</div>
          <input className="pp-input" placeholder="e.g. White & brown" readOnly />
          <button
            type="button"
            className={`pp-addMoreToggle ${addMoreOpen ? 'is-open' : ''}`}
            onClick={() => setAddMoreOpen((v) => !v)}
          >
            <span>More details (optional)</span>
            <span aria-hidden>{addMoreOpen ? '▴' : '▾'}</span>
          </button>
          {addMoreOpen ? (
            <div className="pp-addMorePanel">
              <div className="pp-label">Identifying marks</div>
              <input className="pp-input" placeholder="e.g. White patch on chest" readOnly />
              <div className="pp-label">Friendly with</div>
              <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="pp-chipCheck"><span>Dogs</span></span>
                <span className="pp-chipCheck"><span>People</span></span>
                <span className="pp-chipCheck"><span>Children</span></span>
              </div>
              <div className="pp-label">About / notes</div>
              <textarea className="pp-input" style={{ minHeight: 70 }} placeholder="Temperament…" readOnly />
              <div className="pp-label">Veterinarian</div>
              <input className="pp-input" placeholder="e.g. Dr. Alex / Sunny Vet Clinic" readOnly />
              <div className="pp-label">Owner phone</div>
              <input className="pp-input" placeholder="+357…" readOnly />
              <div className="pp-label">Owner email</div>
              <input className="pp-input" placeholder="you@email.com" readOnly />
            </div>
          ) : null}
          <p className="pp-subtle" style={{ fontSize: 12 }}>Tracker IMEI is set later under GPS.</p>
          <button type="button" className="pp-btn pp-btnPrimary" style={{ width: '100%', marginTop: 12 }}>Add to my pack</button>
        </div>
      ) : null}

      {pane === 'edit' ? (
        <div className="pp-modalCard pp-modalCard--petEdit pp-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="pp-iconRoundBtn">‹</button>
            <button type="button" className="pp-iconRoundBtn">✕</button>
          </div>
          <h2 className="pp-sectionTitle" style={{ marginTop: 8 }}>Edit Odin</h2>
          <p className="pp-subtle">Manage pet details and devices.</p>
          <div className="pp-editHubStrip">
            <img className="pp-petAvatar" src={HERO} alt="" width={72} height={72} style={{ width: 72, height: 72, objectPosition: '28% 42%' }} />
            <div>
              <div className="pp-petList__name">Odin <span className="pp-petGender is-m">♂</span></div>
              <div className="pp-petList__meta">Jack Russell · 4 years old</div>
              <span className="pp-btnGhostSm">Change photo</span>
            </div>
          </div>
          <div className="pp-editNavList">
            <div className="pp-editNavItem"><span className="pp-editNavIco is-purple">📄</span><span><strong>Basic details</strong><small>Name, breed, gender, date of birth and color.</small></span><span className="pp-editNavChev">›</span></div>
            <div className="pp-editNavItem"><span className="pp-editNavIco is-green">📍</span><span><strong>GPS tracker <span className="pp-petTag pp-petTag--soft is-on">Linked</span></strong><small>Link or change your tracker.</small></span><span className="pp-editNavChev">›</span></div>
            <div className="pp-editNavItem"><span className="pp-editNavIco is-blue">🐾</span><span><strong>Public profile <span className="pp-petTag pp-petTag--soft is-on">Active</span></strong><small>View and share Odin’s profile. Works even without an NFC tag.</small></span><span className="pp-editNavChev">›</span></div>
            <div className="pp-editNavItem"><span className="pp-editNavIco is-orange" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 4h8a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" />
                <path d="M9 9h6M9 13h6" />
              </svg>
            </span><span><strong>More about Odin</strong><small>Description, marks and social preferences.</small></span><span className="pp-editNavChev">›</span></div>
            <div className="pp-editNavItem"><span className="pp-editNavIco is-green">💊</span><span><strong>Medication schedule</strong><small>Doses, times, and notes for this pet</small></span><span className="pp-editNavChev">›</span></div>
            <div className="pp-editNavItem"><span className="pp-editNavIco is-purple">↗</span><span><strong>Share with family</strong><small>Invite family to view and help care</small></span><span className="pp-editNavChev">›</span></div>
            <div className="pp-editNavItem"><span className="pp-editNavIco is-blue">👤</span><span><strong>Owner info</strong><small>Edit your profile contact details</small></span><span className="pp-editNavChev">›</span></div>
          </div>
          <button type="button" className="pp-btn pp-btnPrimary" style={{ width: '100%', marginTop: 16, borderRadius: 999 }}>Save changes</button>
        </div>
      ) : null}

      {pane === 'gps' ? (
        <div className="pp-modalCard pp-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="pp-iconRoundBtn">‹</button>
            <h2 className="pp-sectionTitle" style={{ margin: 0 }}>GPS Tracker</h2>
            <button type="button" className="pp-iconRoundBtn">✕</button>
          </div>
          <label className="pp-shopTrackerOpt pp-gpsLiveToggle is-on" style={{ marginTop: 14 }}>
            <span className="pp-editNavIco is-green">📍</span>
            <span className="pp-shopTrackerOpt__copy">
              <strong>Show on Live map</strong>
              <small>When enabled, Odin will appear on the Live map with a linked tracker.</small>
            </span>
            <span className="pp-shopTrackerOpt__meta"><span className="pp-shopTrackerOpt__switch is-on" aria-hidden /></span>
          </label>
          <div className="pp-gpsLinkedCard">
            <div className="pp-gpsLinkedCard__row">
              <img className="pp-gpsLinkedCard__img" src={TRACKER} alt="" />
              <div>
                <span className="pp-petTag pp-petTag--soft is-on">Tracker linked</span>
                <p className="pp-petList__meta" style={{ marginTop: 8 }}>IMEI: 8680220306666528</p>
                <p className="pp-petList__meta">Last seen: 2 hours ago</p>
              </div>
            </div>
            <div className="pp-gpsLinkedCard__actions">
              <button type="button" className="pp-btn pp-btnOutline">Change tracker</button>
              <button type="button" className="pp-btn pp-btnDangerOutline">Unlink</button>
            </div>
          </div>
          <div className="pp-label" style={{ marginTop: 14 }}>Need to link a different tracker?</div>
          <div className="pp-row" style={{ gap: 8, marginTop: 8 }}>
            <input className="pp-input" placeholder="IMEI / Device ID" readOnly />
            <button type="button" className="pp-btn">Scan QR</button>
          </div>
          <div className="pp-helpBar"><span className="pp-editNavIco is-blue">i</span>Where to find the IMEI?<span className="pp-editNavChev">›</span></div>
        </div>
      ) : null}

      {pane === 'gpsEmpty' ? (
        <div className="pp-modalCard pp-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="pp-iconRoundBtn">‹</button>
            <h2 className="pp-sectionTitle" style={{ margin: 0 }}>GPS Tracker</h2>
            <button type="button" className="pp-iconRoundBtn">✕</button>
          </div>
          <label className="pp-shopTrackerOpt pp-gpsLiveToggle" style={{ marginTop: 14 }}>
            <span className="pp-editNavIco is-green">📍</span>
            <span className="pp-shopTrackerOpt__copy">
              <strong>Show on Live map</strong>
              <small>When enabled, Odin will appear on the Live map with a linked tracker.</small>
            </span>
            <span className="pp-shopTrackerOpt__meta"><span className="pp-shopTrackerOpt__switch" style={{ background: '#d0d5dd' }} aria-hidden /></span>
          </label>
          <div className="pp-gpsEmptyCard">
            <span className="pp-gpsEmptyCard__ico">📡</span>
            <strong>No tracker linked</strong>
            <p className="pp-subtle">Link a tracker to show Odin on the Live map.</p>
          </div>
          <div className="pp-label" style={{ marginTop: 14 }}>Link a new tracker</div>
          <p className="pp-subtle" style={{ marginTop: 0 }}>Enter the device ID (IMEI) or scan the QR code.</p>
          <div className="pp-row" style={{ gap: 8 }}>
            <input className="pp-input" placeholder="IMEI / Device ID" readOnly />
            <button type="button" className="pp-btn">Scan QR</button>
          </div>
          <button type="button" className="pp-btn pp-btnPrimary" style={{ width: '100%', marginTop: 12, borderRadius: 999 }}>Link tracker</button>
          <div className="pp-helpBar"><span className="pp-editNavIco is-blue">i</span>Where to find the IMEI?<span className="pp-editNavChev">›</span></div>
        </div>
      ) : null}

      {pane === 'nfc' ? (
        <div className="pp-modalCard pp-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="pp-iconRoundBtn">‹</button>
            <h2 className="pp-sectionTitle" style={{ margin: 0 }}>NFC Tag</h2>
            <button type="button" className="pp-iconRoundBtn">✕</button>
          </div>
          <label className="pp-shopTrackerOpt pp-gpsLiveToggle is-on" style={{ marginTop: 14 }}>
            <span className="pp-nfcTickWrap" aria-hidden><IconGreenTick soft size={36} /></span>
            <span className="pp-shopTrackerOpt__copy">
              <strong>Enable public profile</strong>
              <small>When enabled, anyone who taps Odin’s NFC tag can view his public profile.</small>
            </span>
            <span className="pp-shopTrackerOpt__meta"><span className="pp-shopTrackerOpt__switch is-on" aria-hidden /></span>
          </label>
          <div className="pp-nfcActiveBanner">
            <span className="pp-nfcActiveBanner__tick" aria-hidden><IconGreenTick size={28} /></span>
            <div>
              <strong>NFC tag active</strong>
              <small>Odin’s profile will open when the tag is tapped.</small>
            </div>
          </div>
          <button type="button" className="pp-btn pp-btnPrimary" style={{ width: '100%', marginTop: 14, borderRadius: 999 }}>View public profile</button>
          <div className="pp-nfcHow">
            <span className="pp-editNavIco is-purple">📱</span>
            <div>
              <strong>How it works?</strong>
              <small>When someone taps your pet’s NFC tag with their phone, they’ll see a public profile with your contact details.</small>
            </div>
          </div>
        </div>
      ) : null}

      {pane === 'public' ? (
        <article className="pp-publicPet__sheet">
          <div className="pp-publicPet__banner">
            <img className="pp-publicPet__bannerImg" src={HERO} alt="" />
          </div>
          <div className="pp-publicPet__sheetBody">
            <div className="pp-publicPet__identity">
              <img className="pp-publicPet__avatar" src={HERO} alt="Odin" style={{ objectPosition: '28% 42%' }} />
              <div className="pp-publicPet__identityText">
                <h1>Odin <span className="pp-publicPet__gender is-m">♂</span></h1>
                <p className="pp-publicPet__metaLine">Jack Russell · 4 years old</p>
              </div>
            </div>
            <section className="pp-publicPet__ownerCard">
              <h2>Owner</h2>
              <p className="pp-publicPet__ownerName">Maria P.</p>
              <p className="pp-publicPet__ownerMeta">Limassol, Cyprus</p>
              <p className="pp-publicPet__ownerMeta">+357 99 000000</p>
              <p className="pp-publicPet__ownerMeta">maria@email.com</p>
              <div className="pp-publicPet__quickActions">
                <span className="pp-publicPet__quickAction">☎ Call now</span>
                <span className="pp-publicPet__quickAction">💬 WhatsApp</span>
                <span className="pp-publicPet__quickAction">✉ Email</span>
              </div>
            </section>
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
              <h2>Dog info</h2>
              <dl className="pp-publicPet__kv">
                <div className="pp-publicPet__kvRow"><dt>Breed</dt><dd>Jack Russell</dd></div>
                <div className="pp-publicPet__kvRow"><dt>Gender</dt><dd>Male</dd></div>
                <div className="pp-publicPet__kvRow"><dt>Colour</dt><dd>White & brown</dd></div>
              </dl>
            </section>
          </div>
        </article>
      ) : null}

      {pane === 'success' ? (
        <div className="pp-modalCard pp-addSuccess pp-pad">
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="pp-iconRoundBtn" aria-label="Close">✕</button>
          </div>
          <div className="pp-addSuccess__body">
            <div className="pp-addSuccess__photoWrap">
              <img className="pp-petAvatar" src={HERO} alt="" width={120} height={120} style={{ width: 120, height: 120, objectPosition: '28% 42%' }} />
              <span className="pp-addSuccess__check"><IconGreenTick size={34} /></span>
            </div>
            <h2>Odin is added!</h2>
            <p className="pp-subtle">You can now view Odin’s public profile and set up devices anytime.</p>
            <button type="button" className="pp-btn pp-btnPrimary" style={{ width: '100%', borderRadius: 999 }}>View public profile</button>
            <button type="button" className="pp-btn pp-btnOutline" style={{ width: '100%', marginTop: 10, borderRadius: 999 }}>Set up GPS tracker</button>
            <button type="button" className="pp-linkBtn">Add another pet</button>
          </div>
        </div>
      ) : null}

      {pane === 'profileHub' ? (
        <div className="pp-modalCard pp-profileModalCard pp-pad">
          <form className="pp-modalForm pp-profileModalForm">
            <header className="pp-profileModalHead">
              <h3 className="pp-profileEditorTitle">Personal details</h3>
              <p className="pp-profileEditorSub">Manage your profile and contact information.</p>
            </header>
            <div className="pp-profileIdentityCard">
              <button type="button" className="pp-profileIdentityCard__avatarBtn">
                <img className="pp-petAvatar" src={HERO} alt="" width={72} height={72} style={{ width: 72, height: 72, objectPosition: '28% 42%', borderRadius: '50%' }} />
                <span className="pp-profilePhotoEdit__badge" aria-hidden>📷</span>
              </button>
              <div className="pp-profileIdentityCard__copy">
                <button type="button" className="pp-profileIdentityCard__nameBtn">
                  <strong>Sotiris Kapnoullas</strong>
                  <span className="pp-profileIdentityCard__handle">@Kapnoullas</span>
                </button>
                <button type="button" className="pp-profileIdentityCard__photoLink">Change photo</button>
              </div>
              <button type="button" className="pp-profileIdentityCard__chevBtn">
                <span className="pp-editNavChev" aria-hidden>›</span>
              </button>
            </div>
            <div className="pp-editNavList pp-profileHubList">
              <button type="button" className="pp-editNavItem">
                <span className="pp-editNavIco is-purple">👤</span>
                <span>
                  <strong>Personal information</strong>
                  <small>First name: Sotiris · Last name: Kapnoullas · Location: Xylofagou</small>
                </span>
                <span className="pp-editNavChev">›</span>
              </button>
              <button type="button" className="pp-editNavItem">
                <span className="pp-editNavIco is-green">☎</span>
                <span>
                  <strong>Contact information</strong>
                  <small>Phone: +357 9999 7740 · Email: sotiris9515@gmail.com</small>
                </span>
                <span className="pp-editNavChev">›</span>
              </button>
              <button type="button" className="pp-editNavItem">
                <span className="pp-editNavIco is-green">💬</span>
                <span>
                  <strong>Additional contact methods</strong>
                  <small>Phone 2: +357 2212 3456 · WhatsApp: +357 9912 3456</small>
                </span>
                <span className="pp-editNavChev">›</span>
              </button>
            </div>
            <div className="pp-profileModalActions">
              <button type="button" className="pp-btn pp-btnPrimary pp-profileModalActions__save">Save changes</button>
              <button type="button" className="pp-btn pp-profileModalActions__cancel">Cancel</button>
            </div>
          </form>
        </div>
      ) : null}

      {pane === 'profileContact' ? (
        <div className="pp-modalCard pp-profileModalCard pp-pad">
          <form className="pp-modalForm pp-profileModalForm">
            <header className="pp-profileModalHead pp-profileModalHead--back">
              <button type="button" className="pp-iconRoundBtn" aria-label="Back">←</button>
              <div>
                <h3 className="pp-profileEditorTitle">Edit contact information</h3>
                <p className="pp-profileEditorSub">Update your contact details.</p>
              </div>
            </header>
            <div className="pp-profileFieldStack">
              <div>
                <div className="pp-label">Phone number *</div>
                <div className="pp-profileField">
                  <span className="pp-profileField__ico is-purple" aria-hidden>☎</span>
                  <input className="pp-input pp-profileField__input" value="+35799997740" readOnly />
                </div>
              </div>
              <div>
                <div className="pp-label">Contact email *</div>
                <div className="pp-profileField">
                  <span className="pp-profileField__ico is-purple" aria-hidden>✉</span>
                  <input className="pp-input pp-profileField__input" value="sotiris9515@gmail.com" readOnly />
                </div>
              </div>
              <div className="pp-profileExtraCard is-open">
                <button type="button" className="pp-profileExtraCard__toggle">
                  <span>Additional contact methods</span>
                  <span aria-hidden>▴</span>
                </button>
                <div className="pp-profileExtraCard__body">
                  <div>
                    <div className="pp-label">Phone 2</div>
                    <div className="pp-profileField">
                      <span className="pp-profileField__ico is-purple" aria-hidden>☎</span>
                      <input className="pp-input pp-profileField__input" value="+35722123456" readOnly />
                    </div>
                  </div>
                  <div>
                    <div className="pp-label">WhatsApp</div>
                    <div className="pp-profileField">
                      <span className="pp-profileField__ico is-green" aria-hidden>💬</span>
                      <input className="pp-input pp-profileField__input" value="+35799123456" readOnly />
                    </div>
                  </div>
                  <p className="pp-profilePhoneHint">
                    <span aria-hidden>ℹ</span>
                    Use international format, e.g. +35799123456.
                  </p>
                </div>
              </div>
              <div className="pp-profileLocCard">
                <div className="pp-profileLocCard__head">
                  <span className="pp-editNavIco is-purple">📍</span>
                  <div>
                    <strong>Location</strong>
                    <small>Your town or area (optional).</small>
                  </div>
                </div>
                <input className="pp-input" value="Xylofagou" readOnly />
              </div>
            </div>
            <div className="pp-profileModalActions">
              <button type="button" className="pp-btn pp-btnPrimary pp-profileModalActions__save">Save changes</button>
              <button type="button" className="pp-btn pp-profileModalActions__cancel">Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
