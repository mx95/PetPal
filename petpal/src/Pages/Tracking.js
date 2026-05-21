import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import PetAvatar from '../components/PetAvatar';
import IconBattery from '../components/icons/IconBattery';
import TimeInput24 from '../components/TimeInput24';
import { formatDateTime24, formatTime24 } from '../formatTime24';
import PositionMap from '../tracking/PositionMap';
import { accuracyRadiusMeters } from '../tracking/mapLiveUtils';
import { usePets } from '../pets/PetsContext';
import { getLatestPosition, getPositionHistory, getTrackingDataSource, mapsLink } from '../tracking/petpalVendorClient';
import {
  anchorFromDisplayedPosition,
  applyHeldGpsPosition,
  isTrustedGpsFix,
  kmBetween,
  pointReceivedIso,
  pointTimestampMs,
  countDistinctLocations,
  resolveHistoryPositions,
  resolveHistoryRoutePositions,
  sanitizeSpeedKmh,
} from '../tracking/positionFilter';

const LAST_LIVE_PET_KEY = 'petpal_live_selectedPetId';
const LAST_LIVE_COORDS_KEY = 'petpal_last_live_coords_v1';

function hasValidCoords(p) {
  return (
    p?.lat != null &&
    p?.lng != null &&
    Number.isFinite(Number(p.lat)) &&
    Number.isFinite(Number(p.lng))
  );
}

function loadStoredLastCoords(deviceId) {
  if (!deviceId) return null;
  try {
    const all = JSON.parse(localStorage.getItem(LAST_LIVE_COORDS_KEY) || '{}');
    const entry = all?.[deviceId];
    if (!hasValidCoords(entry)) return null;
    return { lat: Number(entry.lat), lng: Number(entry.lng) };
  } catch {
    return null;
  }
}

function saveStoredLastCoords(deviceId, lat, lng) {
  if (!deviceId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  try {
    const all = JSON.parse(localStorage.getItem(LAST_LIVE_COORDS_KEY) || '{}');
    all[deviceId] = { lat, lng, savedAt: Date.now() };
    localStorage.setItem(LAST_LIVE_COORDS_KEY, JSON.stringify(all));
  } catch (_) {}
}

function formatTime(iso, lang) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return formatDateTime24(d, lang);
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

function movementType(point, prev) {
  if (!prev) return 'start';
  const speed = sanitizeSpeedKmh(point.speed) ?? 0;
  if (speed < 0.5) return 'rest';
  if (speed > 4) return 'movement';
  return 'walk';
}

function pointTime(point) {
  const iso = pointReceivedIso(point);
  if (!iso) return Number.NaN;
  return new Date(iso).getTime();
}

const LIVE_POLL_MS = 60_000;
const HISTORY_FETCH_LIMIT = 500;

function defaultHistoryDayTimes() {
  return { timeFrom: '00:00', timeTo: '23:59' };
}

function combineLocalDateTime(dateStr, timeStr, endOfDay = false) {
  const m = String(timeStr || '00:00').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const h = m ? Math.min(23, Math.max(0, Number(m[1]) || 0)) : 0;
  const min = m ? Math.min(59, Math.max(0, Number(m[2]) || 0)) : 0;
  const sec = m?.[3] != null ? Math.min(59, Math.max(0, Number(m[3]) || 0)) : endOfDay ? 59 : 0;
  const ms = endOfDay && m?.[3] == null ? 999 : 0;
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, min, sec, ms);
  return d;
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
  const when = iso || null;
  if (!when) return true;
  let ts;
  try {
    ts = new Date(when).getTime();
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
  const from = combineLocalDateTime(range.from, range.timeFrom ?? defaultHistoryDayTimes().timeFrom, false);
  const to = combineLocalDateTime(range.to, range.timeTo ?? defaultHistoryDayTimes().timeTo, true);
  const fromMs = from.getTime();
  const toMs = to.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return {};
  return { from: from.toISOString(), to: to.toISOString() };
}

function filterHistoryPoints(points, range) {
  const bounds = historyRangeToIsoBounds(range);
  if (!bounds.from || !bounds.to) return points;
  const fromMs = new Date(bounds.from).getTime();
  const toMs = new Date(bounds.to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return points;
  const multiDay = Boolean(range?.from && range?.to && range.from !== range.to);
  return points.filter((p) => {
    const ts = pointTime(p);
    if (!Number.isFinite(ts) || ts < fromMs || ts > toMs) return false;
    if (multiDay) return inDailyLocalTimeWindow(pointReceivedIso(p), range);
    return true;
  });
}

/** Initial / preset date span for the History tab (inclusive). */
function computeHistoryRangeForPreset(preset) {
  const today = startOfDay(new Date());
  if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    const value = dateInputValue(y);
    return { preset, from: value, to: value, ...defaultHistoryDayTimes() };
  }
  if (preset === 'today') {
    const value = dateInputValue(today);
    return { preset, from: value, to: value, ...defaultHistoryDayTimes() };
  }
  const value = dateInputValue(today);
  return { preset: 'today', from: value, to: value, ...defaultHistoryDayTimes() };
}

function buildHistoryAnalytics(points) {
  const distanceKm = points.reduce((sum, p, idx) => {
    if (!idx) return sum;
    const prev = points[idx - 1];
    if (p.positionHeldFromPreviousGps || prev.positionHeldFromPreviousGps) return sum;
    return sum + kmBetween(prev, p);
  }, 0);
  const first = points[0] ? pointTime(points[0]) : 0;
  const last = points[points.length - 1] ? pointTime(points[points.length - 1]) : 0;
  const activeMinutes = first && last ? Math.max(0, Math.round((last - first) / 60000)) : 0;
  const speeds = points.map((p) => sanitizeSpeedKmh(p.speed)).filter((n) => n != null && n > 0);
  return {
    distanceKm,
    activeMinutes,
    averageSpeed: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
    stops: points.filter((p, idx) => movementType(p, points[idx - 1]) === 'rest').length,
    events: points.length,
  };
}

function formatShortTime(iso, lang, withDate = false) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return withDate ? formatDateTime24(d, lang) : formatTime24(d, lang);
  } catch {
    return '—';
  }
}

