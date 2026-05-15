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

const FREQ_PRESETS = [
  { key: 'morning', time: '08:00', labelKey: 'myPets.medsFreqMorning' },
  { key: 'afternoon', time: '14:00', labelKey: 'myPets.medsFreqAfternoon' },
  { key: 'evening', time: '20:00', labelKey: 'myPets.medsFreqEvening' },
];

function normalizeDraftTimes(times) {
  const out = (Array.isArray(times) ? times : [])
    .map((t) => String(t || '').trim().slice(0, 5))
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t));
  return out.length ? [...new Set(out)].sort((a, b) => a.localeCompare(b)) : ['09:00'];
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

function MedEmptyIllustration() {
  return (
    <svg className="pp-medModal__emptyArt" viewBox="0 0 120 120" aria-hidden>
      <circle cx="60" cy="60" r="52" fill="url(#ppMedEmptyGrad)" opacity="0.35" />
      <path
        d="M38 62c0-12 10-22 22-22s22 10 22 22-10 22-22 22"
        stroke="currentColor"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="52" cy="58" rx="3" ry="4" fill="currentColor" opacity="0.5" />
      <ellipse cx="68" cy="58" rx="3" ry="4" fill="currentColor" opacity="0.5" />
      <path d="M54 68c4 3 8 3 12 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="72" y="44" width="22" height="34" rx="11" stroke="currentColor" strokeWidth="2" fill="rgba(91,55,255,0.08)" />
      <path d="M83 52v18M76 61h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="ppMedEmptyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5b37ff" />
          <stop offset="100%" stopColor="#2f80ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   mode: 'owner' | 'vet',
 *   petName: string,
 *   ownerUid?: string | null,
 *   petId?: string | null,
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
  const [draftPillCount, setDraftPillCount] = useState(1);
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
  const firebaseReady = isFirebaseConfigured();

  const resetDraft = () => {
    setDraftName('');
    setDraftTimes(['09:00']);
    setDraftPillCount(1);
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
    setDraftTimes((prev) => normalizeDraftTimes(prev.map((t, i) => (i === idx ? value : t))));
  };

  const addDraftTime = () => {
    setDraftTimes((prev) => normalizeDraftTimes([...prev, '12:00']));
  };

  const removeDraftTime = (idx) => {
    setDraftTimes((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return normalizeDraftTimes(next.length ? next : ['09:00']);
    });
  };

  const addPresetTime = (time) => {
    setDraftTimes((prev) => normalizeDraftTimes([...prev, time]));
  };

  const presetActive = (time) => draftTimes.includes(time);

  const setPillCount = (n) => {
    setDraftPillCount(Math.max(1, Math.min(99, Math.floor(n))));
  };

  const canAdd = Boolean(buildDraftPayload()) && (mode !== 'owner' || firebaseReady);

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

  return (
    <div className="pp-modalWrap pp-medModal pp-medModal--open" role="dialog" aria-modal="true" aria-labelledby="pp-med-modal-title">
      <button type="button" className="pp-modalBackdrop" aria-label={t('common.cancel')} onClick={onClose} />
      <div className="pp-modalCard pp-medModal__card">
        <header className="pp-medModal__header">
          <div className="pp-medModal__headerMain">
            <div className="pp-medModal__headerIcon" aria-hidden>
              <IconMedPill size={28} />
            </div>
            <div className="pp-medModal__headerCopy">
              <h2 id="pp-med-modal-title" className="pp-medModal__title">
                {t('myPets.medsTitle', { name: petName })}
              </h2>
              <p className="pp-medModal__subtitle">
                {mode === 'vet' ? t('myPets.medsVetHint') : t('myPets.medsOwnerHint')}
              </p>
            </div>
          </div>
          <button type="button" className="pp-medModal__close" onClick={onClose} aria-label={t('common.cancel')}>
            <span aria-hidden>×</span>
          </button>
        </header>

        <div className="pp-medModal__scroll">
          {err ? <div className="pp-error pp-medModal__error" role="alert">{err}</div> : null}

          {mode === 'owner' && !firebaseReady ? (
            <p className="pp-subtle pp-medModal__warn">{t('myPets.medsNeedFirebase')}</p>
          ) : null}

          <section className="pp-medModal__listSection" aria-label={t('myPets.medsTitle', { name: petName })}>
            {rows.length === 0 ? (
              <div className="pp-medModal__empty">
                <MedEmptyIllustration />
                <p className="pp-medModal__emptyTitle">{t('myPets.medsEmptyTitle')}</p>
                <p className="pp-medModal__emptyHint">{t('myPets.medsEmptyHint')}</p>
              </div>
            ) : (
              <ul className="pp-medList">
                {rows.map((r) => (
                  <li key={r.id} className="pp-medList__item">
                    <div className="pp-medList__icon" aria-hidden>
                      <IconMedPill size={18} />
                    </div>
                    <div className="pp-medList__body">
                      <div className="pp-medList__name">{r.name}</div>
                      <div className="pp-medList__row">
                        <span className="pp-medList__tag">{t('myPets.medsWhenLabel')}</span>
                        <span className="pp-medList__value">{formatTimesLabel(r.times ?? r.time, language)}</span>
                      </div>
                      <div className="pp-medList__row">
                        <span className="pp-medList__tag">{t('myPets.medsDosageLabel')}</span>
                        <span className="pp-medList__value">
                          {r.pillCount > 1
                            ? t('myPets.medsPillCountPlural', { count: r.pillCount })
                            : t('myPets.medsPillCountOne')}
                          {r.dosage ? ` · ${r.dosage}` : ''}
                        </span>
                      </div>
                      {(r.source === 'vet' || r.vetLabel) && (
                        <div className="pp-medList__badge">
                          {r.source === 'vet' ? t('myPets.medsFromVet') : ''}
                          {r.vetLabel ? ` · ${r.vetLabel}` : ''}
                        </div>
                      )}
                      {r.notes ? <p className="pp-medList__notes">{r.notes}</p> : null}
                    </div>
                    <button
                      type="button"
                      className="pp-medList__remove"
                      disabled={mode === 'owner' && busy}
                      onClick={() => (mode === 'owner' ? void removeOwnerRow(r.id) : removeVetRow(r.id))}
                      aria-label={t('myPets.medsRemove')}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form
            className="pp-medModal__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'owner') void addOwnerRow();
              else addVetRowLocal();
            }}
          >
            <section className="pp-medModal__section">
              <h3 className="pp-medModal__sectionTitle">{t('myPets.medsSectionDetails')}</h3>
              <div className="pp-medModal__fields">
                <label className="pp-medModal__field pp-medModal__field--wide">
                  <span className="pp-medModal__label">{t('myPets.medsName')}</span>
                  <input
                    className="pp-medModal__input"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={t('myPets.medsNamePh')}
                    autoComplete="off"
                  />
                </label>
                <label className="pp-medModal__field">
                  <span className="pp-medModal__label">{t('myPets.medsPillCount')}</span>
                  <div className="pp-medStepper">
                    <button
                      type="button"
                      className="pp-medStepper__btn"
                      onClick={() => setPillCount(draftPillCount - 1)}
                      disabled={draftPillCount <= 1}
                      aria-label={t('myPets.medsDecrease')}
                    >
                        ×
                    </button>
                    <span className="pp-medStepper__value" aria-live="polite">
                      {draftPillCount}
                    </span>
                    <button
                      type="button"
                      className="pp-medStepper__btn"
                      onClick={() => setPillCount(draftPillCount + 1)}
                      disabled={draftPillCount >= 99}
                      aria-label={t('myPets.medsIncrease')}
                    >
                      +
                    </button>
                  </div>
                </label>
                <label className="pp-medModal__field pp-medModal__field--wide">
                  <span className="pp-medModal__label">{t('myPets.medsDose')}</span>
                  <input
                    className="pp-medModal__input"
                    value={draftDosage}
                    onChange={(e) => setDraftDosage(e.target.value)}
                    placeholder={t('myPets.medsDosePh')}
                    autoComplete="off"
                  />
                </label>
              </div>
            </section>

            <section className="pp-medModal__section">
              <h3 className="pp-medModal__sectionTitle">{t('myPets.medsSectionSchedule')}</h3>
              <p className="pp-medModal__sectionHint">{t('myPets.medsScheduleHint')}</p>
              <div className="pp-medModal__presets" role="group" aria-label={t('myPets.medsSectionSchedule')}>
                {FREQ_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={`pp-medModal__preset${presetActive(p.time) ? ' is-active' : ''}`}
                    onClick={() => addPresetTime(p.time)}
                  >
                    {t(p.labelKey)}
                  </button>
                ))}
              </div>
              <div className="pp-medModal__timeChips">
                {draftTimes.map((timeVal, idx) => (
                  <div key={`t-${idx}-${timeVal}`} className="pp-medTimeChip">
                    <TimeInput24
                      className="pp-medModal__timeInput"
                      value={timeVal}
                      onChange={(next) => updateDraftTime(idx, next)}
                      aria-label={`${t('myPets.medsTimeLabel')} ${idx + 1}`}
                    />
                    {draftTimes.length > 1 ? (
                      <button
                        type="button"
                        className="pp-medTimeChip__remove"
                        onClick={() => removeDraftTime(idx)}
                        aria-label={t('myPets.medsRemoveTime')}
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button type="button" className="pp-medModal__addTime" onClick={addDraftTime}>
                <span className="pp-medModal__addTimeIcon" aria-hidden>+</span>
                {t('myPets.medsAddTime')}
              </button>
            </section>

            <section className="pp-medModal__section">
              <h3 className="pp-medModal__sectionTitle">{t('myPets.medsSectionNotes')}</h3>
              <label className="pp-medModal__field pp-medModal__field--wide">
                <span className="pp-medModal__label">{t('myPets.medsNotes')}</span>
                <textarea
                  className="pp-medModal__input pp-medModal__textarea"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder={t('myPets.medsNotesPh')}
                  rows={2}
                />
              </label>
            </section>

            <div className="pp-medModal__actions">
              {mode === 'owner' ? (
                <button type="submit" className="pp-btn pp-btnPrimary pp-medModal__submit" disabled={busy || !canAdd}>
                  {t('myPets.medsAddMedication')}
                </button>
              ) : (
                <>
                  <button type="submit" className="pp-btn pp-btnPrimary pp-medModal__submit" disabled={!canAdd}>
                    {t('myPets.medsAddMedication')}
                  </button>
                  <button
                    type="button"
                    className="pp-btn pp-btnPrimary pp-medModal__submit"
                    disabled={busy}
                    onClick={() => void saveVet()}
                  >
                    {t('common.save')}
                  </button>
                </>
              )}
              <button type="button" className="pp-btn pp-btn--ghost pp-medModal__cancel" onClick={onClose}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
