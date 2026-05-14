import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { isFirebaseConfigured } from '../firebase';
import { addPetMedication, deletePetMedication, subscribePetMedications } from '../pets/petMedicationsFirestore';

/**
 * Owner: live-sync to Firestore `users/{uid}/pets/{petId}/medications`.
 * Vet: edits a local list and calls `onSaveVet(rows)` with serializable rows (id, name, time, dosage, notes, source, vetLabel).
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   mode: 'owner' | 'vet',
 *   petName: string,
 *   ownerUid?: string | null,
 *   petId?: string | null,
 *   companyId?: string,
 *   vetClinicLabel?: string,
 *   initialVetRows?: Array<Record<string, unknown>>,
 *   onSaveVet?: (rows: Array<Record<string, unknown>>) => Promise<void> | void,
 * }} props
 */
export default function PetMedicationModal({
  open,
  onClose,
  mode,
  petName,
  ownerUid = null,
  petId = null,
  vetClinicLabel = '',
  initialVetRows = [],
  onSaveVet,
}) {
  const { t } = useI18n();
  const [ownerRows, setOwnerRows] = useState([]);
  const [vetRows, setVetRows] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftTime, setDraftTime] = useState('09:00');
  const [draftDosage, setDraftDosage] = useState('');
  const [draftNotes, setDraftNotes] = useState('');

  useEffect(() => {
    if (!open || mode !== 'owner' || !ownerUid || !petId || !isFirebaseConfigured()) {
      if (mode === 'owner') setOwnerRows([]);
      return undefined;
    }
    setErr('');
    const unsub = subscribePetMedications(
      ownerUid,
      petId,
      (rows) => setOwnerRows(rows),
      (e) => setErr(e?.message || 'failed')
    );
    return () => unsub();
  }, [open, mode, ownerUid, petId]);

  useEffect(() => {
    if (!open || mode !== 'vet') return;
    const base = Array.isArray(initialVetRows) ? initialVetRows : [];
    setVetRows(
      base.map((m, i) => ({
        id: typeof m.id === 'string' ? m.id : `row_${i}`,
        name: String(m.name || ''),
        time: String(m.time || '09:00').slice(0, 5),
        dosage: String(m.dosage || ''),
        notes: String(m.notes || ''),
        source: m.source === 'owner' ? 'owner' : 'vet',
        vetLabel: String(m.vetLabel || ''),
      }))
    );
    setErr('');
  }, [open, mode, initialVetRows]);

  if (!open) return null;

  const rows = mode === 'owner' ? ownerRows : vetRows;

  const addOwnerRow = async () => {
    const name = draftName.trim();
    if (!name || !ownerUid || !petId) return;
    setBusy(true);
    setErr('');
    try {
      await addPetMedication(ownerUid, petId, {
        name,
        time: draftTime || '09:00',
        dosage: draftDosage,
        notes: draftNotes,
        source: 'owner',
      });
      setDraftName('');
      setDraftDosage('');
      setDraftNotes('');
      setDraftTime('09:00');
    } catch (e) {
      setErr(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  };

  const removeOwnerRow = async (id) => {
    if (!ownerUid || !petId) return;
    setBusy(true);
    setErr('');
    try {
      await deletePetMedication(ownerUid, petId, id);
    } catch (e) {
      setErr(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  };

  const addVetRowLocal = () => {
    const name = draftName.trim();
    if (!name) return;
    setVetRows((prev) => [
      ...prev,
      {
        id: `med_${Date.now()}`,
        name,
        time: (draftTime || '09:00').slice(0, 5),
        dosage: draftDosage.trim(),
        notes: draftNotes.trim(),
        source: 'vet',
        vetLabel: vetClinicLabel.trim(),
      },
    ]);
    setDraftName('');
    setDraftDosage('');
    setDraftNotes('');
    setDraftTime('09:00');
  };

  const removeVetRow = (id) => {
    setVetRows((prev) => prev.filter((r) => r.id !== id));
  };

  const saveVet = async () => {
    if (!onSaveVet) return;
    setBusy(true);
    setErr('');
    try {
      await onSaveVet(vetRows);
      onClose();
    } catch (e) {
      setErr(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  };

  const firebaseReady = isFirebaseConfigured();

  return (
    <div className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="pp-med-modal-title">
      <button type="button" className="pp-modalBackdrop" aria-label={t('common.cancel')} onClick={onClose} />
      <div className="pp-modalCard" style={{ maxWidth: 440, width: 'min(100%, 440px)' }}>
        <div className="pp-modalHead">
          <div>
            <h2 id="pp-med-modal-title" className="pp-sectionTitle" style={{ margin: 0 }}>
              {t('myPets.medsTitle', { name: petName })}
            </h2>
            <p className="pp-subtle" style={{ margin: '6px 0 0', fontSize: 13 }}>
              {mode === 'vet' ? t('myPets.medsVetHint') : t('myPets.medsOwnerHint')}
            </p>
          </div>
          <button type="button" className="pp-btn" onClick={onClose} aria-label={t('common.cancel')}>
            ✕
          </button>
        </div>

        {err ? <div className="pp-error" style={{ marginBottom: 10 }}>{err}</div> : null}

        {mode === 'owner' && !firebaseReady ? (
          <p className="pp-subtle">{t('myPets.medsNeedFirebase')}</p>
        ) : null}

        <ul className="pp-medList">
          {rows.length === 0 ? <li className="pp-subtle pp-medList__empty">{t('myPets.medsEmpty')}</li> : null}
          {rows.map((r) => (
            <li key={r.id} className="pp-medList__item">
              <div>
                <div className="pp-medList__name">{r.name}</div>
                <div className="pp-medList__meta">
                  {t('myPets.medsTime')}: {r.time || '—'}
                  {r.dosage ? ` · ${t('myPets.medsDose')}: ${r.dosage}` : ''}
                  {r.source === 'vet' ? ` · ${t('myPets.medsFromVet')}` : ''}
                  {r.vetLabel ? ` (${r.vetLabel})` : ''}
                </div>
                {r.notes ? <div className="pp-medList__notes">{r.notes}</div> : null}
              </div>
              {mode === 'owner' ? (
                <button
                  type="button"
                  className="pp-btn pp-btn--ghost"
                  disabled={busy}
                  onClick={() => void removeOwnerRow(r.id)}
                >
                  {t('myPets.medsRemove')}
                </button>
              ) : (
                <button type="button" className="pp-btn pp-btn--ghost" onClick={() => removeVetRow(r.id)}>
                  {t('myPets.medsRemove')}
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="pp-form" style={{ marginTop: 14 }}>
          <div className="pp-label">{t('myPets.medsAddSection')}</div>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{t('myPets.medsName')}</span>
              <input className="pp-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('myPets.medsTime')}</span>
              <input className="pp-input" type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} />
            </label>
          </div>
          <label className="pp-field" style={{ marginTop: 8 }}>
            <span className="pp-field__label">{t('myPets.medsDose')}</span>
            <input className="pp-input" value={draftDosage} onChange={(e) => setDraftDosage(e.target.value)} />
          </label>
          <label className="pp-field" style={{ marginTop: 8 }}>
            <span className="pp-field__label">{t('myPets.medsNotes')}</span>
            <input className="pp-input" value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} />
          </label>
          <div className="pp-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {mode === 'owner' ? (
              <button type="button" className="pp-btn pp-btnPrimary" disabled={busy || !draftName.trim() || !firebaseReady} onClick={() => void addOwnerRow()}>
                {t('myPets.medsAdd')}
              </button>
            ) : (
              <button type="button" className="pp-btn pp-btnPrimary" disabled={!draftName.trim()} onClick={addVetRowLocal}>
                {t('myPets.medsAdd')}
              </button>
            )}
            {mode === 'vet' ? (
              <button type="button" className="pp-btn pp-btnPrimary" disabled={busy} onClick={() => void saveVet()}>
                {t('common.save')}
              </button>
            ) : null}
            <button type="button" className="pp-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
