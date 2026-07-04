import React, { useEffect, useMemo, useState } from 'react';
import TimeInput24 from '../../components/TimeInput24';
import { dateKey, monthDays, WEEKDAY_LABELS_MON_START } from '../bookingHeatMap';
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
  deleteAvailabilityRule,
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
import { formatYmdInZone } from './timezoneUtils';

const WEEKDAYS = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 0, label: 'Sun' },
];

function emptyPeriod() {
  return { startTime: '09:00', endTime: '17:00' };
}

function PreviewCalendar({ days }) {
  const anchor = useMemo(() => {
    const keys = Object.keys(days || {}).sort();
    if (!keys.length) return new Date();
    const parsed = new Date(`${keys[0]}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [days]);

  const monthGrid = useMemo(() => monthDays(anchor), [anchor]);
  const visibleMonth = anchor.getMonth();
  const monthLabel = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="pp-availPreviewWrap">
      <div className="pp-availPreview__head">
        <strong className="pp-availPreview__title">{monthLabel}</strong>
        <span className="pp-availPreview__subtitle">Schedule preview from today</span>
      </div>
      <div className="pp-availPreviewWeekdays" aria-hidden>
        {WEEKDAY_LABELS_MON_START.map((label, idx) => (
          <span key={`${label}-${idx}`} className="pp-availPreview__weekday">
            {label}
          </span>
        ))}
      </div>
      <div className="pp-availPreview" aria-label="Schedule preview">
        {monthGrid.map((day) => {
          const key = dateKey(day);
          const inMonth = day.getMonth() === visibleMonth;
          const status = days?.[key] || 'closed';
          if (!inMonth) {
            return <span key={key} className="pp-availPreview__day is-outside" aria-hidden />;
          }
          return (
            <span key={key} className={`pp-availPreview__day is-${status}`} title={`${key}: ${status}`}>
              {day.getDate()}
            </span>
          );
        })}
        <div className="pp-availPreview__legend">
          <span className="is-working">Working</span>
          <span className="is-override">Override</span>
          <span className="is-vacation">Time off</span>
          <span className="is-holiday">Holiday</span>
        </div>
      </div>
    </div>
  );
}

export default function AvailabilityScheduler({ companyId, services = [], settings: initialSettings, onSettingsChange }) {
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
  const [vacationDraft, setVacationDraft] = useState({ startDate: '', endDate: '', label: 'Vacation' });
  const [blockDraft, setBlockDraft] = useState({ date: '', start: '13:00', end: '14:30', label: 'Break' });

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
        (e) => setErr(e?.message || 'failed')
      ),
    [companyId]
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
      setOk('Weekly schedule saved.');
    } catch (e) {
      setErr(e?.message || 'failed');
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
    <div className="pp-availTimeRow">
      <label className="pp-field pp-availTimeRow__field pp-availTimeRow__field--labelOnly">
        <span className="pp-field__label">From</span>
      </label>
      <div className="pp-availTimeRow__field pp-availTimeRow__field--time">
        <TimeInput24 value={startTime} onChange={onStartChange} aria-label="Start time" />
      </div>
      <span className="pp-availTimeRow__sep" aria-hidden>→</span>
      <div className="pp-availTimeRow__field pp-availTimeRow__field--time">
        <TimeInput24 value={endTime} onChange={onEndChange} aria-label="End time" />
      </div>
      <label className="pp-field pp-availTimeRow__field pp-availTimeRow__field--labelOnly">
        <span className="pp-field__label">To</span>
      </label>
      {canRemove ? (
        <button type="button" className="pp-availTimeRow__remove" aria-label="Remove period" onClick={onRemove}>
          ×
        </button>
      ) : null}
    </div>
  );

  const saveOverride = async () => {
    if (!overrideDraft.date) return;
    setBusy(true);
    try {
      await upsertAvailabilityOverride(companyId, null, overrideDraft);
      setOverrideDraft({ date: '', unavailable: false, periods: [emptyPeriod()] });
      setOk('Date override saved.');
    } catch (e) {
      setErr(e?.message || 'failed');
    } finally {
      setBusy(false);
    }
  };

  const saveVacation = async () => {
    if (!vacationDraft.startDate || !vacationDraft.endDate) return;
    setBusy(true);
    try {
      await upsertVacation(companyId, null, vacationDraft);
      setVacationDraft({ startDate: '', endDate: '', label: 'Vacation' });
      setOk('Vacation saved.');
    } catch (e) {
      setErr(e?.message || 'failed');
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
      setOk('Blocked time saved.');
    } catch (e) {
      setErr(e?.message || 'failed');
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
          ['weekly', 'Weekly schedule'],
          ['overrides', 'Overrides & time off'],
          ['settings', 'Booking rules'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={panel === id ? 'is-active' : ''} onClick={() => setPanel(id)}>
            {label}
          </button>
        ))}
      </div>

      <PreviewCalendar days={previewDays} />

      {panel === 'weekly' ? (
        <section className="pp-card pp-pad">
          <h3 className="pp-sectionTitle">Weekly recurring schedule</h3>

          <label className="pp-field">
            <span className="pp-field__label">Service (optional)</span>
            <select
              className="pp-input"
              value={weeklyDraft.serviceId || ''}
              onChange={(e) => setWeeklyDraft((d) => ({ ...d, serviceId: e.target.value || null }))}
            >
              <option value="">All services (default)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          {employees.length ? (
            <label className="pp-field">
              <span className="pp-field__label">Staff member (optional)</span>
              <select
                className="pp-input"
                value={weeklyDraft.employeeId || ''}
                onChange={(e) => setWeeklyDraft((d) => ({ ...d, employeeId: e.target.value || null }))}
              >
                <option value="">Any staff</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="pp-field pp-availWeekdayField">
            <div className="pp-providerWeekdayToggle">
              {WEEKDAYS.map(({ dow, label }) => (
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
            <span className="pp-field__label">Working periods</span>
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
            <button type="button" className="pp-btn pp-btn--ghost" onClick={addPeriod}>+ Add period</button>
          </div>

          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">Effective</span>
              <select
                className="pp-input"
                value={weeklyDraft.effectiveMode || EFFECTIVE_MODES.FOREVER}
                onChange={(e) => setWeeklyDraft((d) => ({ ...d, effectiveMode: e.target.value }))}
              >
                <option value={EFFECTIVE_MODES.FOREVER}>Forever</option>
                <option value={EFFECTIVE_MODES.UNTIL}>Until date</option>
                <option value={EFFECTIVE_MODES.RANGE}>Date range</option>
              </select>
            </label>
            {weeklyDraft.effectiveMode === EFFECTIVE_MODES.UNTIL ? (
              <label className="pp-field">
                <span className="pp-field__label">Until</span>
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
                  <span className="pp-field__label">From</span>
                  <input className="pp-input" type="date" value={weeklyDraft.effectiveFrom || ''} onChange={(e) => setWeeklyDraft((d) => ({ ...d, effectiveFrom: e.target.value }))} />
                </label>
                <label className="pp-field">
                  <span className="pp-field__label">To</span>
                  <input className="pp-input" type="date" value={weeklyDraft.effectiveTo || ''} onChange={(e) => setWeeklyDraft((d) => ({ ...d, effectiveTo: e.target.value }))} />
                </label>
              </>
            ) : null}
          </div>

          <button type="button" className="pp-btn pp-btn--primary" disabled={busy} onClick={() => void saveWeeklyRule()}>
            {busy ? 'Saving…' : 'Save weekly schedule'}
          </button>
        </section>
      ) : null}

      {panel === 'overrides' ? (
        <div className="pp-stack">
          <section className="pp-card pp-pad">
            <h3 className="pp-sectionTitle">Date override</h3>
            <div className="pp-modalGrid2">
              <label className="pp-field">
                <span className="pp-field__label">Date</span>
                <input className="pp-input" type="date" value={overrideDraft.date} onChange={(e) => setOverrideDraft((d) => ({ ...d, date: e.target.value }))} />
              </label>
              <label className="pp-field pp-field--checkbox" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={overrideDraft.unavailable} onChange={(e) => setOverrideDraft((d) => ({ ...d, unavailable: e.target.checked }))} />
                <span>Unavailable all day</span>
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
              <button type="button" className="pp-btn pp-btn--primary" disabled={busy} onClick={() => void saveOverride()}>Save override</button>
            </div>
            {overrides.length ? (
              <ul className="pp-availList">
                {overrides.map((o) => (
                  <li key={o.id}>
                    <span>{o.date} — {o.unavailable ? 'Closed' : `${o.periods?.[0]?.startTime}-${o.periods?.[0]?.endTime}`}</span>
                    <button type="button" className="pp-link" onClick={() => void deleteAvailabilityOverride(companyId, o.id)}>Remove</button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="pp-card pp-pad">
            <h3 className="pp-sectionTitle">Vacation / time off</h3>
            <div className="pp-modalGrid2">
              <label className="pp-field"><span className="pp-field__label">Start</span><input className="pp-input" type="date" value={vacationDraft.startDate} onChange={(e) => setVacationDraft((d) => ({ ...d, startDate: e.target.value }))} /></label>
              <label className="pp-field"><span className="pp-field__label">End</span><input className="pp-input" type="date" value={vacationDraft.endDate} onChange={(e) => setVacationDraft((d) => ({ ...d, endDate: e.target.value }))} /></label>
            </div>
            <button type="button" className="pp-btn pp-btn--primary" disabled={busy} onClick={() => void saveVacation()}>Save vacation</button>
            {vacations.length ? (
              <ul className="pp-availList">
                {vacations.map((v) => (
                  <li key={v.id}><span>{v.startDate} – {v.endDate}</span><button type="button" className="pp-link" onClick={() => void deleteVacation(companyId, v.id)}>Remove</button></li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="pp-card pp-pad">
            <h3 className="pp-sectionTitle">Blocked time</h3>
            <div className="pp-modalGrid2">
              <label className="pp-field"><span className="pp-field__label">Date</span><input className="pp-input" type="date" value={blockDraft.date} onChange={(e) => setBlockDraft((d) => ({ ...d, date: e.target.value }))} /></label>
            </div>
            <div className="pp-availTimeRow">
              <label className="pp-field pp-availTimeRow__field pp-availTimeRow__field--labelOnly">
                <span className="pp-field__label">From</span>
              </label>
              <div className="pp-availTimeRow__field pp-availTimeRow__field--time">
                <TimeInput24 value={blockDraft.start} onChange={(v) => setBlockDraft((d) => ({ ...d, start: v }))} aria-label="Block start time" />
              </div>
              <span className="pp-availTimeRow__sep" aria-hidden>→</span>
              <div className="pp-availTimeRow__field pp-availTimeRow__field--time">
                <TimeInput24 value={blockDraft.end} onChange={(v) => setBlockDraft((d) => ({ ...d, end: v }))} aria-label="Block end time" />
              </div>
              <label className="pp-field pp-availTimeRow__field pp-availTimeRow__field--labelOnly">
                <span className="pp-field__label">To</span>
              </label>
            </div>
            <div className="pp-availFormActions">
              <button type="button" className="pp-btn pp-btn--primary" disabled={busy} onClick={() => void saveBlock()}>Save blocked time</button>
            </div>
            {blocked.length ? (
              <ul className="pp-availList">
                {blocked.map((b) => (
                  <li key={b.id}><span>{b.label || 'Blocked'}</span><button type="button" className="pp-link" onClick={() => void deleteBlockedPeriod(companyId, b.id)}>Remove</button></li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      ) : null}

      {panel === 'settings' ? (
        <section className="pp-card pp-pad">
          <h3 className="pp-sectionTitle">Booking rules</h3>
          <div className="pp-modalGrid2">
            <label className="pp-field">
              <span className="pp-field__label">Timezone</span>
              <input className="pp-input" value={settings.timezone || 'Europe/Nicosia'} onChange={(e) => void saveSettings({ timezone: e.target.value })} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Public holidays</span>
              <select className="pp-input" value={settings.holidayCountry || 'CY'} onChange={(e) => void saveSettings({ holidayCountry: e.target.value })}>
                {HOLIDAY_COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Holiday mode</span>
              <select className="pp-input" value={settings.holidayMode || HOLIDAY_MODES.CLOSED} onChange={(e) => void saveSettings({ holidayMode: e.target.value })}>
                <option value={HOLIDAY_MODES.IGNORE}>Ignore holidays</option>
                <option value={HOLIDAY_MODES.CLOSED}>Closed on holidays</option>
              </select>
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Advance notice (minutes)</span>
              <input className="pp-input" type="number" min={0} value={settings.advanceNoticeMin ?? 120} onChange={(e) => void saveSettings({ advanceNoticeMin: Number(e.target.value) })} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Max booking window (days)</span>
              <input className="pp-input" type="number" min={1} value={settings.maxBookingDaysAhead ?? 90} onChange={(e) => void saveSettings({ maxBookingDaysAhead: Number(e.target.value) })} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Buffer before (min)</span>
              <input className="pp-input" type="number" min={0} value={settings.bufferBeforeMin ?? 0} onChange={(e) => void saveSettings({ bufferBeforeMin: Number(e.target.value) })} />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">Buffer after (min)</span>
              <input className="pp-input" type="number" min={0} value={settings.bufferAfterMin ?? 0} onChange={(e) => void saveSettings({ bufferAfterMin: Number(e.target.value) })} />
            </label>
          </div>
          <p className="pp-muted" style={{ marginTop: 10 }}>
            Slots are calculated from your rules when customers book — no need to pre-create every time slot.
            {employees.length ? ` ${employees.length} staff members configured.` : ''}
          </p>
        </section>
      ) : null}
    </div>
  );
}
