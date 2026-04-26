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
  const [mockMsg, setMockMsg] = useState('');
  const [categoryId, setCategoryId] = useState('dog');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('dog');
  const [editDevice, setEditDevice] = useState('');
  const [addPhotoBusy, setAddPhotoBusy] = useState(false);
  const [editPhotoBusy, setEditPhotoBusy] = useState(false);
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
    addPet({ name: name.trim(), categoryId, photoDataUrl });
    setName('');
    setCategoryId('dog');
    if (addPhotoRef.current) addPhotoRef.current.value = '';
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditCategoryId(p.categoryId);
    setEditDevice(p.trackingDeviceId || '');
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
              Add every pet with a type and an optional <strong>profile photo</strong>. Only one pet can use a given
              GPS device id on the tracker screen — pets without a device can still earn walk achievements and appear
              in community posts. Premium <Link to="/lost-pet">lost pet alerts</Link> use your photo and details to help
              people reach you fast.
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
          <h2 className="pp-sectionTitle">Add a pet</h2>
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
