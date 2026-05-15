# -*- coding: utf-8 -*-
from pathlib import Path

D = "d" + "iv"
p = Path(__file__).resolve().parents[1] / "src/components/PetMedicationModal.js"
s = p.read_text(encoding="utf-8")

old_head = """    <motionless className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="pp-med-modal-title">
      <button type="button" className="pp-modalBackdrop" aria-label={t('common.cancel')} onClick={onClose} />
<div className="pp-modalCard pp-medModal">
        <motionless className="pp-modalHead">
          <motionless>
            <h2 id="pp-med-modal-title" className="pp-sectionTitle" style={{ margin: 0 }}>
              {t('myPets.medsTitle', { name: petName })}
            </h2>
            <p className="pp-subtle" style={{ margin: '6px 0 0', fontSize: 13 }}>
              {mode === 'vet' ? t('myPets.medsVetHint') : t('myPets.medsOwnerHint')}
            </p>
          </motionless>
          <button type="button" className="pp-btn" onClick={onClose} aria-label={t('common.cancel')}>
            \u0393\u00a3\u00f5
          </button>
        </motionless>""".replace("motionless", D)

new_head = f"""    <{D} className="pp-modalWrap pp-medModal" role="dialog" aria-modal="true" aria-labelledby="pp-med-modal-title">
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
        </{D}>"""

# build old_head from actual file fragment
actual_old = """    <div className="pp-modalWrap" role="dialog" aria-modal="true" aria-labelledby="pp-med-modal-title">
      <button type="button" className="pp-modalBackdrop" aria-label={t('common.cancel')} onClick={onClose} />
<div className="pp-modalCard pp-medModal">
        <motionless className="pp-modalHead">
          <motionless>
            <h2 id="pp-med-modal-title" className="pp-sectionTitle" style={{ margin: 0 }}>
              {t('myPets.medsTitle', { name: petName })}
            </h2>
            <p className="pp-subtle" style={{ margin: '6px 0 0', fontSize: 13 }}>
              {mode === 'vet' ? t('myPets.medsVetHint') : t('myPets.medsOwnerHint')}
            </p>
          </motionless>
          <button type="button" className="pp-btn" onClick={onClose} aria-label={t('common.cancel')}>
            """.replace("motionless", D)

idx = s.find(actual_old)
if idx < 0:
    raise SystemExit("head block not found")
end = s.find("</motionless>", idx)
end = s.find("\n", end) + 1
end = s.find("\n", end)  # after closing pp-modalHead
# simpler: find close button block end
end_marker = "        </div>\n\n        {err ?"
end = s.find(end_marker, idx)
if end < 0:
    raise SystemExit("end marker not found")
s = s[:idx] + new_head + s[end:]

s = s.replace("                <motionless>".replace("motionless", D), f'                <{D} className="pp-medList__meta">', 1)
s = s.replace("{r.dosage ? ` ┬╖ ${t('myPets.medsDose')}", "{r.dosage ? ` · ${t('myPets.medsDose')}")
s = s.replace("{r.source === 'vet' ? ` ┬╖ ${t('myPets.medsFromVet')}", "{r.source === 'vet' ? ` · ${t('myPets.medsFromVet')}")
s = s.replace('className="pp-modalCard pp-medModal"', 'className="pp-modalCard pp-medModal__card"', 1)

p.write_text(s, encoding="utf-8", newline="\n")
print("patched ok")
