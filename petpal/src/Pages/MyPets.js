import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PET_CATEGORIES } from '../pets/petCategories';
import { usePets } from '../pets/PetsContext';

export default function MyPets() {
  const { pets, addPet, updatePet, removePet, getCategory } = usePets();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('dog');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('dog');
  const [editDevice, setEditDevice] = useState('');

  function submitAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    addPet({ name: name.trim(), categoryId });
    setName('');
    setCategoryId('dog');
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditCategoryId(p.categoryId);
    setEditDevice(p.trackingDeviceId || '');
  }

  function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    updatePet(editingId, {
      name: editName,
      categoryId: editCategoryId,
      trackingDeviceId: editDevice.trim() || null,
    });
    setEditingId(null);
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
              Add every pet with a type. Only one pet can use a given GPS device id on the tracker
              screen — pets without a device can still earn walk achievements and appear in community
              posts.
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
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
            <button type="submit" className="pp-btn pp-btnPrimary" disabled={!name.trim()}>
              Add pet
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
                      <div className="pp-row" style={{ gap: 8 }}>
                        <button type="submit" className="pp-btn pp-btnPrimary">
                          Save
                        </button>
                        <button type="button" className="pp-btn" onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="pp-petList__row">
                        <span className="pp-petList__emoji" aria-hidden>
                          {getCategory(p).emoji}
                        </span>
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
