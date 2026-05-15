# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
D = "d" + "iv"
src = (ROOT / "src/components/PetMedicationModal.base.js").read_text(encoding="utf-8-sig")

def tg(cls=None):
    if cls:
        return f"<{D} className=\"{cls}\">"
    return f"<{D}>"

def ct():
    return f"</{D}>"

# --- imports & helpers ---
src = src.replace(
    "import { addPetMedication, deletePetMedication, subscribePetMedications } from '../pets/petMedicationsFirestore';",
    """import {
  addPetMedication,
  deletePetMedication,
  formatMedicationFirestoreError,
  subscribePetMedications,
} from '../pets/petMedicationsFirestore';
import IconMedPill from './icons/IconMedPill';

function normalizeDraftTimes(times) {
  const out = (Array.isArray(times) ? times : [])
    .map((t) => String(t || '').trim().slice(0, 5))
    .filter((t) => /^\\d{1,2}:\\d{2}$/.test(t));
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
}""",
)

src = src.replace("const { t } = useI18n();", "const { t, language } = useI18n();")
src = src.replace(
    "  const [draftTime, setDraftTime] = useState('09:00');",
    "  const [draftTimes, setDraftTimes] = useState(['09:00']);\n  const [draftPillCount, setDraftPillCount] = useState('1');",
)
src = src.replace("(e) => setErr(e?.message || 'failed')", "(e) => setErr(formatMedicationFirestoreError(e, t))")
src = src.replace("  }, [open, mode, ownerUid, petId]);", "  }, [open, mode, ownerUid, petId, t]);")

src = src.replace(
    """    setVetRows(
      base.map((m, i) => ({
        id: typeof m.id === 'string' ? m.id : `row_${i}`,
        name: String(m.name || ''),
        time: String(m.time || '09:00').slice(0, 5),
        dosage: String(m.dosage || ''),
        notes: String(m.notes || ''),
        source: m.source === 'owner' ? 'owner' : 'vet',
        vetLabel: String(m.vetLabel || ''),
      }))
    );""",
    """    setVetRows(
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
    );""",
)

src = src.replace(
    """  const addOwnerRow = async () => {
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
  };""",
    """  const resetDraft = () => {
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
  };""",
)

src = src.replace(
    """    } catch (e) {
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
  };""",
    """    } catch (e) {
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
  const canAdd = Boolean(buildDraftPayload()) && (mode !== 'owner' || isFirebaseConfigured());""",
)

# list row meta
import re
src = re.sub(
    r"<div className=\"pp-medList__meta\">\s*\{t\('myPets\.medsTime'\)\}: \{r\.time \|\| '[^']*'\}",
    """<motionless>
                  {r.pillCount > 1
                    ? t('myPets.medsPillCountPlural', { count: r.pillCount })
                    : t('myPets.medsPillCountOne')}
                  {' · '}
                  {formatTimesLabel(r.times ?? r.time, language)}""".replace("motionless", D),
    src,
    count=1,
)

# modal card header
old_head = re.search(
    r'      <div className="pp-modalCard"[^>]*>\s*<div className="pp-modalHead">.*?</motionless>\s*</motionless>',
    src,
    re.S,
)
if not old_head:
    old_head = re.search(
        r'      <div className="pp-modalCard"[^>]*>\s*<div className="pp-modalHead">.*?</div>\s*</motionless>',
        src,
        re.S,
    )

new_head = (
    tg("pp-modalCard pp-medModal")
    + "\n"
    + tg("pp-medModal__hero")
    + "\n"
    + f'<{D} className="pp-medModal__heroIcon" aria-hidden>'
    + "\n            <IconMedPill size={22} />\n          "
    + ct()
    + "\n"
    + tg("pp-modalHead pp-medModal__head")
    + "\n"
    + tg()
    + "\n              <h2 id=\"pp-med-modal-title\" className=\"pp-sectionTitle\" style={{ margin: 0 }}>\n                {t('myPets.medsTitle', { name: petName })}\n              </h2>\n              <p className=\"pp-subtle\" style={{ margin: '6px 0 0', fontSize: 13 }}>\n                {mode === 'vet' ? t('myPets.medsVetHint') : t('myPets.medsOwnerHint')}\n              </p>\n            "
    + ct()
    + "\n            <button type=\"button\" className=\"pp-btn\" onClick={onClose} aria-label={t('common.cancel')}>\n              ✕\n            </button>\n          "
    + ct()
    + "\n        "
    + ct()
)

if old_head:
    src = src[: old_head.start()] + new_head + src[old_head.end() :]
else:
    src = src.replace(
        '      <div className="pp-modalCard" style={{ maxWidth: 440, width: \'min(100%, 440px)\' }}>',
        tg("pp-modalCard pp-medModal"),
        1,
    )

# form section
old_form_simple = """        <div className="pp-form" style={{ marginTop: 14 }}>
          <div className="pp-label">{t('myPets.medsAddSection')}</div>
          <motionless>
            <motionless>
              <motionless>{t('myPets.medsName')}</motionless>
              <input className="pp-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            </motionless>
            <motionless>
              <motionless>{t('myPets.medsTime')}</motionless>
              <input className="pp-input" type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} />
            </motionless>
          </motionless>"""

