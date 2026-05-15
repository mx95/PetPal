import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import PetAvatar from '../components/PetAvatar';
import PositionMap from '../tracking/PositionMap';
import { usePets } from '../pets/PetsContext';
import { getLatestPosition, getPositionHistory, getTrackingDataSource, mapsLink } from '../tracking/petpalVendorClient';

const LAST_LIVE_PET_KEY = 'petpal_live_selectedPetId';

function timeLocaleTag(lang) {
  if (lang === 'el') return 'el';
  if (lang === 'ru') return 'ru';
  return 'en-GB';
}

function formatTime(iso, lang) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(timeLocaleTag(lang), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return String(iso);
  }
}

const MIN = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/** Relative “last update”: seconds → minutes → hours → days → weeks → months */
function formatLastSeen(secondsAgo, t) {
  if (secondsAgo == null || !Number.isFinite(secondsAgo)) return t('trackingPage.lastUpdateUnknown');
  const s = Math.max(0, secondsAgo);
  if (s < 60) return t('trackingPage.lastUpdateSeconds', { seconds: Math.max(0, Math.round(s)) });
  if (s < HOUR) return t('trackingPage.lastUpdateMinutes', { minutes: Math.max(1, Math.floor(s / MIN)) });
  if (s < DAY) {
    const hours = Math.max(1, Math.floor(s / HOUR));
    return t('trackingPage.lastUpdateHours', { hours });
  }
  if (s < WEEK) {
    const n = Math.max(1, Math.floor(s / DAY));
    const unit = n === 1 ? t('trackingPage.timeUnitDay') : t('trackingPage.timeUnitDays');
    return t('trackingPage.lastUpdateDays', { n, unit });
  }
  if (s < 4 * WEEK) {
    const n = Math.max(1, Math.floor(s / WEEK));
    const unit = n === 1 ? t('trackingPage.timeUnitWeek') : t('trackingPage.timeUnitWeeks');
    return t('trackingPage.lastUpdateWeeks', { n, unit });
  }
  if (s < 365 * DAY) {
    const n = Math.max(1, Math.floor(s / MONTH));
    const unit = n === 1 ? t('trackingPage.timeUnitMonth') : t('trackingPage.timeUnitMonths');
    return t('trackingPage.lastUpdateMonths', { n, unit });
  }
  const months = Math.floor(s / MONTH);
  return t('trackingPage.lastUpdateMonthsLong', { months: Math.max(12, months) });
}

function batteryFillStyle(pct) {
  const n = Math.min(100, Math.max(0, pct));
  let fill;
  if (n > 60) fill = 'linear-gradient(90deg,#22c55e,#4ade80)';
  else if (n > 30) fill = 'linear-gradient(90deg,#eab308,#facc15)';
  else fill = 'linear-gradient(90deg,#f97316,#ef4444)';
  return { width: `${n}%`, background: fill };
}

function hasDiagnostics(position) {
  return Boolean(position?.diagnostics?.received || position?.diagnostics?.raw);
}

