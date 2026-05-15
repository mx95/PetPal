# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/components/PetMedicationModal.js"
head = p.read_text(encoding="utf-8").split("  return (")[0]

d = "div"
jsx = f"""  return (
    <{d} className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="pp-med-modal-title">
      <button type="button" className="pp-modalBackdrop" aria-label={{t('common.cancel')}} onClick={{onClose}} />
      <{d} className="pp-modalCard pp-medModal">
        <{d} className="pp-medModal__hero">
          <{d} className="pp-medModal__heroIcon" aria-hidden>
            <IconMedPill size={{22}} />
          </{d}>
          <{d} className="pp-medModal__heroText">
            <{d} className="pp-modalHead" style={{{{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 0 }}}}>
              <{d}>
                <h2 id="pp-med-modal-title" className="pp-sectionTitle" style={{{{ margin: 0 }}}}>
                  {{t('myPets.medsTitle', {{ name: petName }})}}
                </h2>
                <p className="pp-subtle" style={{{{ margin: '6px 0 0', fontSize: 13 }}}}>
                  {{mode === 'vet' ? t('myPets.medsVetHint') : t('myPets.medsOwnerHint')}}
                </p>
              </{d}>
              <button type="button" className="pp-btn" onClick={{onClose}} aria-label={{t('common.cancel')}}>
                ✕
              </button>
            </{d}>
          </{d}>
        </{d}>

        {{err ? <{d} className="pp-error" style={{{{ marginBottom: 10 }}}}>{{err}}</{d}> : null}}

        {{mode === 'owner' && !firebaseReady ? (
          <p className="pp-subtle">{{t('myPets.medsNeedFirebase')}}</p>
        ) : null}}

        <ul className="pp-medList">
          {{rows.length === 0 ? <li className="pp-subtle pp-medList__empty">{{t('myPets.medsEmpty')}}</li> : null}}
          {{rows.map((r) => (
            <li key={{r.id}} className="pp-medList__item">
              <{d}>
                <{d} className="pp-medList__name">{{r.name}}</{d}>
                <{d} className="pp-medList__meta">
                  {{r.pillCount > 1
                    ? t('myPets.medsPillCountPlural', {{ count: r.pillCount }})
                    : t('myPets.medsPillCountOne')}}
                  {{' · '}}
                  {{formatTimesLabel(r.times, language)}}
                  {{r.dosage ? ` · ${{r.dosage}}` : ''}}
                  {{r.source === 'vet' ? ` · ${{t('myPets.medsFromVet')}}` : ''}}
                  {{r.vetLabel ? ` (${{r.vetLabel}})` : ''}}
                </{d}>
                {{r.notes ? <{d} className="pp-medList__notes">{{r.notes}}</{d}> : null}}
              </{d}>
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
          ))}}
        </ul>

        <{d} className="pp-medModal__form">
          <{d} className="pp-label">{{t('myPets.medsAddSection')}}</{d}>
          <{d} className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsName')}}</span>
              <input className="pp-input" value={{draftName}} onChange={{(e) => setDraftName(e.target.value)}} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{{t('myPets.medsPillCount')}}</span>
              <input
                className="pp-input"
                type="number"
                min={{1}}
                max={{99}}
                value={{draftPillCount}}
                onChange={{(e) => setDraftPillCount(e.target.value)}}
              />
            </label>
          </{d}>

          <{d} className="pp-medModal__times">
            <{d} className="pp-medModal__timesHead">
              <span className="pp-field__label">{{t('myPets.medsTimesLabel')}}</span>
              <button type="button" className="pp-btn pp-btn--ghost" onClick={{addDraftTime}}>
                {{t('myPets.medsAddTime')}}
              </button>
            </{d}>
            <{d} className="pp-medModal__timeRows">
              {{draftTimes.map((timeVal, idx) => (
                <{d} key={{`t-${{idx}}`}} className="pp-medModal__timeRow">
                  <input
                    className="pp-input"
                    type="time"
                    value={{timeVal}}
                    onChange={{(e) => updateDraftTime(idx, e.target.value)}}
                  />
                  {{draftTimes.length > 1 ? (
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={{() => removeDraftTime(idx)}} aria-label={{t('myPets.medsRemoveTime')}}>
                      ×
                    </button>
                  ) : null}}
                </{d}>
              ))}}
            </{d}>
          </{d}>

          <label className="pp-field" style={{{{ marginTop: 8 }}}}>
            <span className="pp-field__label">{{t('myPets.medsDose')}}</span>
            <input
              className="pp-input"
              value={{draftDosage}}
              onChange={{(e) => setDraftDosage(e.target.value)}}
              placeholder={{t('myPets.medsDosePh')}}
            />
          </label>
          <label className="pp-field" style={{{{ marginTop: 8 }}}}>
            <span className="pp-field__label">{{t('myPets.medsNotes')}}</span>
            <input className="pp-input" value={{draftNotes}} onChange={{(e) => setDraftNotes(e.target.value)}} />
          </label>
          <{d} className="pp-row" style={{{{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}}}>
            {{mode === 'owner' ? (
              <button type="button" className="pp-btn pp-btnPrimary" disabled={{busy || !canAdd}} onClick={{() => void addOwnerRow()}}>
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
          </{d}>
        </{d}>
      </{d}>
    </{d}>
  );
}}
"""

p.write_text(head + jsx, encoding="utf-8")
print("fixed", p)
