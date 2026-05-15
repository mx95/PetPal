import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { isFirebaseConfigured } from '../firebase';
import {
  addPetMedication,
  deletePetMedication,
  formatMedicationFirestoreError,
  subscribePetMedications,
} from '../pets/petMedicationsFirestore';
import IconMedPill from './icons/IconMedPill';
import TimeInput24 from './TimeInput24';

function normalizeDraftTimes(times) {
  const out = (Array.isArray(times) ? times : [])
    .map((t) => String(t || '').trim().slice(0, 5))
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t));
  return out.length ? [...out].sort((a, b) => a.localeCompare(b)) : ['09:00'];
}

function formatTimesLabel(times, lang) {
  const list = normalizeDraftTimes(times);
  try {
    return list
      .map((t) => {
        const [h, m] = t.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d.toLocaleTimeString(lang === 'el' ? 'el' : lang === 'ru' ? 'ru' : 'en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      })
      .join(' · ');
  } catch {
    return list.join(' · ');
  }
}

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
  const { t, language } = useI18n();
  const [ownerRows, setOwnerRows] = useState([]);
  const [vetRows, setVetRows] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftTimes, setDraftTimes] = useState(['09:00']);
  const [draftPillCount, setDraftPillCount] = useState('1');
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
      (e) => setErr(formatMedicationFirestoreError(e, t))
    );
    return () => unsub();
  }, [open, mode, ownerUid, petId, t]);

  useEffect(() => {
    if (!open || mode !== 'vet') return;
    const base = Array.isArray(initialVetRows) ? initialVetRows : [];
    setVetRows(
      base.map((m, i) => {
        const times = normalizeDraftTimes(m.times ?? m.time);
        return {
          id: typeof m.id === 'string' ? m.id : `row_${i}`,
          name: String(m.name || ''),
          times,
          time: times[0],
          pillCount: Math.max(1, Number(m.pillCount ?? m.pills) || 1),
          dosage: String(m.dosage || ''),
          notes: String(m.notes || ''),
          source: m.source === 'owner' ? 'owner' : 'vet',
          vetLabel: String(m.vetLabel || ''),
        };
      })
    );
    setErr('');
  }, [open, mode, initialVetRows]);

  if (!open) return null;

  const rows = mode === 'owner' ? ownerRows : vetRows;

  const resetDraft = () => {
    setDraftName('');
    setDraftTimes(['09:00']);
    setDraftPillCount('1');
    setDraftDosage('');
    setDraftNotes('');
  };

  const buildDraftPayload = () => {
    const name = draftName.trim();
    if (!name) return null;
    const times = normalizeDraftTimes(draftTimes);
    const pillCount = Math.max(1, Math.min(99, Math.floor(Number(draftPillCount) || 1)));
    return { name, times, pillCount, dosage: draftDosage.trim(), notes: draftNotes.trim() };
  };

  const addOwnerRow = async () => {
    const payload = buildDraftPayload();
    if (!payload || !ownerUid || !petId) return;
    setBusy(true);
    setErr('');
    try {
      await addPetMedication(ownerUid, petId, { ...payload, source: 'owner' });
      resetDraft();
    } catch (e) {
      setErr(formatMedicationFirestoreError(e, t));
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
      setErr(formatMedicationFirestoreError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const addVetRowLocal = () => {
    const payload = buildDraftPayload();
    if (!payload) return;
    setVetRows((prev) => [
      ...prev,
      {
        id: `med_${Date.now()}`,
        ...payload,
        time: payload.times[0],
        source: 'vet',
        vetLabel: vetClinicLabel.trim(),
      },
    ]);
    resetDraft();
  };

  const updateDraftTime = (idx, value) => {
    setDraftTimes((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const addDraftTime = () => setDraftTimes((prev) => [...prev, '12:00']);
  const removeDraftTime = (idx) => setDraftTimes((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  const canAdd = Boolean(buildDraftPayload()) && (mode !== 'owner' || isFirebaseConfigured());

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
    <div className="pp-modalWrap pp-medModal" role="dialog" aria-modal="true" aria-labelledby="pp-med-modal-title">
      <button type="button" className="pp-modalBackdrop" aria-label={t('common.cancel')} onClick={onClose} />
      <div className="pp-modalCard pp-medModal__card">
        <div className="pp-medModal__hero">
          <span className="pp-medModal__heroIcon" aria-hidden>
            <IconMedPill size={22} />
          </span>
          <div className="pp-medModal__heroText">
            <h2 id="pp-med-modal-title" className="pp-sectionTitle" style={{ margin: 0 }}>
              {t('myPets.medsTitle', { name: petName })}
            </h2>
            <p className="pp-subtle" style={{ margin: '6px 0 0', fontSize: 13 }}>
              {mode === 'vet' ? t('myPets.medsVetHint') : t('myPets.medsOwnerHint')}
            </p>
          </div>
          <button type="button" className="pp-btn pp-medModal__close" onClick={onClose} aria-label={t('common.cancel')}>
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
                  {r.pillCount > 1
                    ? t('myPets.medsPillCountPlural', { count: r.pillCount })
                    : t('myPets.medsPillCountOne')}
                  {' · '}
                  {formatTimesLabel(r.times ?? r.time, language)}
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

        <div className="pp-medModal__form">
          <div className="pp-label">{t('myPets.medsAddSection')}</div>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{t('myPets.medsName')}</span>
              <input className="pp-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('myPets.medsPillCount')}</span>
              <input className="pp-input" type="number" min={1} max={99} value={draftPillCount} onChange={(e) => setDraftPillCount(e.target.value)} />
            </label>
          </div>
          <div className="pp-medModal__times">
            <div className="pp-medModal__timesHead">
              <span className="pp-field__label">{t('myPets.medsTimesLabel')}</span>
              <button type="button" className="pp-btn pp-btn--ghost" onClick={addDraftTime}>{t('myPets.medsAddTime')}</button>
            </div>
            <div className="pp-medModal__timeRows">
              {draftTimes.map((timeVal, idx) => (
                <div key={`t-${idx}`} className="pp-medModal__timeRow">
                  <TimeInput24 className="pp-medModal__timeInput" value={timeVal} onChange={(next) => updateDraftTime(idx, next)} aria-label={t('myPets.medsTimeLabel')} />
                  {draftTimes.length > 1 ? (
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => removeDraftTime(idx)} aria-label={t('myPets.medsRemoveTime')}>×</button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <label className="pp-field" style={{ marginTop: 8 }}>
            <span className="pp-field__label">{t('myPets.medsDose')}</span>
            <input className="pp-input" value={draftDosage} onChange={(e) => setDraftDosage(e.target.value)} placeholder={t('myPets.medsDosePh')} />
          </label>
          <label className="pp-field" style={{ marginTop: 8 }}>
            <span className="pp-field__label">{t('myPets.medsNotes')}</span>
            <input className="pp-input" value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} />
          </label>
          <div className="pp-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {mode === 'owner' ? (
              <button type="button" className="pp-btn pp-btnPrimary" disabled={busy || !canAdd} onClick={() => void addOwnerRow()}>
                {t('myPets.medsAdd')}
              </button>
            ) : (
              <button type="button" className="pp-btn pp-btnPrimary" disabled={!canAdd} onClick={addVetRowLocal}>
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