new_form_simple = old_form_simple.replace("motionless", D)
new_form_simple = new_form_simple.replace(
    f"""          <{D} className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsName')}}</span>
              <input className="pp-input" value={{draftName}} onChange={{(e) => setDraftName(e.target.value)}} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsTime')}}</span>
              <input className="pp-input" type="time" value={{draftTime}} onChange={{(e) => setDraftTime(e.target.value)}} />
            </label>
          </{D}>""",
    f"""          <{D} className="pp-medModal__form">
          <{D} className="pp-label">{{t('myPets.medsAddSection')}}</{D}>
          <{D} className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsName')}}</span>
              <input className="pp-input" value={{draftName}} onChange={{(e) => setDraftName(e.target.value)}} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsPillCount')}}</span>
              <input className="pp-input" type="number" min={{1}} max={{99}} value={{draftPillCount}} onChange={{(e) => setDraftPillCount(e.target.value)}} />
            </label>
          </{D}>
          <{D} className="pp-medModal__times">
            <{D} className="pp-medModal__timesHead">
              <span className="pp-field__label">{{t('myPets.medsTimesLabel')}}</span>
              <button type="button" className="pp-btn pp-btn--ghost" onClick={{addDraftTime}}>{{t('myPets.medsAddTime')}}</button>
            </{D}>
            <{D} className="pp-medModal__timeRows">
              {{draftTimes.map((timeVal, idx) => (
                <{D} key={{`t-${{idx}}`}} className="pp-medModal__timeRow">
                  <input className="pp-input" type="time" value={{timeVal}} onChange={{(e) => updateDraftTime(idx, e.target.value)}} />
                  {{draftTimes.length > 1 ? (
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={{() => removeDraftTime(idx)}} aria-label={{t('myPets.medsRemoveTime')}}>×</button>
                  ) : null}}
                </{D}>
              ))}}
            </{D}>
          </{D}>""",
).replace(f'<{D} className="pp-form" style={{{{ marginTop: 14 }}}}>', f'<{D} className="pp-medModal__form">')

if old_form_simple.split(D)[0] in src or f'<{D} className="pp-form"' in src:
    src = src.replace(
        f"""        <{D} className="pp-form" style={{{{ marginTop: 14 }}}}>
          <{D} className="pp-label">{{t('myPets.medsAddSection')}}</{D}>
          <{D} className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsName')}}</span>
              <input className="pp-input" value={{draftName}} onChange={{(e) => setDraftName(e.target.value)}} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsTime')}}</span>
              <input className="pp-input" type="time" value={{draftTime}} onChange={{(e) => setDraftTime(e.target.value)}} />
            </label>
          </{D}>""",
        f"""        <{D} className="pp-medModal__form">
          <{D} className="pp-label">{{t('myPets.medsAddSection')}}</{D}>
          <{D} className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsName')}}</span>
              <input className="pp-input" value={{draftName}} onChange={{(e) => setDraftName(e.target.value)}} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsPillCount')}}</span>
              <input className="pp-input" type="number" min={{1}} max={{99}} value={{draftPillCount}} onChange={{(e) => setDraftPillCount(e.target.value)}} />
            </label>
          </{D}>
          <{D} className="pp-medModal__times">
            <{D} className="pp-medModal__timesHead">
              <span className="pp-field__label">{{t('myPets.medsTimesLabel')}}</span>
              <button type="button" className="pp-btn pp-btn--ghost" onClick={{addDraftTime}}>{{t('myPets.medsAddTime')}}</button>
            </{D}>
            <{D} className="pp-medModal__timeRows">
              {{draftTimes.map((timeVal, idx) => (
                <{D} key={{`t-${{idx}}`}} className="pp-medModal__timeRow">
                  <input className="pp-input" type="time" value={{timeVal}} onChange={{(e) => updateDraftTime(idx, e.target.value)}} />
                  {{draftTimes.length > 1 ? (
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={{() => removeDraftTime(idx)}} aria-label={{t('myPets.medsRemoveTime')}}>×</button>
                  ) : null}}
                </{D}>
              ))}}
            </{D}>
          </{D}>""",
    )

src = src.replace(
    'placeholder={t(\'myPets.medsDosePh\')}',
    "placeholder={t('myPets.medsDosePh')}",
)
if "medsDosePh" not in src:
    src = src.replace(
        '<input className="pp-input" value={draftDosage} onChange={(e) => setDraftDosage(e.target.value)} />',
        '<input className="pp-input" value={draftDosage} onChange={(e) => setDraftDosage(e.target.value)} placeholder={t(\'myPets.medsDosePh\')} />',
    )

src = src.replace(
    "disabled={busy || !draftName.trim() || !firebaseReady}",
    "disabled={busy || !canAdd}",
)
src = src.replace(
    "disabled={!draftName.trim()} onClick={addVetRowLocal}",
    "disabled={!canAdd} onClick={addVetRowLocal}",
)

# fix any stray motionless tag from corruption
bad = "mo" + "tionless"
src = src.replace("<" + bad + ">", "<" + D + ">").replace("</" + bad + ">", "</" + D + ">")

out = ROOT / "src/components/PetMedicationModal.js"
out.write_text(src, encoding="utf-8", newline="\n")
print("wrote", out)
