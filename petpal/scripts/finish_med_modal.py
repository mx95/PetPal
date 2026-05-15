# -*- coding: utf-8 -*-
from pathlib import Path

D = "d" + "iv"
target = Path(__file__).resolve().parents[1] / "src" / "components" / "PetMedicationModal.js"

jsx_tail = f"""
      <button type="button" className="pp-modalBackdrop" aria-label={{t('common.cancel')}} onClick={{onClose}} />
      <{D} className="pp-modalCard pp-medModal__card">
        <{D} className="pp-medModal__hero">
          <span className="pp-medModal__heroIcon" aria-hidden>
            <IconMedPill size={{22}} />
          </span>
          <{D} className="pp-medModal__heroText">
            <h2 id="pp-med-modal-title" className="pp-sectionTitle" style={{{{ margin: 0 }}}}>
              {{t('myPets.medsTitle', {{ name: petName }})}}
            </h2>
            <p className="pp-subtle" style={{{{ margin: '6px 0 0', fontSize: 13 }}}}>
              {{mode === 'vet' ? t('myPets.medsVetHint') : t('myPets.medsOwnerHint')}}
            </p>
          </{D}>
          <button type="button" className="pp-btn pp-medModal__close" onClick={{onClose}} aria-label={{t('common.cancel')}}>
            \u2715
          </button>
        </{D}>

        {{err ? <{D} className="pp-error" style={{{{ marginBottom: 10 }}}}>{{err}}</{D}> : null}}

        {{mode === 'owner' && !firebaseReady ? (
          <p className="pp-subtle">{{t('myPets.medsNeedFirebase')}}</p>
        ) : null}}

        <ul className="pp-medList">
          {{rows.length === 0 ? <li className="pp-subtle pp-medList__empty">{{t('myPets.medsEmpty')}}</li> : null}}
          {{rows.map((r) => {{
            const times = normalizeDraftTimes(r.times ?? r.time);
            const pills = Math.max(1, Number(r.pillCount) || 1);
            const dosePart = r.dosage ? ' \u00b7 ' + t('myPets.medsDose') + ': ' + r.dosage : '';
            const vetPart = r.source === 'vet' ? ' \u00b7 ' + t('myPets.medsFromVet') : '';
            const vetLabelPart = r.vetLabel ? ' (' + r.vetLabel + ')' : '';
            return (
              <li key={{r.id}} className="pp-medList__item">
                <{D}>
                  <{D} className="pp-medList__name">{{r.name}}</{D}>
                  <{D} className="pp-medList__meta">
                    {{t('myPets.medsTimesLabel')}}: {{formatTimesLabel(times, language)}}
                    {{' \u00b7 '}}
                    {{pills === 1 ? t('myPets.medsPillCountOne') : t('myPets.medsPillCountPlural', {{ count: pills }})}}
                    {{dosePart}}{{vetPart}}{{vetLabelPart}}
                  </{D}>
                  {{r.notes ? <{D} className="pp-medList__notes">{{r.notes}}</{D}> : null}}
                </{D}>
                {{mode === 'owner' ? (
                  <button
                    type="button"
                    className="pp-btn pp-btn--ghost"
                    disabled={{busy}}
                    onClick={{() => void removeOwnerRow(r.id)}}
                  >
                    {{t('myPets.medsRemove')}}
                  </button>
                ) : (
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={{() => removeVetRow(r.id)}}>
                    {{t('myPets.medsRemove')}}
                  </button>
                )}}
              </li>
            );
          }})}}
        </ul>

        <{D} className="pp-form pp-medModal__form">
          <{D} className="pp-label">{{t('myPets.medsAddSection')}}</{D}>
          <label className="pp-field">
            <span className="pp-field__label">{{t('myPets.medsName')}}</span>
            <input className="pp-input" value={{draftName}} onChange={{(e) => setDraftName(e.target.value)}} />
          </label>

          <{D} className="pp-medModal__row2">
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsPillCount')}}</span>
              <input
                className="pp-input"
                type="number"
                min={{1}}
                max={{99}}
                step={{1}}
                value={{draftPillCount}}
                onChange={{(e) => setDraftPillCount(e.target.value)}}
              />
            </label>
            <{D} className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsTimesLabel')}}</span>
              <{D} className="pp-medModal__times">
                {{draftTimes.map((tm, idx) => (
                  <{D} key={{'t-' + idx}} className="pp-medModal__timeRow">
                    <input
                      className="pp-input"
                      type="time"
                      value={{tm}}
                      onChange={{(e) => updateDraftTime(idx, e.target.value)}}
                    />
                    {{draftTimes.length > 1 ? (
                      <button
                        type="button"
                        className="pp-btn pp-btn--ghost pp-medModal__timeRemove"
                        aria-label={{t('myPets.medsRemoveTime')}}
                        onClick={{() => removeDraftTime(idx)}}
                      >
                        \u2715
                      </button>
                    ) : null}}
                  </{D}>
                ))}}
                <button type="button" className="pp-btn pp-btn--ghost pp-medModal__addTime" onClick={{addDraftTime}}>
                  + {{t('myPets.medsAddTime')}}
                </button>
              </{D}>
            </{D}>
          </{D}>

          <label className="pp-field">
            <span className="pp-field__label">{{t('myPets.medsDose')}}</span>
            <input
              className="pp-input"
              placeholder={{t('myPets.medsDosePh')}}
              value={{draftDosage}}
              onChange={{(e) => setDraftDosage(e.target.value)}}
            />
          </label>
          <label className="pp-field">
            <span className="pp-field__label">{{t('myPets.medsNotes')}}</span>
            <input className="pp-input" value={{draftNotes}} onChange={{(e) => setDraftNotes(e.target.value)}} />
          </label>

          <{D} className="pp-row pp-medModal__actions">
            {{mode === 'owner' ? (
              <button
                type="button"
                className="pp-btn pp-btnPrimary"
                disabled={{busy || !canAdd}}
                onClick={{() => void addOwnerRow()}}
              >
                {{t('myPets.medsAdd')}}
              </button>
            ) : (
              <button type="button" className="pp-btn pp-btnPrimary" disabled={{!canAdd}} onClick={{addVetRowLocal}}>
                {{t('myPets.medsAdd')}}
              </button>
            )}}
            {{mode === 'vet' ? (
              <button type="button" className="pp-btn pp-btnPrimary" disabled={{busy}} onClick={{() => void saveVet()}}>
                {{t('common.save')}}
              </button>
            ) : null}}
            <button type="button" className="pp-btn" onClick={{onClose}}>
              {{t('common.cancel')}}
            </button>
          </{D}>
        </{D}>
      </{D}>
    </{D}>
  );
}}
"""

text = target.read_text(encoding="utf-8")
text = text.replace("<motionless", f"<{D}").replace("motionless>", f"{D}>")
if not text.rstrip().endswith(");"):
    text = text.rstrip() + jsx_tail
target.write_text(text, encoding="utf-8")
print("wrote", target, "lines", text.count(chr(10)) + 1)