function accuracyMeterStyle(position) {
  const approx = position?.warningApproximate || position?.accuracy === 'low' || position?.source === 'lbs';
  const stale = Boolean(position?.warningStale);
  const lbs = position?.source === 'lbs';
  if (stale) {
    return { width: '24%', background: 'linear-gradient(90deg,#fb923c,#dc2626)' };
  }
  if (lbs) {
    return { width: '38%', background: 'linear-gradient(90deg,#f97316,#ea580c)' };
  }
  if (approx) {
    return { width: '58%', background: 'linear-gradient(90deg,#eab308,#f59e0b)' };
  }
  return { width: '96%', background: 'linear-gradient(90deg,#22c55e,#86efac)' };
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateInputValue(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function kmBetween(a, b) {
  if (!a || !b) return 0;
  const toRad = (v) => (v * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function movementType(point, prev) {
  if (!prev) return 'start';
  const speed = Number(point.speed || 0);
  if (speed < 0.5) return 'rest';
  if (speed > 4) return 'movement';
  return 'walk';
}

function pointTime(point) {
  return new Date(point.timestamp).getTime();
}

function defaultHistoryDayTimes() {
  return { timeFrom: '00:00', timeTo: '23:59' };
}

function isTrustedGpsFix(p) {
  if (!p) return true;
  const src = String(p.source || '').toLowerCase();
  if (src === 'lbs') return false;
  const acc = String(p.accuracy || '').toLowerCase();
  if (acc === 'lbs' || acc === 'wifi') return false;
  if (p.gpsValid === false) return false;
  return true;
}

/**
 * LBS / Wi-Fi / triangulated fixes: keep timestamps and metadata but reuse the last real GPS
 * coordinates so distance, map path, and timeline do not jump to cell-tower positions.
 */
function resolveNonGpsHistoryPoints(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  let lastLat = null;
  let lastLng = null;
  const out = [];
  for (const p of points) {
    if (!p || Number.isNaN(Number(p.lat)) || Number.isNaN(Number(p.lng))) continue;
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (isTrustedGpsFix(p)) {
      lastLat = lat;
      lastLng = lng;
      out.push({ ...p, lat, lng });
      continue;
    }
    if (lastLat != null && lastLng != null) {
      out.push({
        ...p,
        lat: lastLat,
        lng: lastLng,
        positionHeldFromPreviousGps: true,
      });
    }
  }
  return out;
}

function inDailyLocalTimeWindow(iso, range) {
  const timeFrom = range?.timeFrom || '00:00';
  const timeTo = range?.timeTo || '23:59';
  const parseHm = (str) => {
    const m = String(str || '00:00').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return { h: 0, min: 0, sec: 0 };
    const h = Math.min(23, Math.max(0, Number(m[1]) || 0));
    const min = Math.min(59, Math.max(0, Number(m[2]) || 0));
    const sec = m[3] != null ? Math.min(59, Math.max(0, Number(m[3]) || 0)) : 0;
    return { h, min, sec };
  };
  let ts;
  try {
    ts = new Date(iso).getTime();
  } catch {
    return true;
  }
  if (!Number.isFinite(ts)) return true;
  const d = new Date(ts);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const a = parseHm(timeFrom);
  const b = parseHm(timeTo);
  const winStart = new Date(startOfDay);
  winStart.setHours(a.h, a.min, a.sec, 0);
  const winEnd = new Date(startOfDay);
  winEnd.setHours(b.h, b.min, b.sec, 999);
  if (winStart.getTime() > winEnd.getTime()) {
    return d.getTime() >= winStart.getTime() || d.getTime() <= winEnd.getTime();
  }
  return d.getTime() >= winStart.getTime() && d.getTime() <= winEnd.getTime();
}

function historyRangeToIsoBounds(range) {
  if (!range?.from || !range?.to) return {};
  const fromMs = new Date(`${range.from}T00:00:00`).getTime();
  const toMs = new Date(`${range.to}T23:59:59.999`).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return {};
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() };
}

function filterHistoryPoints(points, range) {
  const now = Date.now();
  const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : 0;
  const to = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : now;
  return points.filter((p) => {
    const ts = pointTime(p);
    if (!Number.isFinite(ts) || ts < from || ts > to) return false;
    return inDailyLocalTimeWindow(p.timestamp, range);
  });
}

/** Initial / preset date span for the History tab (inclusive). */
function computeHistoryRangeForPreset(preset) {
  const times = defaultHistoryDayTimes();
  const today = startOfDay(new Date());
  if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    const value = dateInputValue(y);
    return { preset, from: value, to: value, ...times };
  }
  if (preset === '7d') {
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    return { preset, from: dateInputValue(from), to: dateInputValue(today), ...times };
  }
  if (preset === '30d') {
    const from = new Date(today);
    from.setDate(today.getDate() - 29);
    return { preset, from: dateInputValue(from), to: dateInputValue(today), ...times };
  }
  const value = dateInputValue(today);
  return { preset: 'today', from: value, to: value, ...times };
}

function buildHistoryAnalytics(points) {
  const distanceKm = points.reduce((sum, p, idx) => sum + (idx ? kmBetween(points[idx - 1], p) : 0), 0);
  const first = points[0] ? pointTime(points[0]) : 0;
  const last = points[points.length - 1] ? pointTime(points[points.length - 1]) : 0;
  const activeMinutes = first && last ? Math.max(0, Math.round((last - first) / 60000)) : 0;
  const speeds = points.map((p) => Number(p.speed)).filter((n) => Number.isFinite(n) && n > 0);
  return {
    distanceKm,
    activeMinutes,
    averageSpeed: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
    stops: points.filter((p, idx) => movementType(p, points[idx - 1]) === 'rest').length,
    events: points.length,
  };
}

function formatShortTime(iso, lang) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString(timeLocaleTag(lang), { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—';
  }
}

/** Same-location clusters longer than this use report count only (device timestamps often wrong). */
const STAY_DURATION_PLAUSIBLE_MAX_MIN = 48 * 60;

/**
 * Format a non-negative duration given in whole minutes (hours, days when needed).
 * @param {number} totalMinutes
 * @param {(key: string, vars?: Record<string, string | number>) => string} t
 */
function formatDurationMinutes(totalMinutes, t) {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '—';
  const wholeMin = Math.floor(totalMinutes);
  if (wholeMin < 1) {
    const sec = Math.max(0, Math.round(totalMinutes * 60));
    return t('trackingPage.durationSec', { n: sec });
  }
  const days = Math.floor(wholeMin / 1440);
  let rem = wholeMin % 1440;
  const hours = Math.floor(rem / 60);
  const minutes = rem % 60;
  if (days > 0) return t('trackingPage.durationDaysHoursMinutes', { days, hours, minutes });
  if (hours > 0) return t('trackingPage.durationHoursMinutes', { hours, minutes });
  return t('trackingPage.durationMinutesOnly', { minutes });
}

function mapRouteMarkerKindLabel(kind, t) {
  if (kind === 'start') return t('trackingPage.mapLabelStart');
  if (kind === 'end') return t('trackingPage.mapLabelEnd');
  if (kind === 'rest') return t('trackingPage.timelineResting');
  if (kind === 'movement') return t('trackingPage.timelineFastMovement');
  return t('trackingPage.timelineWalking');
}

function buildHistoryTimelineEvents(points, t, lang) {
  const sameLocationKm = 0.03;
  const events = [];
  let idx = 0;

  while (idx < points.length) {
    const start = points[idx];
    let endIndex = idx;

    while (endIndex + 1 < points.length && kmBetween(start, points[endIndex + 1]) <= sameLocationKm) {
      endIndex += 1;
    }

    const end = points[endIndex];
    const count = endIndex - idx + 1;
    const type = idx === 0 ? 'start' : count > 1 ? 'rest' : movementType(start, points[idx - 1]);
    const durationMin = Math.max(0, Math.round((pointTime(end) - pointTime(start)) / 60000));
    let label;
    if (count > 1) {
      if (durationMin > STAY_DURATION_PLAUSIBLE_MAX_MIN) {
        label = t('trackingPage.timelineStayReports', { count });
      } else {
        label =
          durationMin > 0
            ? t('trackingPage.timelineStayDuration', { duration: formatDurationMinutes(durationMin, t) })
            : t('trackingPage.timelineStayShort');
      }
    } else if (type === 'start') {
      label = t('trackingPage.timelineRouteStarted');
    } else if (type === 'movement') {
      label = t('trackingPage.timelineFastMovement');
    } else if (type === 'rest') {
      label = t('trackingPage.timelineResting');
    } else {
      label = t('trackingPage.timelineWalking');
    }

    events.push({
      id: `${start.id || idx}-${end.id || endIndex}`,
      start,
      end,
      startIndex: idx,
      endIndex,
      count,
      type,
      label,
      timeLabel:
        count > 1
          ? `${formatShortTime(start.timestamp, lang)} → ${formatShortTime(end.timestamp, lang)}`
          : formatShortTime(start.timestamp, lang),
    });

    idx = endIndex + 1;
  }

  return events;
}

export default function Tracking() {
  const { t, language } = useI18n();
  const fieldId = useId();
  const { pets, updatePet } = usePets();
  const dataSource = getTrackingDataSource();
  void dataSource;

  const [selectedPetId, setSelectedPetId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trackerTab, setTrackerTab] = useState('live');
  const [historyPoints, setHistoryPoints] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyRange, setHistoryRange] = useState(() => computeHistoryRangeForPreset('7d'));
  const [historyReloadTick, setHistoryReloadTick] = useState(0);
  const [historyPlaying, setHistoryPlaying] = useState(false);
  const [historySpeed, setHistorySpeed] = useState(1);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyCalendarMatch, setHistoryCalendarMatch] = useState(true);

  const selectedPet = useMemo(() => pets.find((p) => p.id === selectedPetId), [pets, selectedPetId]);

  /** Typed IMEI wins; otherwise use value saved on the pet (avoids empty requests if the field was cleared). */
  const effectiveDeviceId = useMemo(
    () => (deviceId.trim() || selectedPet?.trackingDeviceId?.trim() || ''),
    [deviceId, selectedPet?.trackingDeviceId]
  );

  const savedDeviceIdTrimmed = useMemo(() => (selectedPet?.trackingDeviceId || '').trim(), [selectedPet?.trackingDeviceId]);

  const imeiDirty = savedDeviceIdTrimmed !== deviceId.trim();

  useEffect(() => {
    if (pets.length === 0) {
      setSelectedPetId('');
      return;
    }
    setSelectedPetId((cur) => {
      try {
        const saved = localStorage.getItem(LAST_LIVE_PET_KEY);
        if (saved && pets.some((p) => p.id === saved)) return saved;
      } catch (_) {}
      if (cur && pets.some((p) => p.id === cur)) return cur;
      return pets[0].id;
    });
  }, [pets]);

  useEffect(() => {
    if (!selectedPetId) return;
    try {
      localStorage.setItem(LAST_LIVE_PET_KEY, selectedPetId);
    } catch (_) {}
  }, [selectedPetId]);

  useEffect(() => {
    if (!selectedPetId) {
      setDeviceId('');
      return;
    }
    const p = pets.find((x) => x.id === selectedPetId);
    setDeviceId(p?.trackingDeviceId || '');
  }, [selectedPetId, pets]);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const p = await getLatestPosition(effectiveDeviceId);
      setPosition(p);
    } catch (e) {
      setPosition(null);
      setError(e?.message || t('trackingPage.errLoadPosition'));
    } finally {
      setLoading(false);
    }
  }, [effectiveDeviceId, t]);

  useEffect(() => {
    if (!effectiveDeviceId.trim()) return;
    void refresh();
  }, [effectiveDeviceId, refresh]);

  useEffect(() => {
    if (!effectiveDeviceId) return;
    const ms = 12_000;
    const id = window.setInterval(() => {
      void refresh();
    }, ms);
    return () => window.clearInterval(id);
  }, [effectiveDeviceId, refresh]);

  useEffect(() => {
    if (trackerTab !== 'history' || !effectiveDeviceId) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    getPositionHistory(effectiveDeviceId, {
      limit: 20000,
      ...historyRangeToIsoBounds(historyRange),
    })
      .then(({ history, calendarMatch }) => {
        if (cancelled) return;
        setHistoryPoints(history);
        setHistoryCalendarMatch(calendarMatch !== false);
        setHistoryIndex(0);
      })
      .catch((e) => {
        if (cancelled) return;
        setHistoryPoints([]);
        setHistoryError(e?.message || 'Could not load tracker history.');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trackerTab, effectiveDeviceId, historyReloadTick, historyRange.from, historyRange.to]);

  const resolvedHistory = useMemo(() => resolveNonGpsHistoryPoints(historyPoints), [historyPoints]);

  const filteredHistory = useMemo(() => {
    if (!historyCalendarMatch) return resolvedHistory;
    const filtered = filterHistoryPoints(resolvedHistory, historyRange);
    if (filtered.length === 0 && resolvedHistory.length > 0) return resolvedHistory;
    return filtered;
  }, [resolvedHistory, historyRange, historyCalendarMatch]);
  const historyAnalytics = useMemo(() => buildHistoryAnalytics(filteredHistory), [filteredHistory]);
  const historyMarkers = useMemo(() => {
    if (!filteredHistory.length) return [];
    return filteredHistory.map((p, idx) => {
      const kind = idx === 0 ? 'start' : idx === filteredHistory.length - 1 ? 'end' : movementType(p, filteredHistory[idx - 1]);
      return {
        id: p.id || `history-${idx}`,
        pointIndex: idx,
        lat: p.lat,
        lng: p.lng,
        kind,
        label: `${mapRouteMarkerKindLabel(kind, t)} · ${formatShortTime(p.timestamp, language)}`,
      };
    });
  }, [filteredHistory, t, language]);
  const historyTimelineEvents = useMemo(() => buildHistoryTimelineEvents(filteredHistory, t, language), [filteredHistory, t, language]);

  useEffect(() => {
    if (!historyPlaying || filteredHistory.length < 2) return undefined;
    const id = window.setInterval(() => {
      setHistoryIndex((idx) => {
        if (idx >= filteredHistory.length - 1) {
          setHistoryPlaying(false);
          return filteredHistory.length - 1;
        }
        return idx + 1;
      });
    }, Math.max(260, 1100 / historySpeed));
    return () => window.clearInterval(id);
  }, [historyPlaying, filteredHistory.length, historySpeed]);

  useEffect(() => {
    setHistoryIndex(0);
    setHistoryPlaying(false);
  }, [historyRange]);

  function applyHistoryPreset(preset) {
    setHistoryRange(computeHistoryRangeForPreset(preset));
  }

  function saveIdAndLoad(e) {
    e?.preventDefault();
    const next = deviceId.trim();
    const prev = savedDeviceIdTrimmed;

    if (prev && next && next !== prev) {
      if (!window.confirm(t('trackingPage.imeiConfirmChange', { from: prev, to: next }))) return;
    }
    if (prev && !next) {
      if (!window.confirm(t('trackingPage.imeiConfirmClear'))) return;
    }

    if (selectedPetId) {
      updatePet(selectedPetId, { trackingDeviceId: next || null });
    }
    void refresh();
  }

  if (pets.length === 0) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <div className="pp-card pp-pad" style={{ textAlign: 'center', padding: 28 }}>
            <div style={{ fontSize: 44 }} aria-hidden>
              🐾
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('trackingPage.emptyTitle')}
            </h1>
            <p className="pp-subtle" style={{ marginBottom: 16, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
              {t('trackingPage.emptyBody')}
            </p>
            <Link className="pp-btn pp-btnPrimary pp-btn--lg" to="/pets#add-pet" style={{ textDecoration: 'none', display: 'inline-block' }}>
              {t('trackingPage.myPetsCta')}
            </Link>
          </div>
        </div>
      </div>
    );
  }


  const signalLive = position != null;
  const hasCoordinates = position?.lat != null && position?.lng != null;
  const approx = position?.warningApproximate || position?.accuracy === 'low' || position?.source === 'lbs';
  const accuracyLabel = approx ? t('trackingPage.accuracyApprox') : t('trackingPage.accuracyHigh');
  const secondsAgo =
    typeof position?.secondsAgo === 'number' && Number.isFinite(position.secondsAgo) ? position.secondsAgo : null;
  const lastUpdateLabel = formatLastSeen(secondsAgo, t);

  const gpsOkVisual = hasCoordinates && !approx && position?.source !== 'lbs' && !position?.warningStale;

  const deviceTimeLabel = position?.deviceTimeLocal
    ? position.deviceTimeLocal
    : position?.deviceTime
      ? formatTime(position.deviceTime, language)
      : '—';

  const batPct = position?.battery != null ? Math.min(100, Math.max(0, Number(position.battery))) : null;

  const accMeter = position ? accuracyMeterStyle(position) : null;
  const locateAction = (
    <div className="pp-trackLocateInline">
      <button
        type="button"
        className="pp-btn pp-btnPrimary"
        disabled={loading || !effectiveDeviceId}
        onClick={() => void refresh()}
      >
        {t('trackingPage.btnLocate')}
      </button>
    </div>
  );

  return (
    <div className="pp-feed pp-tracker-page">
      <header className="pp-pageHeader">
        <div className="pp-pageHeader__copy">
          <span className="pp-publicHero__eyebrow" style={{ display: 'inline-block', width: 'fit-content' }}>
            {t('trackingPage.badgePetpal')}
          </span>
          <h1 className="pp-pageHeader__title">
            {selectedPet ? t('trackingPage.titleWithPet', { name: selectedPet.name }) : t('trackingPage.title')}
          </h1>
        </div>
        <Link className="pp-pageHeader__back" to="/dashboard">
          {t('common.backDashboard')}
        </Link>
      </header>

      <section className="pp-trackPetStrip" aria-label={t('trackingPage.petSelectLabel')}>
        <div className="pp-trackPetScroll">
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pp-trackPetCard ${selectedPetId === p.id ? 'pp-trackPetCard--on' : ''}`}
              onClick={() => setSelectedPetId(p.id)}
            >
              <PetAvatar pet={p} size={44} />
              <span className="pp-trackPetCard__name">{p.name}</span>
              <span className="pp-trackPetCard__chip">
                {p.trackingDeviceId ? t('trackingPage.deviceChip', { id: p.trackingDeviceId }) : t('trackingPage.noDeviceChip')}
              </span>
            </button>
          ))}
        </div>
      </section>

      <nav className="pp-trackTabs" aria-label="Tracker views">
        {[
          ['live', 'Live'],
          ['device', 'Device'],
          ['history', 'History'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={trackerTab === id ? 'is-active' : ''} onClick={() => setTrackerTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {selectedPet && trackerTab === 'live' ? (
        <section className="pp-card pp-pad" aria-label={selectedPet.name}>
          <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <div className="pp-row" style={{ alignItems: 'center', gap: 12 }}>
              <PetAvatar pet={selectedPet} size={56} />
              <div>
                <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
                  {selectedPet.name}
                </h2>
                <p className="pp-subtle" style={{ marginTop: 4, marginBottom: 0 }}>
                  {position?.statusText || (signalLive ? t('trackingPage.signalLive') : t('trackingPage.signalQuiet'))} ·{' '}
                  {lastUpdateLabel}
                </p>
              </div>
            </div>

            {locateAction}
          </div>

          {position ? (
            <div className="pp-trackStatusGrid">
              <article className="pp-card pp-trackStatCard">
                <div className="pp-label">{t('trackingPage.cardGps')}</div>
                <div className="pp-trackStatCard__body">
                  <span className={`pp-trackGpsPill ${gpsOkVisual ? 'pp-trackGpsPill--ok' : 'pp-trackGpsPill--warn'}`}>
                    {gpsOkVisual ? `✓ ${t('trackingPage.gpsOk')}` : `⚠ ${t('trackingPage.gpsWeak')}`}
                  </span>
                  <p className="pp-subtle pp-trackStatCard__meta">
                    {t('trackingPage.accuracyLabel', { value: accuracyLabel })}
                    {position?.warningStale ? ` · ${t('trackingPage.warnOffline')}` : ''}
                  </p>
                  {accMeter ? (
                    <div
                      className="pp-trackAccuracyMeter"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Number.parseInt(accMeter.width, 10)}
                      aria-label={t('trackingPage.accuracyMeterLabel')}
                    >
                      <div className="pp-trackAccuracyMeter__fill" style={{ width: accMeter.width, background: accMeter.background }} />
                    </div>
                  ) : null}
                </div>
              </article>

              <article className="pp-card pp-trackStatCard">
                <div className="pp-label">{t('trackingPage.cardHealth')}</div>
                <div className="pp-trackStatCard__body">
                  {batPct != null ? (
                    <div className="pp-batteryBar" aria-label={t('trackingPage.batteryPctAria', { pct: batPct })}>
                      <div className="pp-batteryBar__fill" style={batteryFillStyle(batPct)} />
                      <div className="pp-batteryBar__label">
                        {batPct}% · {position.batteryStatus || t('trackingPage.healthBattery')}
                      </div>
                    </div>
                  ) : (
                    <p className="pp-subtle pp-trackStatCard__meta">
                      {t('trackingPage.healthBattery')}: —
                    </p>
                  )}
                </div>
              </article>

              <article className="pp-card pp-trackStatCard">
                <div className="pp-label">{t('trackingPage.cardActivity')}</div>
                <div className="pp-trackStatCard__body">
                  <p className="pp-subtle pp-trackStatCard__meta">
                    {t('trackingPage.activitySteps')}: {position.steps ?? '—'}
                  </p>
                  <p className="pp-subtle pp-trackStatCard__meta">
                    {position.movementText || (position.isMoving ? t('trackingPage.moving') : t('trackingPage.notMoving'))}
                  </p>
                </div>
              </article>
            </div>
          ) : null}
        </section>
      ) : null}

      {trackerTab === 'live' ? (
      <section className="pp-card pp-pad pp-trackMapShell">
        <div className="pp-trackMapHead">
          <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
            {t('trackingPage.sectionMap')}
          </h2>
          {position && hasCoordinates ? (
            <a
              className="pp-btn pp-btn--ghost"
              href={mapsLink(position.lat, position.lng)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              {t('trackingPage.openGoogleMaps')}
            </a>
          ) : null}
        </div>
        {position && hasCoordinates ? (
          <>
            <div className="pp-trackMapFrame">
              <PositionMap lat={position.lat} lng={position.lng} />
            </div>
            <div className="pp-trackMapMeta">
              <span>
                {t('trackingPage.lblLatLng')}: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </span>
              {position.speed != null ? (
                <span>
                  {t('trackingPage.lblSpeed')}: {Number(position.speed).toFixed(1)} {t('trackingPage.speedUnitMs')}
                </span>
              ) : null}
              <span>
                {t('trackingPage.lblDeviceTime')}: {deviceTimeLabel}
              </span>
            </div>
          </>
        ) : (
          <div className="pp-trackMapEmpty pp-trackNoSignal">
            <div className="pp-trackNoSignal__icon" aria-hidden>
              <svg viewBox="0 0 48 48" width="42" height="42" fill="none">
                <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.09" />
                <path d="M14 26c5-5 15-5 20 0M18 31c3-3 9-3 12 0M22 36h4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M34 14 14 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h3>No live signal yet</h3>
            <p>
              {position ? 'Provider data arrived, but no GPS coordinates are available yet.' : error || 'This IMEI has not checked in on the tracker server yet.'}
            </p>
            <ul>
              <li>Check the SIM card is active</li>
              <li>Confirm the IMEI is correct</li>
              <li>Make sure the tracker is powered on and online</li>
            </ul>
            <div className="pp-trackNoSignal__actions">
              <button type="button" className="pp-btn pp-btnPrimary" disabled={loading || !effectiveDeviceId} onClick={() => void refresh()}>
                Retry
              </button>
              <Link className="pp-btn pp-btn--ghost" to="/admin/tracker">
                Setup guide
              </Link>
            </div>
          </div>
        )}
      </section>
      ) : null}

      {trackerTab === 'history' ? (
        <section className="pp-trackHistory">
          <div className="pp-card pp-pad pp-trackHistoryRangeCard">
            <div className="pp-trackHistoryRangeCard__head">
              <span className="pp-publicHero__eyebrow pp-trackHistoryRangeCard__eyebrow">{t('trackingPage.historyEyebrow')}</span>
              <h2 className="pp-trackHistoryRangeCard__title">{t('trackingPage.historyTitle')}</h2>
            </div>
            <div className="pp-trackHistoryPresets" role="group" aria-label={t('trackingPage.historyPresetsAria')}>
              {(
                [
                  ['today', 'presetToday'],
                  ['yesterday', 'presetYesterday'],
                  ['7d', 'preset7d'],
                ]
              ).map(([id, labelKey]) => (
                <button
                  key={id}
                  type="button"
                  className={`pp-trackHistoryPresetBtn ${historyRange.preset === id ? 'is-active' : ''}`}
                  onClick={() => applyHistoryPreset(id)}
                >
                  {t(`trackingPage.${labelKey}`)}
                </button>
              ))}
            </div>
            <div className="pp-trackHistoryManual" role="group" aria-label={t('trackingPage.historyManualAria')}>
              <div className="pp-trackHistoryManual__row">
                <span className="pp-trackHistoryManual__key">{t('trackingPage.historyFromLabel')}</span>
                <div className="pp-trackHistoryManual__pair">
                  <label className="pp-trackHistoryManual__field">
                    <input
                      type="date"
                      value={historyRange.from}
                      aria-label={t('trackingPage.historyFromDateAria')}
                      onChange={(e) => setHistoryRange((r) => ({ ...r, preset: 'custom', from: e.target.value }))}
                    />
                  </label>
                  <label className="pp-trackHistoryManual__field">
                    <input
                      type="time"
                      step={60}
                      value={historyRange.timeFrom ?? defaultHistoryDayTimes().timeFrom}
                      aria-label={t('trackingPage.historyFromTimeAria')}
                      onChange={(e) =>
                        setHistoryRange((r) => ({
                          ...r,
                          preset: 'custom',
                          timeFrom: e.target.value || defaultHistoryDayTimes().timeFrom,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="pp-trackHistoryManual__row">
                <span className="pp-trackHistoryManual__key">{t('trackingPage.historyToLabel')}</span>
                <div className="pp-trackHistoryManual__pair">
                  <label className="pp-trackHistoryManual__field">
                    <input
                      type="date"
                      value={historyRange.to}
                      aria-label={t('trackingPage.historyToDateAria')}
                      onChange={(e) => setHistoryRange((r) => ({ ...r, preset: 'custom', to: e.target.value }))}
                    />
                  </label>
                  <label className="pp-trackHistoryManual__field">
                    <input
                      type="time"
                      step={60}
                      value={historyRange.timeTo ?? defaultHistoryDayTimes().timeTo}
                      aria-label={t('trackingPage.historyToTimeAria')}
                      onChange={(e) =>
                        setHistoryRange((r) => ({
                          ...r,
                          preset: 'custom',
                          timeTo: e.target.value || defaultHistoryDayTimes().timeTo,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
            <p className="pp-subtle pp-trackHistoryRangeCard__hint">{t('trackingPage.historyRangeHint')}</p>
          </div>

          <div className="pp-trackHistoryLayout">
            <div className="pp-card pp-pad pp-trackHistoryMap">
              <div className="pp-trackHistoryMap__top">
                <div>
                  <h3>Route playback</h3>
                  <p>{historyLoading ? 'Loading route history…' : `${filteredHistory.length} location points`}</p>
                </div>
                <div className="pp-trackPlayback">
                  <button type="button" disabled={filteredHistory.length < 2} onClick={() => setHistoryPlaying((v) => !v)}>
                    {historyPlaying ? 'Pause' : 'Play route'}
                  </button>
                  <select value={historySpeed} onChange={(e) => setHistorySpeed(Number(e.target.value))} aria-label="Playback speed">
                    <option value={1}>1x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>
              </div>
              {filteredHistory.length ? (
                <div className="pp-trackHistoryMap__body">
                  <div className="pp-trackMapFrame pp-trackHistoryFrame pp-trackHistoryFrame--panorama">
                    <PositionMap
                      fill
                      lat={filteredHistory[0].lat}
                      lng={filteredHistory[0].lng}
                      path={filteredHistory.map((p) => ({ lat: p.lat, lng: p.lng }))}
                      routeMarkers={historyMarkers}
                      playbackPointIndex={filteredHistory.length ? Math.min(historyIndex, filteredHistory.length - 1) : null}
                    />
                  </div>
                  <input
                    className="pp-trackPlaybackRange"
                    type="range"
                    min={0}
                    max={Math.max(0, filteredHistory.length - 1)}
                    value={Math.min(historyIndex, Math.max(0, filteredHistory.length - 1))}
                    onChange={(e) => {
                      setHistoryPlaying(false);
                      setHistoryIndex(Number(e.target.value));
                    }}
                    aria-label="Jump to route timestamp"
                  />
                </div>
              ) : (
                <div className="pp-trackHistoryEmpty">
                  <div aria-hidden>🐾</div>
                  <h3>No movement history yet</h3>
                  <p>{historyError || 'No tracker locations were found for this date range. Once the device sends stored positions, the route will appear here.'}</p>
                  <button type="button" className="pp-btn pp-btnPrimary" disabled={!effectiveDeviceId || historyLoading} onClick={() => setHistoryReloadTick((n) => n + 1)}>
                    {historyLoading ? 'Loading…' : 'Refresh history'}
                  </button>
                </div>
              )}
            </div>

            <aside className="pp-card pp-pad pp-trackHistoryTimeline">
              <div className="pp-trackHistoryTimeline__head">
                <h3>Timeline</h3>
                <span>
                  {historyRange.from} → {historyRange.to}
                  {' · '}
                  {(historyRange.timeFrom ?? defaultHistoryDayTimes().timeFrom).slice(0, 5)}–
                  {(historyRange.timeTo ?? defaultHistoryDayTimes().timeTo).slice(0, 5)}
                </span>
              </div>
              <div className="pp-trackHistoryTimeline__list">
                {historyTimelineEvents.map((event) => {
                  const p = event.start;
                  const active = historyIndex >= event.startIndex && historyIndex <= event.endIndex;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={active ? 'is-active' : ''}
                      onClick={() => {
                        setHistoryPlaying(false);
                        setHistoryIndex(event.startIndex);
                      }}
                    >
                      <span className={`pp-trackHistoryTimeline__dot is-${event.type}`} />
                      <strong>{event.timeLabel}</strong>
                      <em>{event.label}</em>
                      <small>
                        {p.address || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`}
                        {event.count > 1 ? ` · ${event.count} reports` : p.speed != null ? ` · ${Number(p.speed).toFixed(1)} km/h` : ''}
                      </small>
                    </button>
                  );
                })}
                {!filteredHistory.length ? (
                  <p className="pp-subtle">Timeline events will appear after tracker history loads.</p>
                ) : null}
              </div>
            </aside>
          </div>

          <div className="pp-trackHistoryStats pp-trackHistoryStats--footer" aria-label="Route summary">
            <article><span>↗</span><small>Distance</small><strong>{historyAnalytics.distanceKm.toFixed(2)} km</strong></article>
            <article>
              <span>⏱</span>
              <small>Active time</small>
              <strong>{formatDurationMinutes(historyAnalytics.activeMinutes, t)}</strong>
            </article>
            <article><span>⚡</span><small>Avg speed</small><strong>{historyAnalytics.averageSpeed.toFixed(1)} km/h</strong></article>
            <article><span>•</span><small>Stops</small><strong>{historyAnalytics.stops}</strong></article>
          </div>
        </section>
      ) : null}

      {trackerTab === 'device' ? (
      <section className="pp-card pp-pad pp-trackDeviceCard">
        <h2 className="pp-sectionTitle">{t('trackingPage.sectionPetDevice')}</h2>
        <form className="pp-form pp-trackDeviceForm" onSubmit={saveIdAndLoad}>
          <div>
            <label className="pp-label" htmlFor={fieldId}>
              {t('trackingPage.deviceIdLabel')}
            </label>
            <input
              id={fieldId}
              className="pp-input"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder={t('trackingPage.deviceIdPh')}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          {imeiDirty && selectedPet ? (
            <div className="pp-trackImeiWarn" role="status">
              {t('trackingPage.imeiChangeWarn', { name: selectedPet.name })}
            </div>
          ) : null}
          {selectedPet ? (
            <p className="pp-subtle pp-trackImeiFoot" style={{ margin: 0 }}>
              {t('trackingPage.persistHintSaving', { name: selectedPet.name })}{' '}
              <Link to="/pets">{t('trackingPage.editImeiOnMyPets')}</Link>
            </p>
          ) : null}
          {!position && error ? <div className="pp-error">{error}</div> : null}
          <button className="pp-btn pp-btnPrimary" type="submit" disabled={loading || !effectiveDeviceId}>
            {loading ? t('trackingPage.btnRefresh') : t('trackingPage.btnSaveLoad')}
          </button>
        </form>
      </section>
      ) : null}

      {trackerTab === 'device' && hasDiagnostics(position) ? (
        <section className="pp-card pp-pad">
          <h2 className="pp-sectionTitle">Everything received from provider</h2>
          <p className="pp-subtle" style={{ marginTop: 0 }}>
            Latest raw tracker payload and parsed fields kept by the TCP server.
          </p>
          <pre
            style={{
              margin: 0,
              overflow: 'auto',
              maxHeight: 360,
              padding: 12,
              borderRadius: 12,
              background: '#0f172a',
              color: '#e2e8f0',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            {JSON.stringify(position.diagnostics, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
