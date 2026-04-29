import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { applyMockAccountSeed, hasLoadedMockBundle } from '../data/mockAccountSeed';
import { PET_CATEGORIES } from '../pets/petCategories';
import { usePets } from '../pets/PetsContext';
import { filesToResizedDataUrls } from '../walk/walkPhotos';
import PetAvatar from '../components/PetAvatar';

export default function MyPets() {
  const { user } = useAuth();
  const { pets, addPet, updatePet, removePet, getCategory } = usePets();
  const [name, setName] = useState('');
  const [colorScheme, setColorScheme] = useState('');
  const [description, setDescription] = useState('');
  const [age, setAge] = useState('');
  const [mockMsg, setMockMsg] = useState('');
  const [categoryId, setCategoryId] = useState('dog');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('dog');
  const [editDevice, setEditDevice] = useState('');
  const [editColorScheme, setEditColorScheme] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAge, setEditAge] = useState('');
  const [addPhotoBusy, setAddPhotoBusy] = useState(false);
  const [editPhotoBusy, setEditPhotoBusy] = useState(false);
  const [addPetExpanded, setAddPetExpanded] = useState(false);
  const addPhotoInputId = useId();
  const editPhotoInputId = useId();
  const addPhotoRef = useRef(null);
  const editPhotoRef = useRef(null);

  async function submitAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    let photoDataUrl;
    const f = addPhotoRef.current?.files;
    if (f && f[0]) {
      setAddPhotoBusy(true);
      try {
        const urls = await filesToResizedDataUrls([f[0]]);
        photoDataUrl = urls[0];
      } catch {
        // skip bad file
      } finally {
        setAddPhotoBusy(false);
      }
    }
    addPet({
      name: name.trim(),
      categoryId,
      photoDataUrl,
      colorScheme,
      description,
      age,
    });
    setName('');
    setColorScheme('');
    setDescription('');
    setAge('');
    setCategoryId('dog');
    if (addPhotoRef.current) addPhotoRef.current.value = '';
    setAddPetExpanded(false);
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditCategoryId(p.categoryId);
    setEditDevice(p.trackingDeviceId || '');
    setEditColorScheme(p.colorScheme || '');
    setEditDescription(p.description || '');
    setEditAge(p.age || '');
    if (editPhotoRef.current) editPhotoRef.current.value = '';
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    let photoPatch = undefined;
    const f = editPhotoRef.current?.files;
    if (f && f[0]) {
      setEditPhotoBusy(true);
      try {
        const urls = await filesToResizedDataUrls([f[0]]);
        photoPatch = urls[0];
      } catch {
        // skip
      } finally {
        setEditPhotoBusy(false);
      }
    }
    updatePet(editingId, {
      name: editName,
      categoryId: editCategoryId,
      trackingDeviceId: editDevice.trim() || null,
      colorScheme: editColorScheme,
      description: editDescription,
      age: editAge,
      ...(photoPatch ? { photoDataUrl: photoPatch } : {}),
    });
    setEditingId(null);
    if (editPhotoRef.current) editPhotoRef.current.value = '';
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge">Pets</div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              My pets
            </h1>
            <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 560 }}>
              Add each pet with type, optional <strong>colours / coat</strong>, <strong>age</strong>, and a short{' '}
              <strong>description</strong>, plus an optional <strong>profile photo</strong>. One GPS device id per pet on
              the tracker. Premium <Link to="/premium/lost">lost pet alerts</Link> use your photo and details for faster
              contact.
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad" style={{ borderColor: 'rgba(91, 55, 255, 0.2)' }}>
          <h2 className="pp-sectionTitle">Try sample data</h2>
          <p className="pp-subtle" style={{ marginBottom: 10, maxWidth: 720 }}>
            Load <strong>Bailey</strong> and <strong>Miso</strong>, demo walks/XP, and two community posts. This saves to{' '}
            <strong>this browser</strong> only (it does not create rows in the Firebase Data tab by itself).
          </p>
          {!user ? (
            <p className="pp-subtle" style={{ color: '#b42318' }}>Sign in to use sample data.</p>
          ) : (
            <>
              {mockMsg ? <p className="pp-subtle" style={{ marginBottom: 10 }}>{mockMsg}</p> : null}
              {user?.uid && hasLoadedMockBundle(user.uid) ? (
                <p className="pp-subtle" style={{ fontSize: 12, marginBottom: 8 }}>
                  Sample bundle was applied before. Use again if you removed Bailey/Miso and want them back.
                </p>
              ) : null}
              <button
                type="button"
                className="pp-btn pp-btnPrimary"
                onClick={() => {
                  setMockMsg('');
                  if (!user?.uid) return;
                  const r = applyMockAccountSeed(user.uid, user);
                  if (r.error === 'storage') {
                    setMockMsg(
                      'Could not save in this browser (storage blocked or full). Allow site data for localhost and try again.'
                    );
                    return;
                  }
                  if (r.alreadyHadBundle) {
                    setMockMsg('Sample pets and posts are already loaded. Check Dashboard, Community, and the pet list on this page.');
                    return;
                  }
                  window.location.reload();
                }}
              >
                Load sample pets &amp; mock data
              </button>
            </>
          )}
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <button
            type="button"
            className="pp-expandTrigger"
            aria-expanded={addPetExpanded}
            onClick={() => setAddPetExpanded((o) => !o)}
            id="add-pet-expand"
          >
            <span className="pp-expandTrigger__icon" aria-hidden>
              {addPetExpanded ? '−' : '+'}
            </span>
            <span className="pp-expandTrigger__text">
              <span className="pp-expandTrigger__title">Add a pet</span>
              <span className="pp-expandTrigger__desc">
                {addPetExpanded
                  ? 'Fill in the form below. You can collapse this section anytime.'
                  : 'Tap to add a new profile: name, type, photo, and optional details for Community and Premium tools.'}
              </span>
            </span>
            <span className={`pp-expandTrigger__chev ${addPetExpanded ? 'is-open' : ''}`} aria-hidden>
              ▼
            </span>
          </button>
          {addPetExpanded ? (
            <div className="pp-expandPanel" role="region" aria-labelledby="add-pet-expand">
              <p className="pp-subtle pp-expandIntro">
                Add each pet with type, optional <strong>colours / coat</strong>, <strong>age</strong>, and a short{' '}
                <strong>description</strong>, plus an optional <strong>profile photo</strong>. One GPS device id per pet
                appears when you edit the pet below. <Link to="/premium/lost">Lost pet alerts</Link> can use this photo and
                text.
              </p>
              <form className="pp-form" onSubmit={submitAdd}>
                <div>
                  <div className="pp-label">Name</div>
                  <input
                    className="pp-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Luna"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <div className="pp-label">Category</div>
                  <select
                    className="pp-input"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {PET_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="pp-label">Colour / pattern (optional)</div>
                  <input
                    className="pp-input"
                    value={colorScheme}
                    onChange={(e) => setColorScheme(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. Black and tan, grey tabby"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <div className="pp-label">Age (optional)</div>
                  <input
                    className="pp-input"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    maxLength={80}
                    placeholder="e.g. 3 years, 8 months, senior"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <div className="pp-label">Description (optional)</div>
                  <textarea
                    className="pp-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                    style={{ minHeight: 72, resize: 'vertical' }}
                    placeholder="Personality, habits, medical notes to remember at a glance…"
                  />
                </div>
                <div>
                  <div className="pp-label">Profile photo (optional)</div>
                  <input
                    id={addPhotoInputId}
                    ref={addPhotoRef}
                    type="file"
                    accept="image/*"
                    className="pp-input"
                    style={{ fontSize: 14 }}
                  />
                  <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}>
                    Resized to save space. Square pictures look best in the list and in Community.
                  </p>
                </div>
                <button type="submit" className="pp-btn pp-btnPrimary" disabled={!name.trim() || addPhotoBusy}>
                  {addPhotoBusy ? 'Processing…' : 'Add pet'}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pp-col-6">
        <div className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Your pack ({pets.length})</h2>
          {pets.length === 0 ? (
            <p className="pp-subtle">No pets yet — add one on the left.</p>
          ) : (
            <ul className="pp-petList">
              {pets.map((p) => (
                <li key={p.id} className="pp-petList__item">
                  {editingId === p.id ? (
                    <form className="pp-form" onSubmit={saveEdit}>
                      <div className="pp-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 140px' }}>
                          <div className="pp-label">Name</div>
                          <input
                            className="pp-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>
                        <div style={{ flex: '1 1 160px' }}>
                          <div className="pp-label">Category</div>
                          <select
                            className="pp-input"
                            value={editCategoryId}
                            onChange={(e) => setEditCategoryId(e.target.value)}
                          >
                            {PET_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.emoji} {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <div className="pp-label">Colour / pattern (optional)</div>
                        <input
                          className="pp-input"
                          value={editColorScheme}
                          onChange={(e) => setEditColorScheme(e.target.value)}
                          maxLength={120}
                          placeholder="e.g. Black and tan"
                        />
                      </div>
                      <div>
                        <div className="pp-label">Age (optional)</div>
                        <input
                          className="pp-input"
                          value={editAge}
                          onChange={(e) => setEditAge(e.target.value)}
                          maxLength={80}
                          placeholder="e.g. 2 years"
                        />
                      </div>
                      <div>
                        <div className="pp-label">Description (optional)</div>
                        <textarea
                          className="pp-input"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={2000}
                          style={{ minHeight: 72, resize: 'vertical' }}
                          placeholder="Short notes"
                        />
                      </div>
                      <div>
                        <div className="pp-label">Traccar device id (optional)</div>
                        <input
                          className="pp-input"
                          value={editDevice}
                          onChange={(e) => setEditDevice(e.target.value)}
                          placeholder="Link a device for live map"
                          inputMode="numeric"
                        />
                      </div>
                      <div>
                        <div className="pp-label">Profile photo</div>
                        <div className="pp-row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          {p.photoDataUrl ? (
                            <img
                              src={p.photoDataUrl}
                              alt=""
                              className="pp-petAvatar"
                              style={{ width: 56, height: 56 }}
                            />
                          ) : (
                            <div
                              className="pp-petAvatar pp-petAvatar--placeholder"
                              style={{ width: 56, height: 56, fontSize: 28 }}
                              aria-hidden
                            >
                              {getCategory(p).emoji}
                            </div>
                          )}
                          <div style={{ flex: '1 1 200px' }}>
                            <input
                              id={editPhotoInputId}
                              ref={editPhotoRef}
                              type="file"
                              accept="image/*"
                              className="pp-input"
                              style={{ fontSize: 14 }}
                            />
                            {p.photoDataUrl ? (
                              <button
                                type="button"
                                className="pp-link"
                                style={{ display: 'block', marginTop: 6, padding: 0, fontSize: 12 }}
                                onClick={() => {
                                  updatePet(editingId, { photoDataUrl: null });
                                }}
                              >
                                Remove current photo
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="pp-row" style={{ gap: 8 }}>
                        <button type="submit" className="pp-btn pp-btnPrimary" disabled={editPhotoBusy}>
                          {editPhotoBusy ? 'Processing…' : 'Save'}
                        </button>
                        <button type="button" className="pp-btn" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="pp-petList__row">
                        <PetAvatar pet={p} size={48} />
                        <div>
                          <div className="pp-petList__name">{p.name}</div>
                          <div className="pp-petList__meta">
                            {getCategory(p).label}
                            {p.trackingDeviceId ? (
                              <> · Device #{p.trackingDeviceId}</>
                            ) : (
                              <> · No tracker linked</>
                            )}
                          </div>
                          {(p.age || p.colorScheme) && (
                            <div className="pp-petList__tags">
                              {p.age ? <span className="pp-petTag">Age: {p.age}</span> : null}
                              {p.colorScheme ? <span className="pp-petTag">Look: {p.colorScheme}</span> : null}
                            </div>
                          )}
                          {p.description ? (
                            <p className="pp-petList__desc">{p.description}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="pp-row" style={{ marginTop: 10, gap: 8 }}>
                        <button type="button" className="pp-btn" onClick={() => startEdit(p)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="pp-btn"
                          onClick={() => {
                            if (window.confirm(`Remove ${p.name} from PetPal?`)) removePet(p.id);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
