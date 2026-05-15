# -*- coding: utf-8 -*-
from pathlib import Path

content = r'''import React, { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { isFirebaseConfigured } from '../firebase';
import {
  addPetMedication,
  deletePetMedication,
  formatMedicationFirestoreError,
  subscribePetMedications,
} from '../pets/petMedicationsFirestore';
import IconMedPill from './icons/IconMedPill';

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

  const resetDraft = () => {
    setDraftName('');
    setDraftTimes(['09:00']);
    setDraftPillCount('1');
    setDraftDosage('');
    setDraftNotes('');
  };

  if (!open) return null;

  const rows = mode === 'owner' ? ownerRows : vetRows;
  const firebaseReady = isFirebaseConfigured();

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
      { id: `med_${Date.now()}`, ...payload, time: payload.times[0], source: 'vet', vetLabel: vetClinicLabel.trim() },
    ]);
    resetDraft();
  };

  const removeVetRow = (id) => setVetRows((prev) => prev.filter((r) => r.id !== id));

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

  const updateDraftTime = (idx, value) => {
    setDraftTimes((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const addDraftTime = () => setDraftTimes((prev) => [...prev, '12:00']);
  const removeDraftTime = (idx) => setDraftTimes((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  const canAdd = Boolean(buildDraftPayload()) && (mode !== 'owner' || firebaseReady);

  return (
    <div className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="pp-med-modal-title">
      <button type="button" className="pp-modalBackdrop" aria-label={t('common.cancel')} onClick={onClose} />
      <motionless>
      </motionless>
    </motionless>
  );
}
'''

# Fix accidental tag in template end - use replace
content = content.replace('<motionless>\n      </motionless>\n    </motionless>', '''<div className="pp-modalCard pp-medModal">
        <motionless>
        </motionless>
      </motionless>''')

# Write body manually - the replace above is still wrong. Build return in parts.
return_body = """
      <div className="pp-modalCard pp-medModal">
        <div className="pp-medModal__hero">
          <motionless>
            <IconMedPill size={22} />
          </motionless>
          <motionless>
            <motionless>
              <motionless>
                <motionless>{t('myPets.medsTitle', { name: petName })}</motionless>
                <motionless>{mode === 'vet' ? t('myPets.medsVetHint') : t('myPets.medsOwnerHint')}</motionless>
              </motionless>
              <motionless>✕</motionless>
            </motionless>
          </motionless>
        </motionless>
        PLACEHOLDER_REST
      </motionless>
"""

return_body = return_body.replace('motionless', 'motionless')  # noop

Path(__file__).resolve().parents[1].joinpath('src/components/PetMedicationModal.js').write_text('BROKEN', encoding='utf-8')
