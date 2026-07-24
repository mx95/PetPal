import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TimeRangeRow from '../../components/TimeRangeRow';
import NumericSettingInput from '../../components/NumericSettingInput';
import { useI18n } from '../../i18n/I18nContext';
import { dateKey, monthDays } from '../bookingHeatMap';
import { HOLIDAY_COUNTRY_OPTIONS } from '../publicHolidays';
import {
  buildCalendarPreview,
  DEFAULT_SCHEDULING_SETTINGS,
  EFFECTIVE_MODES,
  HOLIDAY_MODES,
} from './availabilityEngine';
import {
  defaultWeeklyRule,
  deleteAvailabilityOverride,
  deleteBlockedPeriod,
  deleteVacation,
  ensureDefaultAvailabilityRules,
  saveSchedulingSettings,
  subscribeAvailabilityOverrides,
  subscribeAvailabilityRules,
  subscribeBlockedPeriods,
  subscribeEmployees,
  subscribeVacations,
  upsertAvailabilityOverride,
  upsertAvailabilityRule,
  upsertBlockedPeriod,
  upsertVacation,
} from './availabilityFirestore';

const WEEKDAYS = [
  { dow: 1, shortKey: 'weekdayMonShort', narrowKey: 'weekdayMonNarrow' },
  { dow: 2, shortKey: 'weekdayTueShort', narrowKey: 'weekdayTueNarrow' },
  { dow: 3, shortKey: 'weekdayWedShort', narrowKey: 'weekdayWedNarrow' },
  { dow: 4, shortKey: 'weekdayThuShort', narrowKey: 'weekdayThuNarrow' },
  { dow: 5, shortKey: 'weekdayFriShort', narrowKey: 'weekdayFriNarrow' },
  { dow: 6, shortKey: 'weekdaySatShort', narrowKey: 'weekdaySatNarrow' },
  { dow: 0, shortKey: 'weekdaySunShort', narrowKey: 'weekdaySunNarrow' },
];

function emptyPeriod() {
  return { startTime: '09:00', endTime: '17:00' };
}

function emptyVacationDraft(t) {
  return { startDate: '', endDate: '', label: t('availability.vacationDefaultLabel') };
}

function emptyBlockDraft(t) {
  return { date: '', start: '13:00', end: '14:30', label: t('availability.breakDefaultLabel') };
}

function previewStatusLabel(status, t) {
  switch (status) {
    case 'working':
      return t('availability.previewWorking');
    case 'override':
      return t('availability.previewOverride');
    case 'vacation':
      return t('availability.previewTimeOff');
    case 'holiday':
      return t('availability.previewHoliday');
    default:
      return t('availability.previewClosed');
  }
}