function historyLocalDayKey(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function countDaysInRange(range) {
  if (!range?.from || !range?.to) return 1;
  const from = new Date(`${range.from}T00:00:00`).getTime();
  const to = new Date(`${range.to}T00:00:00`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 1;
  return Math.max(1, Math.floor((to - from) / 86400000) + 1);
}

function countDaysWithPoints(points) {
  const days = new Set();
  for (const p of points) {
    const key = historyLocalDayKey(pointReceivedIso(p));
    if (key) days.add(key);
  }
  return days.size;
}

/** Same-location clusters longer than this use report count only (device timestamps often wrong). */
const STAY_DURATION_PLAUSIBLE_MAX_MIN = 48 * 60;
/** Split a stay cluster when reports are farther apart than this (same coordinates). */
const STAY_CLUSTER_MAX_GAP_MIN = 90;

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

function buildHistoryTimelineEvents(points, t, lang, range) {
  const sameLocationKm = 0.03;
  const multiDay = Boolean(range?.from && range?.to && range.from !== range.to);
  const showDate = multiDay;
  const events = [];
  let idx = 0;

  while (idx < points.length) {
    const start = points[idx];
    let endIndex = idx;

    while (endIndex + 1 < points.length) {
      const next = points[endIndex + 1];
      const samePlace = kmBetween(start, next) <= sameLocationKm;
      const gapMin = Math.max(0, (pointTime(next) - pointTime(points[endIndex])) / 60000);
      const dayBreak =
        historyLocalDayKey(pointReceivedIso(start)) !== historyLocalDayKey(pointReceivedIso(next));
      if (samePlace && gapMin <= STAY_CLUSTER_MAX_GAP_MIN && !dayBreak) {
        endIndex += 1;
      } else {
        break;
      }
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
          ? `${formatShortTime(pointReceivedIso(start), lang, showDate)} → ${formatShortTime(pointReceivedIso(end), lang, showDate)}`
          : formatShortTime(pointReceivedIso(start), lang, showDate),
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
  const [historyRange, setHistoryRange] = useState(() => computeHistoryRangeForPreset('today'));
  const [historyReloadTick, setHistoryReloadTick] = useState(0);
  const [historyPlaying, setHistoryPlaying] = useState(false);
  const [historySpeed, setHistorySpeed] = useState(1);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyCalendarMatch, setHistoryCalendarMatch] = useState(true);
  const trustedLiveAnchorRef = useRef(null);
  const lastKnownLiveRef = useRef(null);
  const [liveHistoryFallback, setLiveHistoryFallback] = useState(null);
  const [liveTrail, setLiveTrail] = useState([]);

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
      const msg = e?.message || t('trackingPage.errLoadPosition');
      setError(msg);
      if (e?.status === 404 || /not checked in|not seen on tracker|Missing IMEI/i.test(msg)) {
        setPosition(null);
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveDeviceId, t]);

  useEffect(() => {
    trustedLiveAnchorRef.current = null;
    setLiveHistoryFallback(null);
    setLiveTrail([]);
  }, [effectiveDeviceId]);

  useEffect(() => {
    if (!effectiveDeviceId.trim()) return;
    void refresh();
  }, [effectiveDeviceId, refresh]);

  useEffect(() => {
    if (!effectiveDeviceId) return;
    const id = window.setInterval(() => {
      void refresh();
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [effectiveDeviceId, refresh]);

  useEffect(() => {
    if (trackerTab !== 'history' || !effectiveDeviceId) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    getPositionHistory(effectiveDeviceId, {
      limit: HISTORY_FETCH_LIMIT,
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
  }, [trackerTab, effectiveDeviceId, historyReloadTick, historyRange]);

  const resolvedHistory = useMemo(() => {
    const sorted = [...historyPoints].sort(
      (a, b) => (pointTimestampMs(a) ?? 0) - (pointTimestampMs(b) ?? 0)
    );
    return resolveHistoryRoutePositions(sorted);
  }, [historyPoints]);

  const mapPosition = useMemo(
    () => applyHeldGpsPosition(position, trustedLiveAnchorRef.current),
    [position]
  );

  useEffect(() => {
    const nextAnchor = anchorFromDisplayedPosition(mapPosition);
    if (nextAnchor) trustedLiveAnchorRef.current = nextAnchor;
  }, [mapPosition]);

  useEffect(() => {
    if (!effectiveDeviceId) return;
    let lat;
    let lng;
    if (hasValidCoords(mapPosition) && !mapPosition.positionHiddenApproximate) {
      lat = Number(mapPosition.lat);
      lng = Number(mapPosition.lng);
    } else if (hasValidCoords(position)) {
      lat = Number(position.lat);
      lng = Number(position.lng);
    } else {
      return;
    }
    lastKnownLiveRef.current = { deviceId: effectiveDeviceId, lat, lng };
    saveStoredLastCoords(effectiveDeviceId, lat, lng);
  }, [mapPosition, position, effectiveDeviceId]);

  const hasImmediateLiveCoords = useMemo(() => {
    if (hasValidCoords(mapPosition) && !mapPosition.positionHiddenApproximate) return true;
    if (hasValidCoords(position)) return true;
    return false;
  }, [mapPosition, position]);

  useEffect(() => {
    if (trackerTab !== 'live' || !effectiveDeviceId.trim()) return;
    if (hasImmediateLiveCoords) {
      setLiveHistoryFallback(null);
      return;
    }
    let cancelled = false;
    getPositionHistory(effectiveDeviceId, { limit: 120 })
      .then(({ history }) => {
        if (cancelled || !Array.isArray(history) || history.length === 0) return;
        const sorted = [...history].sort(
          (a, b) => (pointTimestampMs(a) ?? 0) - (pointTimestampMs(b) ?? 0)
        );
        const resolved = resolveHistoryRoutePositions(sorted);
        for (let i = resolved.length - 1; i >= 0; i--) {
          const p = resolved[i];
          if (!hasValidCoords(p)) continue;
          setLiveHistoryFallback({
            lat: Number(p.lat),
            lng: Number(p.lng),
            at: pointReceivedIso(p),
          });
          saveStoredLastCoords(effectiveDeviceId, Number(p.lat), Number(p.lng));
          return;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [trackerTab, effectiveDeviceId, hasImmediateLiveCoords]);

  const liveMapCoords = useMemo(() => {
    if (hasValidCoords(mapPosition) && !mapPosition.positionHiddenApproximate) {
      return { lat: Number(mapPosition.lat), lng: Number(mapPosition.lng), mode: 'live' };
    }
    if (hasValidCoords(mapPosition) && mapPosition.positionHeldFromPreviousGps) {
      return { lat: Number(mapPosition.lat), lng: Number(mapPosition.lng), mode: 'lastKnown' };
    }
    if (hasValidCoords(position)) {
      const approximate =
        mapPosition?.positionHiddenApproximate ||
        position?.warningApproximate ||
        position?.accuracy === 'low' ||
        position?.source === 'lbs';
      return {
        lat: Number(position.lat),
        lng: Number(position.lng),
        mode: approximate ? 'approximate' : 'live',
      };
    }
    if (liveHistoryFallback && hasValidCoords(liveHistoryFallback)) {
      return {
        lat: liveHistoryFallback.lat,
        lng: liveHistoryFallback.lng,
        mode: 'lastKnown',
        at: liveHistoryFallback.at,
      };
    }
    const stored = loadStoredLastCoords(effectiveDeviceId);
    if (stored) return { ...stored, mode: 'lastKnown' };
    const cached = lastKnownLiveRef.current;
    if (cached?.deviceId === effectiveDeviceId && hasValidCoords(cached)) {
      return { lat: cached.lat, lng: cached.lng, mode: 'lastKnown' };
    }
    return null;
  }, [mapPosition, position, liveHistoryFallback, effectiveDeviceId]);

  useEffect(() => {
    if (trackerTab !== 'live' || !liveMapCoords) return;
    const { lat, lng } = liveMapCoords;
    setLiveTrail((prev) => {
      const last = prev[prev.length - 1];
      if (last && Math.abs(last.lat - lat) < 1e-6 && Math.abs(last.lng - lng) < 1e-6) return prev;
      return [...prev, { lat, lng }].slice(-24);
    });
  }, [trackerTab, liveMapCoords]);

  const liveMapAccuracyM = useMemo(
    () => accuracyRadiusMeters(mapPosition || position),
    [mapPosition, position]
  );

  const filteredHistory = useMemo(() => {
    const filtered = filterHistoryPoints(resolvedHistory, historyRange);
    if (filtered.length > 0) return filtered;
    if (resolvedHistory.length > 0) return resolvedHistory;
    return filtered;
  }, [resolvedHistory, historyRange]);

  const historyRangeFallback = useMemo(
    () => !historyCalendarMatch && historyPoints.length > 0 && filterHistoryPoints(resolvedHistory, historyRange).length === 0,
    [historyCalendarMatch, historyPoints.length, resolvedHistory, historyRange]
  );

  const mapHistoryPoints = useMemo(() => {
    if (filteredHistory.length >= 2) return filteredHistory;
    const relaxed = resolveHistoryPositions(
      [...historyPoints].sort((a, b) => (pointTimestampMs(a) ?? 0) - (pointTimestampMs(b) ?? 0))
    );
    const relaxedFiltered = filterHistoryPoints(relaxed, historyRange);
    if (relaxedFiltered.length >= 2) return relaxedFiltered;
    if (filteredHistory.length > 0) return filteredHistory;
    if (relaxedFiltered.length > 0) return relaxedFiltered;
    return [];
  }, [filteredHistory, historyPoints, historyRange]);
  const historyAnalytics = useMemo(() => buildHistoryAnalytics(mapHistoryPoints), [mapHistoryPoints]);
  const historyTimelineEvents = useMemo(
    () => buildHistoryTimelineEvents(mapHistoryPoints, t, language, historyRange),
    [mapHistoryPoints, t, language, historyRange]
  );

  const historyMapPath = useMemo(
    () =>
      mapHistoryPoints
        .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [mapHistoryPoints]
  );

  const historyDistinctPlaces = useMemo(() => countDistinctLocations(mapHistoryPoints), [mapHistoryPoints]);

  const historyStationary = useMemo(
    () => historyDistinctPlaces <= 1 && mapHistoryPoints.length >= 2,
    [historyDistinctPlaces, mapHistoryPoints.length]
  );

  const historyDayCoverage = useMemo(() => {
    const total = countDaysInRange(historyRange);
    const active = countDaysWithPoints(mapHistoryPoints);
    return { total, active };
  }, [historyRange, mapHistoryPoints]);

  const historyMapMarkers = useMemo(() => {
    if (!historyTimelineEvents.length) return [];
    const lastIdx = Math.max(0, mapHistoryPoints.length - 1);
    return historyTimelineEvents.map((ev, i) => {
      const isLast = i === historyTimelineEvents.length - 1 && ev.endIndex === lastIdx;
      let kind = ev.type;
      if (kind === 'start') kind = 'start';
      else if (isLast && ev.count === 1) kind = 'end';
      else if (kind === 'rest') kind = 'rest';
      else if (kind === 'movement') kind = 'movement';
      else kind = 'walk';
      return {
        id: ev.id,
        pointIndex: ev.startIndex,
        lat: Number(ev.start.lat),
        lng: Number(ev.start.lng),
        kind,
        label: `${ev.label} · ${ev.timeLabel}`,
      };
    }).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  }, [historyTimelineEvents, mapHistoryPoints.length]);

  const historyLoadMeta = useMemo(() => {
    const stored = historyPoints.length;
    const onMap = mapHistoryPoints.length;
    const approximateHidden = historyPoints.filter((p) => p && !isTrustedGpsFix(p)).length;
    return { stored, onMap, approximateHidden };
  }, [historyPoints, mapHistoryPoints]);

  useEffect(() => {
    if (!historyPlaying || mapHistoryPoints.length < 2) return undefined;
    const id = window.setInterval(() => {
      setHistoryIndex((idx) => {
        if (idx >= mapHistoryPoints.length - 1) {
          setHistoryPlaying(false);
          return mapHistoryPoints.length - 1;
        }
        return idx + 1;
      });
    }, Math.max(260, 1100 / historySpeed));
    return () => window.clearInterval(id);
  }, [historyPlaying, mapHistoryPoints.length, historySpeed]);

  useEffect(() => {
    setHistoryIndex(0);
    setHistoryPlaying(false);
  }, [historyRange]);

  function applyHistoryPreset(preset) {
    setHistoryRange(computeHistoryRangeForPreset(preset));
  }

  const refreshHistory = useCallback(() => {
    setHistoryPlaying(false);
    setHistoryError('');
    setHistoryIndex(0);
    setHistoryReloadTick((n) => n + 1);
  }, []);

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
  const hasCoordinates = liveMapCoords != null;
  const showingLastKnownOnMap = liveMapCoords?.mode === 'lastKnown' || liveMapCoords?.mode === 'approximate';
  const approx = position?.warningApproximate || position?.accuracy === 'low' || position?.source === 'lbs';
  const accuracyLabel = approx ? t('trackingPage.accuracyApprox') : t('trackingPage.accuracyHigh');
  const secondsAgo =
    typeof position?.secondsAgo === 'number' && Number.isFinite(position.secondsAgo) ? position.secondsAgo : null;
  const lastUpdateLabel = formatLastSeen(secondsAgo, t);

  const gpsOkVisual = hasCoordinates && !approx && position?.source !== 'lbs' && !position?.warningStale;

  const receivedTimeLabel = position?.serverTime
    ? formatTime(position.serverTime, language)
    : '—';

  const deviceTimeLabel = position?.deviceTimeLocal
    ? position.deviceTimeLocal
    : position?.deviceTime
      ? formatTime(position.deviceTime, language)
      : '—';

  const batPct = position?.battery != null ? Math.min(100, Math.max(0, Number(position.battery))) : null;

  const signalLabel =
    position?.signal != null && Number.isFinite(Number(position.signal))
      ? position.signalStatus
        ? t(`trackingPage.signalLevel_${position.signalStatus}`, { value: Number(position.signal) })
        : t('trackingPage.signalLevelRaw', { value: Number(position.signal) })
      : null;

  const satellitesLabel =
    position?.satellites != null && Number.isFinite(Number(position.satellites))
      ? t('trackingPage.satellites', { count: Number(position.satellites) })
      : null;

  const displaySpeedKmh = position ? sanitizeSpeedKmh(position.speed) : null;
  const liveStatusShort =
    position?.statusText || (signalLive ? t('trackingPage.signalLive') : t('trackingPage.signalQuiet'));
  const gpsChipLabel = gpsOkVisual ? t('trackingPage.gpsOk') : t('trackingPage.gpsWeak');
  const activityMovement =
    position?.movementText || (position?.isMoving ? t('trackingPage.moving') : t('trackingPage.notMoving'));

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
              <PetAvatar pet={p} size={36} />
              <span className="pp-trackPetCard__name">{p.name}</span>
              <span className="pp-trackPetCard__chip">
                {p.trackingDeviceId
                  ? t('trackingPage.deviceChip', { id: p.trackingDeviceId })
                  : t('trackingPage.noDeviceChip')}
              </span>
            </button>
          ))}
        </div>
      </section>

      <nav className="pp-trackTabs pp-trackTabs--segment" aria-label="Tracker views">
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
        <section className="pp-trackLiveBar" aria-label={selectedPet.name}>
          <div className="pp-trackLiveBar__row pp-trackLiveBar__row--meta">
            <PetAvatar pet={selectedPet} size={32} />
            <div className="pp-trackLiveBar__inline">
              <span className="pp-trackLiveBar__name">{selectedPet.name}</span>
              <span className="pp-trackLiveBar__dot" aria-hidden>·</span>
              <span className={`pp-trackLiveBar__live${signalLive ? ' is-live' : ''}`}>{liveStatusShort}</span>
              <span className="pp-trackLiveBar__dot" aria-hidden>·</span>
              <span className="pp-trackLiveBar__updated">{lastUpdateLabel}</span>
            </div>
          </div>
          <div className="pp-trackLiveBar__row pp-trackLiveBar__row--actions">
            <button
              type="button"
              className="pp-trackLocateBtn pp-btn pp-btnPrimary"
              disabled={loading || !effectiveDeviceId}
              onClick={() => void refresh()}
            >
              {t('trackingPage.btnLocate')}
            </button>
            {position ? (
              <div className="pp-trackLiveBar__quick" aria-label={t('trackingPage.liveQuickStatus')}>
                <span className={`pp-trackMiniChip ${gpsOkVisual ? 'pp-trackMiniChip--ok' : 'pp-trackMiniChip--warn'}`}>
                  {gpsOkVisual ? '✓' : '⚠'} {gpsChipLabel}
                </span>
                {batPct != null ? (
                  <span
                    className="pp-trackMiniChip pp-trackMiniChip--bat"
                    aria-label={t('trackingPage.batteryPctAria', { pct: batPct })}
                  >
                    <IconBattery pct={batPct} size={16} />
                    {batPct}%
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}


      {trackerTab === 'live' ? (
      <section className="pp-card pp-pad pp-trackMapShell pp-trackMapShell--compact">
        <div className="pp-trackMapHead pp-trackMapHead--inline">
          <h2 className="pp-trackMapHead__title">{t('trackingPage.sectionMap')}</h2>
          {liveMapCoords ? (
            <a
              className="pp-trackMapHead__link"
              href={mapsLink(liveMapCoords.lat, liveMapCoords.lng)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('trackingPage.openGoogleMaps')}
            </a>
          ) : null}
        </div>
        {liveMapCoords ? (
          <>
            {showingLastKnownOnMap ? (
              <p className="pp-trackMapLastKnown" role="status">
                {liveMapCoords.mode === 'approximate'
                  ? t('trackingPage.mapApproximateBanner')
                  : t('trackingPage.mapLastKnownBanner')}
                {liveMapCoords.at
                  ? ` · ${formatTime(liveMapCoords.at, language)}`
                  : liveMapCoords.mode === 'lastKnown' && position?.serverTime
                    ? ` · ${formatTime(position.serverTime, language)}`
                    : ''}
              </p>
            ) : null}
            <div className="pp-trackMapFrame">
              <PositionMap
                liveMode
                lat={liveMapCoords.lat}
                lng={liveMapCoords.lng}
                accuracyM={liveMapAccuracyM}
                markerLabel={selectedPet?.name || t('trackingPage.liveMarkerDefault')}
                liveTrail={liveTrail}
                recenterLabel={t('trackingPage.mapFollowPet')}
              />
            </div>
            <div className="pp-trackMapMeta">
              <span>
                {t('trackingPage.lblLatLng')}: {liveMapCoords.lat.toFixed(5)}, {liveMapCoords.lng.toFixed(5)}
              </span>
              {displaySpeedKmh != null ? (
                <span>
                  {t('trackingPage.lblSpeed')}: {displaySpeedKmh.toFixed(1)} {t('trackingPage.speedUnitKmh')}
                </span>
              ) : null}
              <span>
                {t('trackingPage.lblReceivedTime')}: {receivedTimeLabel}
              </span>
              <span>
                {t('trackingPage.lblDeviceTime')}: {deviceTimeLabel}
              </span>
              {position ? (
                <>
                  <span>
                    {t('trackingPage.cardGps')}: {gpsChipLabel}
                    {position?.warningStale ? ` · ${t('trackingPage.warnOffline')}` : ''}
                  </span>
                  <span>{t('trackingPage.accuracyLabel', { value: accuracyLabel })}</span>
                  {satellitesLabel ? <span>{satellitesLabel}</span> : null}
                  <span>
                    {t('trackingPage.healthBattery')}: {batPct != null ? `${batPct}%` : '—'}
                    {position?.isCharging ? ` · ${t('trackingPage.charging')}` : ''}
                  </span>
                  {signalLabel ? (
                    <span>
                      {t('trackingPage.healthSignal')}: {signalLabel}
                    </span>
                  ) : null}
                  <span>
                    {t('trackingPage.activitySteps')}: {position.steps ?? '—'} · {activityMovement}
                  </span>
                </>
              ) : null}
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
            <h3>{t('trackingPage.noLiveSignalTitle')}</h3>
            <p>{error || t('trackingPage.noLiveSignalBody')}</p>
            <ul>
              <li>{t('trackingPage.noLiveSignalTipSim')}</li>
              <li>{t('trackingPage.noLiveSignalTipImei')}</li>
              <li>{t('trackingPage.noLiveSignalTipPower')}</li>
            </ul>
            <div className="pp-trackNoSignal__actions">
              <button type="button" className="pp-btn pp-btnPrimary" disabled={loading || !effectiveDeviceId} onClick={() => void refresh()}>
                {t('trackingPage.quickRefresh')}
              </button>
              <Link className="pp-btn pp-btn--ghost" to="/admin/tracker">
                {t('trackingPage.setupGuide')}
              </Link>
            </div>
          </div>
        )}
      </section>
      ) : null}

      {trackerTab === 'history' ? (
        <section className="pp-trackHistory">
          <div className="pp-trackHistoryLayout">
            <div className="pp-card pp-pad pp-trackHistoryMap">
              <div className="pp-trackHistoryMap__top">
                <div>
                  <h3>{t('trackingPage.historyRouteTitle')}</h3>
                  {historyLoading ? <p className="pp-subtle">{t('trackingPage.historyLoading')}</p> : null}
                  {!historyLoading && mapHistoryPoints.length > 0 ? (
                    <p className="pp-subtle pp-trackHistoryMap__sub">
                      {[
                        historyDayCoverage.total > 1
                          ? t('trackingPage.historyDaysCoverage', {
                              active: historyDayCoverage.active,
                              total: historyDayCoverage.total,
                            })
                          : null,
                        historyStationary
                          ? t('trackingPage.historyStationaryHint', { count: mapHistoryPoints.length })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                </div>
                <div className="pp-trackPlayback">
                  <button type="button" disabled={mapHistoryPoints.length < 2} onClick={() => setHistoryPlaying((v) => !v)}>
                    {historyPlaying ? t('trackingPage.historyPause') : t('trackingPage.historyPlay')}
                  </button>
                  <select value={historySpeed} onChange={(e) => setHistorySpeed(Number(e.target.value))} aria-label={t('trackingPage.historySpeedAria')}>
                    <option value={1}>1x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>
              </div>
              {mapHistoryPoints.length ? (
                <div className="pp-trackHistoryMap__body">
                  <div className="pp-trackMapFrame pp-trackHistoryFrame pp-trackHistoryFrame--panorama">
                    <PositionMap
                      fill
                      showRouteVertices
                      lat={mapHistoryPoints[Math.min(historyIndex, mapHistoryPoints.length - 1)]?.lat ?? mapHistoryPoints[0].lat}
                      lng={mapHistoryPoints[Math.min(historyIndex, mapHistoryPoints.length - 1)]?.lng ?? mapHistoryPoints[0].lng}
                      path={historyStationary ? [] : historyMapPath}
                      routeMarkers={historyMapMarkers}
                      playbackPointIndex={mapHistoryPoints.length ? Math.min(historyIndex, mapHistoryPoints.length - 1) : null}
                      accuracyM={historyStationary ? 45 : null}
                    />
                  </div>
                  <input
                    className="pp-trackPlaybackRange"
                    type="range"
                    min={0}
                    max={Math.max(0, mapHistoryPoints.length - 1)}
                    value={Math.min(historyIndex, Math.max(0, mapHistoryPoints.length - 1))}
                    onChange={(e) => {
                      setHistoryPlaying(false);
                      setHistoryIndex(Number(e.target.value));
                    }}
                    aria-label={t('trackingPage.historyScrubAria')}
                  />
                </div>
              ) : (
                <div className="pp-trackHistoryEmpty">
                  <div aria-hidden>🐾</div>
                  <h3>{t('trackingPage.historyEmptyTitle')}</h3>
                  <p>{historyError || t('trackingPage.historyEmptyBody')}</p>
                </div>
              )}
            </div>

            <div className="pp-trackHistorySidebar">
              <div className="pp-card pp-pad pp-trackHistoryRangeCard pp-trackHistoryRangeCard--compact">
                <div className="pp-trackHistoryRangeCard__head">
                  <h2 className="pp-trackHistoryRangeCard__title">{t('trackingPage.historyTitle')}</h2>
                  <button
                    type="button"
                    className="pp-btn pp-btn--ghost pp-trackHistoryRefreshBtn"
                    disabled={!effectiveDeviceId || historyLoading}
                    onClick={refreshHistory}
                    aria-label={t('trackingPage.btnRefreshHistoryAria')}
                  >
                    {historyLoading ? t('trackingPage.btnRefresh') : t('trackingPage.btnRefreshHistory')}
                  </button>
                </div>
                {historyError ? <div className="pp-error pp-trackHistoryError">{historyError}</div> : null}
                {!historyLoading && historyPoints.length > 0 ? (
                  <p className="pp-trackHistoryRangeCard__hint">
                    {t('trackingPage.historyPointsSummary', {
                      onMap: historyLoadMeta.onMap,
                      stored: historyLoadMeta.stored,
                      hidden: historyLoadMeta.approximateHidden,
                    })}
                  </p>
                ) : null}
                {historyRangeFallback ? (
                  <p className="pp-trackHistoryRangeCard__hint pp-trackHistoryRangeCard__hint--warn">
                    {t('trackingPage.historyCalendarFallback')}
                  </p>
                ) : null}
                <div className="pp-trackHistoryPresets" role="group" aria-label={t('trackingPage.historyPresetsAria')}>
                  {(
                    [
                      ['today', 'presetToday'],
                      ['yesterday', 'presetYesterday'],
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
                <div className="pp-trackHistoryRangePickers" role="group" aria-label={t('trackingPage.historyManualAria')}>
                  {(
                    [
                      {
                        key: 'from',
                        label: t('trackingPage.historyFromLabel'),
                        date: historyRange.from,
                        dateAria: t('trackingPage.historyFromDateAria'),
                        onDate: (value) => setHistoryRange((r) => ({ ...r, preset: 'custom', from: value })),
                        time: historyRange.timeFrom ?? defaultHistoryDayTimes().timeFrom,
                        timeAria: t('trackingPage.historyFromTimeAria'),
                        onTime: (next) =>
                          setHistoryRange((r) => ({
                            ...r,
                            preset: 'custom',
                            timeFrom: next || defaultHistoryDayTimes().timeFrom,
                          })),
                      },
                      {
                        key: 'to',
                        label: t('trackingPage.historyToLabel'),
                        date: historyRange.to,
                        dateAria: t('trackingPage.historyToDateAria'),
                        onDate: (value) => setHistoryRange((r) => ({ ...r, preset: 'custom', to: value })),
                        time: historyRange.timeTo ?? defaultHistoryDayTimes().timeTo,
                        timeAria: t('trackingPage.historyToTimeAria'),
                        onTime: (next) =>
                          setHistoryRange((r) => ({
                            ...r,
                            preset: 'custom',
                            timeTo: next || defaultHistoryDayTimes().timeTo,
                          })),
                      },
                    ]
                  ).map((row) => (
                    <div key={row.key} className={`pp-trackHistoryRangeRow pp-trackHistoryRangeRow--${row.key}`}>
                      <span className="pp-trackHistoryRangeRow__label">{row.label}</span>
                      <label className="pp-trackHistoryRangeRow__date">
                        <span className="pp-trackHistoryRangeRow__fieldLabel">{t('trackingPage.historyDateField')}</span>
                        <input
                          type="date"
                          className="pp-trackHistoryRangeRow__dateInput"
                          value={row.date}
                          aria-label={row.dateAria}
                          onChange={(e) => row.onDate(e.target.value)}
                        />
                      </label>
                      <label className="pp-trackHistoryRangeRow__time">
                        <span className="pp-trackHistoryRangeRow__fieldLabel">{t('trackingPage.historyTimeField')}</span>
                        <TimeInput24
                          className="pp-trackHistoryRangeRow__timeInput"
                          value={row.time}
                          aria-label={row.timeAria}
                          onChange={row.onTime}
                        />
                      </label>
                    </div>
                  ))}
                </div>

              </div>

              <aside className="pp-card pp-pad pp-trackHistoryTimeline">
                <div className="pp-trackHistoryTimeline__head">
                  <h3>{t('trackingPage.historyTimelineTitle')}</h3>
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
                          {event.count > 1
                            ? ` · ${event.count} reports`
                            : sanitizeSpeedKmh(p.speed) != null
                              ? ` · ${sanitizeSpeedKmh(p.speed).toFixed(1)} km/h`
                              : ''}
                        </small>
                      </button>
                    );
                  })}
                  {!mapHistoryPoints.length ? (
                    <p className="pp-subtle">{t('trackingPage.historyTimelineEmpty')}</p>
                  ) : null}
                </div>
              </aside>
            </div>
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
