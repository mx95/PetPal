import { useCallback, useEffect, useRef, useState } from 'react';
import { getPositionHistory } from '../tracking/petpalVendorClient';
import { loadHomeAnchor } from '../tracking/homeAnchorStorage';
import { currentWeekDayKeys, localDayKey } from './walkStats';
import {
  detectHomeRoundTrips,
  estimateHomePoint,
  homeTripKey,
  kmByDayFromPoints,
  totalKmFromPoints,
} from './walkGpsMetrics';
import { filterWalkSuggestions } from './walkDetection';

function weekBoundsIso() {
  const keys = currentWeekDayKeys();
  const fromMs = new Date(`${keys[0]}T00:00:00`).getTime();
  const today = localDayKey();
  const toMs = new Date(`${today}T23:59:59.999`).getTime();
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), dayKeys: keys };
}

/**
 * GPS distance metrics + automatic home round-trip walk logging.
 */
export function useAutoGpsWalks({
  deviceId,
  petId,
  walkSessions,
  dismissedGpsWalkKeys,
  addWalkKm,
}) {
  const [gpsTodayKm, setGpsTodayKm] = useState(0);
  const [gpsWeekKm, setGpsWeekKm] = useState(0);
  const [autoLoggedToday, setAutoLoggedToday] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const syncingRef = useRef(false);
  const lastSyncRef = useRef(0);

  const sync = useCallback(async () => {
    const id = String(deviceId || '').trim();
    if (!id || syncingRef.current) return;
    syncingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const { from, to, dayKeys } = weekBoundsIso();
      const { history } = await getPositionHistory(id, { limit: 12000, from, to });
      const points = history || [];
      const todayKey = localDayKey();
      const todayPoints = points.filter((p) => {
        const d = p?.deviceTime || p?.serverTime || p?.fixTime;
        if (!d) return false;
        const key = localDayKey(new Date(d));
        return key === todayKey;
      });

      const storedHome = loadHomeAnchor(id);
      const home = storedHome?.lat != null && storedHome?.lng != null
        ? { lat: Number(storedHome.lat), lng: Number(storedHome.lng) }
        : estimateHomePoint(points.length ? points : todayPoints);

      const todayKm = totalKmFromPoints(todayPoints.length ? todayPoints : points);
      const byDay = kmByDayFromPoints(points, dayKeys);
      const weekKm = Math.round(dayKeys.reduce((s, k) => s + (byDay[k] || 0), 0) * 100) / 100;

      setGpsTodayKm(todayKm);
      setGpsWeekKm(weekKm);

      if (home && addWalkKm) {
        const trips = detectHomeRoundTrips(todayPoints.length ? todayPoints : points, home);
        const pending = filterWalkSuggestions(trips, {
          deviceId: id,
          walkSessions: walkSessions || [],
          dismissedKeys: dismissedGpsWalkKeys || [],
        });
        let logged = 0;
        for (const trip of pending) {
          const key = homeTripKey(id, trip);
          // eslint-disable-next-line no-await-in-loop
          const ok = await addWalkKm(trip.distanceKm, null, petId, {
            source: 'gps',
            gpsKey: key,
            startedAt: trip.startAt,
            endedAt: trip.endAt,
          });
          if (ok) logged += 1;
        }
        if (logged > 0) setAutoLoggedToday((n) => n + logged);
      }
      lastSyncRef.current = Date.now();
    } catch (e) {
      setError(e?.message || 'Could not load GPS history.');
    } finally {
      syncingRef.current = false;
      setLoading(false);
    }
  }, [deviceId, petId, walkSessions, dismissedGpsWalkKeys, addWalkKm]);

  useEffect(() => {
    if (!deviceId) {
      setGpsTodayKm(0);
      setGpsWeekKm(0);
      return;
    }
    void sync();
    const timer = window.setInterval(() => {
      if (Date.now() - lastSyncRef.current > 4 * 60 * 1000) void sync();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [deviceId, petId, sync]);

  return { gpsTodayKm, gpsWeekKm, autoLoggedToday, loading, error, refresh: sync };
}