function PreviewCalendar({ days, t, language, weekdayLabels }) {
  const anchor = useMemo(() => {
    const keys = Object.keys(days || {}).sort();
    if (!keys.length) return new Date();
    const parsed = new Date(`${keys[0]}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [days]);

  const monthGrid = useMemo(() => monthDays(anchor), [anchor]);
  const visibleMonth = anchor.getMonth();
  const monthLabel = anchor.toLocaleDateString(language, { month: 'long', year: 'numeric' });

  return (
    <div className="pp-availPreviewWrap">
      <div className="pp-availPreview__head">
        <strong className="pp-availPreview__title">{monthLabel}</strong>
        <span className="pp-availPreview__subtitle">{t('availability.schedulePreviewFromToday')}</span>
      </div>
      <div className="pp-availPreviewWeekdays" aria-hidden>
        {weekdayLabels.map((label, idx) => (
          <span key={`${label}-${idx}`} className="pp-availPreview__weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="pp-availPreview" aria-label={t('availability.schedulePreviewAriaLabel')}>
        {monthGrid.map((day) => {
          const key = dateKey(day);
          const inMonth = day.getMonth() === visibleMonth;
          const status = days?.[key] || 'closed';
          const statusLabel = previewStatusLabel(status, t);
          if (!inMonth) {
            return <span key={key} className="pp-availPreview__day is-outside" aria-hidden />;
          }
          return (
            <span
              key={key}
              className={`pp-availPreview__day is-${status}`}
              title={t('availability.previewDayTitle', { date: key, status: statusLabel })}
            >
              {day.getDate()}
            </span>
          );
        })}
        <div className="pp-availPreview__legend">
          <span className="is-working">{t('availability.previewWorking')}</span>
          <span className="is-override">{t('availability.previewOverride')}</span>
          <span className="is-vacation">{t('availability.previewTimeOff')}</span>
          <span className="is-holiday">{t('availability.previewHoliday')}</span>
        </div>
      </div>
    </div>
  );
}

export default function AvailabilityScheduler({ companyId, services = [], settings: initialSettings, onSettingsChange }) {
  const { t, language } = useI18n();
  const [rules, setRules] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [settings, setSettings] = useState({ ...DEFAULT_SCHEDULING_SETTINGS, ...initialSettings });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState('weekly');

  const [weeklyDraft, setWeeklyDraft] = useState(() => defaultWeeklyRule());
  const [overrideDraft, setOverrideDraft] = useState({ date: '', unavailable: false, periods: [emptyPeriod()] });
  const [vacationDraft, setVacationDraft] = useState(() => emptyVacationDraft(t));
  const [blockDraft, setBlockDraft] = useState(() => emptyBlockDraft(t));
  const genericError = t('common.errorGeneric');
  const errorMessage = useCallback(
    (e) => (e?.message && e.message !== 'failed' ? e.message : genericError),
    [genericError]
  );
  const weekdayButtonLabels = useMemo(
    () => WEEKDAYS.map(({ dow, shortKey }) => ({ dow, label: t(`availability.${shortKey}`) })),
    [t]
  );
  const previewWeekdayLabels = useMemo(
    () => WEEKDAYS.map(({ narrowKey }) => t(`availability.${narrowKey}`)),
    [t]
  );

  useEffect(() => {
    if (!companyId) return;
    void ensureDefaultAvailabilityRules(companyId);
  }, [companyId]);

  useEffect(
    () =>
      subscribeAvailabilityRules(
        companyId,
        (rows) => {
          setRules(rows);
          setErr('');
        },
        (e) => setErr(errorMessage(e))
      ),
    [companyId, errorMessage]
  );
  useEffect(() => subscribeAvailabilityOverrides(companyId, setOverrides, () => {}), [companyId]);
  useEffect(() => subscribeVacations(companyId, setVacations, () => {}), [companyId]);
  useEffect(() => subscribeBlockedPeriods(companyId, setBlocked, () => {}), [companyId]);
  useEffect(() => subscribeEmployees(companyId, setEmployees, () => {}), [companyId]);

  useEffect(() => {
    const base = rules.find((r) => !r.serviceId && !r.employeeId && r.recurrenceType === 'weekly');
    if (base) setWeeklyDraft({ ...defaultWeeklyRule(), ...base, periods: base.periods?.length ? base.periods : [emptyPeriod()] });
  }, [rules]);

  useEffect(() => {
    setSettings((s) => ({ ...s, ...initialSettings }));
  }, [initialSettings]);

  const previewDays = useMemo(
    () => buildCalendarPreview({ settings, rules, overrides, vacations, blockedPeriods: blocked }),
    [settings, rules, overrides, vacations, blocked]
  );

  const toggleWeeklyDay = (dow) => {
    setWeeklyDraft((d) => {
      const days = new Set(d.daysOfWeek || []);
      if (days.has(dow)) days.delete(dow);
      else days.add(dow);
      return { ...d, daysOfWeek: Array.from(days).sort() };
    });
  };

  const saveWeeklyRule = async () => {
    setErr('');
    setBusy(true);
    try {
      const existing = rules.find((r) => !r.serviceId && !r.employeeId && r.recurrenceType === 'weekly');
      await upsertAvailabilityRule(companyId, existing?.id || null, weeklyDraft);
      setOk(t('availability.weeklyScheduleSaved'));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    onSettingsChange?.(next);
    await saveSchedulingSettings(companyId, patch);
  };

  const addPeriod = () => setWeeklyDraft((d) => ({ ...d, periods: [...(d.periods || []), emptyPeriod()] }));

  const removePeriod = (idx) => {
    setWeeklyDraft((d) => {
      const periods = [...(d.periods || [])];
      if (periods.length <= 1) return d;
      periods.splice(idx, 1);
      return { ...d, periods };
    });
  };

  const AvailTimeRange = ({ startTime, endTime, onStartChange, onEndChange, onRemove, canRemove }) => (
    <TimeRangeRow
      startTime={startTime}
      endTime={endTime}
      onStartChange={onStartChange}
      onEndChange={onEndChange}
      onRemove={onRemove}
      canRemove={canRemove}
    />
  );

  const saveOverride = async () => {
    if (!overrideDraft.date) return;
    setBusy(true);
    try {
      await upsertAvailabilityOverride(companyId, null, overrideDraft);
      setOverrideDraft({ date: '', unavailable: false, periods: [emptyPeriod()] });
      setOk(t('availability.dateOverrideSaved'));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveVacation = async () => {
    if (!vacationDraft.startDate || !vacationDraft.endDate) return;
    setBusy(true);
    try {
      await upsertVacation(companyId, null, vacationDraft);
      setVacationDraft(emptyVacationDraft(t));
      setOk(t('availability.vacationSaved'));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveBlock = async () => {
    if (!blockDraft.date) return;
    setBusy(true);
    try {
      const startAt = new Date(`${blockDraft.date}T${blockDraft.start}:00`);
      const endAt = new Date(`${blockDraft.date}T${blockDraft.end}:00`);
      await upsertBlockedPeriod(companyId, null, { startAt, endAt, label: blockDraft.label });
      setBlockDraft(emptyBlockDraft(t));
      setOk(t('availability.blockedTimeSaved'));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pp-availScheduler">
      {err ? <div className="pp-error">{err}</div> : null}
      {ok ? <div className="pp-success">{ok}</div> : null}

      <div className="pp-availScheduler__tabs" role="tablist">
        {[
          ['weekly', t('availability.weeklyScheduleTab')],
          ['overrides', t('availability.overridesTimeOffTab')],
          ['settings', t('availability.bookingRulesTab')],
        ].map(([id, label]) => (
          <button key={id} type="button" className={panel === id ? 'is-active' : ''} onClick={() => setPanel(id)}>
            {label}
          </button>
        ))}
      </div>

      <PreviewCalendar days={previewDays} t={t} language={language} weekdayLabels={previewWeekdayLabels} />

      {panel === 'weekly' ? (
        <section className="pp-card pp-pad">
          <h3 className="pp-sectionTitle">{t('availability.weeklyRecurringScheduleTitle')}</h3>

          <label className="pp-field">
            <span className="pp-field__label">{t('availability.serviceOptionalLabel')}</span>
            <select
              className="pp-input"
              value={weeklyDraft.serviceId || ''}
              onChange={(e) => setWeeklyDraft((d) => ({ ...d, serviceId: e.target.value || null }))}
            >
              <option value="">{t('availability.allServicesDefault')}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          {employees.length ? (
            <label className="pp-field">
              <span className="pp-field__label">{t('availability.staffMemberOptionalLabel')}</span>
              <select
                className="pp-input"
                value={weeklyDraft.employeeId || ''}
                onChange={(e) => setWeeklyDraft((d) => ({ ...d, employeeId: e.target.value || null }))}
              >
                <option value="">{t('availability.anyStaff')}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="pp-field pp-availWeekdayField">
            <div className="pp-providerWeekdayToggle">
              {weekdayButtonLabels.map(({ dow, label }) => (
                <button
                  key={dow}
                  type="button"
                  className={weeklyDraft.daysOfWeek?.includes(dow) ? 'is-active' : ''}
                  onClick={() => toggleWeeklyDay(dow)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pp-field">
            <span className="pp-field__label">{t('availability.workingPeriodsLabel')}</span>
            {(weeklyDraft.periods || []).map((p, idx) => (
              <AvailTimeRange
                key={`period-${idx}`}
                startTime={p.startTime}
                endTime={p.endTime}
                canRemove={(weeklyDraft.periods || []).length > 1}
                onStartChange={(v) => setWeeklyDraft((d) => {
                  const periods = [...d.periods];
                  periods[idx] = { ...periods[idx], startTime: v };
                  return { ...d, periods };
                })}
                onEndChange={(v) => setWeeklyDraft((d) => {
                  const periods = [...d.periods];
                  periods[idx] = { ...periods[idx], endTime: v };
                  return { ...d, periods };
                })}
                onRemove={() => removePeriod(idx)}
              />
            ))}
            <button type="button" className="pp-btn pp-btn--ghost" onClick={addPeriod}>+ {t('availability.addPeriod')}</button>
          </div>

          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{t('availability.effectiveLabel')}</span>
              <select
                className="pp-input"
                value={weeklyDraft.effectiveMode || EFFECTIVE_MODES.FOREVER}
                onChange={(e) => setWeeklyDraft((d) => ({ ...d, effectiveMode: e.target.value }))}
              >
                <option value={EFFECTIVE_MODES.FOREVER}>{t('availability.forever')}</option>
                <option value={EFFECTIVE_MODES.UNTIL}>{t('availability.untilDate')}</option>
                <option value={EFFECTIVE_MODES.RANGE}>{t('availability.dateRange')}</option>
              </select>
            </label>
            {weeklyDraft.effectiveMode === EFFECTIVE_MODES.UNTIL ? (
              <label className="pp-field">
                <span className="pp-field__label">{t('availability.untilLabel')}</span>
                <input
                  className="pp-input"
                  type="date"
                  value={weeklyDraft.effectiveTo || ''}
                  onChange={(e) => setWeeklyDraft((d) => ({ ...d, effectiveTo: e.target.value }))}
                />
              </label>
            ) : null}
            {weeklyDraft.effectiveMode === EFFECTIVE_MODES.RANGE ? (
              <>
                <label className="pp-field">
                  <span className="pp-field__label">{t('availability.fromLabel')}</span>
                  <input className="pp-input" type="date" value={weeklyDraft.effectiveFrom || ''} onChange={(e) => setWeeklyDraft((d) => ({ ...d, effectiveFrom: e.target.value }))} />
                </label>
                <label className="pp-field">
                  <span className="pp-field__label">{t('availability.toLabel')}</span>
                  <input className="pp-input" type="date" value={weeklyDraft.effectiveTo || ''} onChange={(e) => setWeeklyDraft((d) => ({ ...d, effectiveTo: e.target.value }))} />
                </label>
              </>
            ) : null}
          </div>

          <button type="button" className="pp-btn pp-btn--primary" disabled={busy} onClick={() => void saveWeeklyRule()}>
            {busy ? t('availability.saving') : t('availability.saveWeeklySchedule')}
          </button>
        </section>
      ) : null}

      {panel === 'overrides' ? (
        <div className="pp-stack">
          <section className="pp-card pp-pad">
            <h3 className="pp-sectionTitle">{t('availability.dateOverrideTitle')}</h3>
            <div className="pp-modalGrid2">
              <label className="pp-field">
                <span className="pp-field__label">{t('availability.dateLabel')}</span>
                <input className="pp-input" type="date" value={overrideDraft.date} onChange={(e) => setOverrideDraft((d) => ({ ...d, date: e.target.value }))} />
              </label>
              <label className="pp-field pp-field--checkbox" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={overrideDraft.unavailable} onChange={(e) => setOverrideDraft((d) => ({ ...d, unavailable: e.target.checked }))} />
                <span>{t('availability.unavailableAllDay')}</span>
              </label>
            </div>
            {!overrideDraft.unavailable ? (
              <AvailTimeRange
                startTime={overrideDraft.periods[0].startTime}
                endTime={overrideDraft.periods[0].endTime}
                onStartChange={(v) => setOverrideDraft((d) => ({ ...d, periods: [{ ...d.periods[0], startTime: v }] }))}
                onEndChange={(v) => setOverrideDraft((d) => ({ ...d, periods: [{ ...d.periods[0], endTime: v }] }))}
              />
            ) : null}
            <div className="pp-availFormActions">
              <button type="button" className="pp-btn pp-btn--primary" disabled={busy} onClick={() => void saveOverride()}>
                {busy ? t('availability.saving') : t('common.save')}
              </button>
            </div>
            {overrides.length ? (
              <ul className="pp-availList">
                {overrides.map((o) => (
                  <li key={o.id}>
                    <span>{o.date} — {o.unavailable ? t('availability.previewClosed') : `${o.periods?.[0]?.startTime}-${o.periods?.[0]?.endTime}`}</span>
                    <button type="button" className="pp-link" onClick={() => void deleteAvailabilityOverride(companyId, o.id)}>{t('availability.removeLabel')}</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="pp-card pp-pad">
            <h3 className="pp-sectionTitle">{t('availability.vacationTimeOffTitle')}</h3>
            <div className="pp-modalGrid2">
              <label className="pp-field"><span className="pp-field__label">{t('availability.startLabel')}</span><input className="pp-input" type="date" value={vacationDraft.startDate} onChange={(e) => setVacationDraft((d) => ({ ...d, startDate: e.target.value }))} /></label>
              <label className="pp-field"><span className="pp-field__label">{t('availability.endLabel')}</span><input className="pp-input" type="date" value={vacationDraft.endDate} onChange={(e) => setVacationDraft((d) => ({ ...d, endDate: e.target.value }))} /></label>
            </div>
            <button type="button" className="pp-btn pp-btn--primary" disabled={busy} onClick={() => void saveVacation()}>
              {busy ? t('availability.saving') : t('common.save')}
            </button>
            {vacations.length ? (
              <ul className="pp-availList">
                {vacations.map((v) => (
                  <li key={v.id}><span>{v.startDate} – {v.endDate}</span><button type="button" className="pp-link" onClick={() => void deleteVacation(companyId, v.id)}>{t('availability.removeLabel')}</button></li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="pp-card pp-pad">
            <h3 className="pp-sectionTitle">{t('availability.blockedTimeTitle')}</h3>
            <div className="pp-modalGrid2">
              <label className="pp-field"><span className="pp-field__label">{t('availability.dateLabel')}</span><input className="pp-input" type="date" value={blockDraft.date} onChange={(e) => setBlockDraft((d) => ({ ...d, date: e.target.value }))} /></label>
            </div>
            <TimeRangeRow
              startTime={blockDraft.start}
              endTime={blockDraft.end}
              onStartChange={(v) => setBlockDraft((d) => ({ ...d, start: v }))}
              onEndChange={(v) => setBlockDraft((d) => ({ ...d, end: v }))}
            />
            <div className="pp-availFormActions">
              <button type="button" className="pp-btn pp-btn--primary" disabled={busy} onClick={() => void saveBlock()}>
                {busy ? t('availability.saving') : t('common.save')}
              </button>
            </div>
            {blocked.length ? (
              <ul className="pp-availList">
                {blocked.map((b) => (
                  <li key={b.id}><span>{b.label || t('availability.blockedFallbackLabel')}</span><button type="button" className="pp-link" onClick={() => void deleteBlockedPeriod(companyId, b.id)}>{t('availability.removeLabel')}</button></li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      ) : null}

      {panel === 'settings' ? (
        <section className="pp-card pp-pad">
          <h3 className="pp-sectionTitle">{t('availability.bookingRulesTab')}</h3>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">{t('availability.timezoneLabel')}</span>
              <input className="pp-input" value={settings.timezone || 'Europe/Nicosia'} onChange={(e) => void saveSettings({ timezone: e.target.value })} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('availability.publicHolidaysLabel')}</span>
              <select className="pp-input" value={settings.holidayCountry || 'CY'} onChange={(e) => void saveSettings({ holidayCountry: e.target.value })}>
                {HOLIDAY_COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('availability.holidayModeLabel')}</span>
              <select className="pp-input" value={settings.holidayMode || HOLIDAY_MODES.CLOSED} onChange={(e) => void saveSettings({ holidayMode: e.target.value })}>
                <option value={HOLIDAY_MODES.IGNORE}>{t('availability.ignoreHolidays')}</option>
                <option value={HOLIDAY_MODES.CLOSED}>{t('availability.closedOnHolidays')}</option>
              </select>
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('availability.advanceNoticeMinutesLabel')}</span>
              <NumericSettingInput
                value={settings.advanceNoticeMin ?? 120}
                min={0}
                onCommit={(n) => void saveSettings({ advanceNoticeMin: n })}
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('availability.maxBookingWindowDaysLabel')}</span>
              <NumericSettingInput
                value={settings.maxBookingDaysAhead ?? 90}
                min={1}
                onCommit={(n) => void saveSettings({ maxBookingDaysAhead: n })}
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('availability.bufferBeforeMinutesLabel')}</span>
              <NumericSettingInput
                value={settings.bufferBeforeMin ?? 0}
                min={0}
                onCommit={(n) => void saveSettings({ bufferBeforeMin: n })}
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('availability.bufferAfterMinutesLabel')}</span>
              <NumericSettingInput
                value={settings.bufferAfterMin ?? 0}
                min={0}
                onCommit={(n) => void saveSettings({ bufferAfterMin: n })}
              />
            </label>
          </div>
          <p className="pp-muted" style={{ marginTop: 10 }}>
            {t('availability.slotsCalculatedHint')}
            {employees.length ? ` ${t('availability.staffConfiguredCount', { count: employees.length })}` : ''}
          </p>
        </section>
      ) : null}
    </div>
  );
}
