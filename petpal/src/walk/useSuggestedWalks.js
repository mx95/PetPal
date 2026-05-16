import { useCallback, useEffect, useState } from 'react';
import { getPositionHistory } from '../tracking/petpalVendorClient';
import { localDayKey } from './walkStats';
import {
  detectWalkSegments,
  filterWalkSuggestions,
  gpsWalkKey,
  suggestionsForLocalDay,
} from './walkDetection';

function todayIsoBounds() {
  const day = localDayKey();
  const fromMs = new Date(`${day}T00:00:00`).getTime();
  const toMs = new Date(`${day}T23:59:59.999`).getTime();
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    dayKey: day,
  };
}

/**
 * Load GPS-detected walk suggestions for the selected pet's tracker (today, local time).
 */
export function useSuggestedWalks({ deviceId, petId, walkSessions, dismissedGpsWalkKeys }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const id = String(deviceId || '').trim();
    if (!id) {
      setSuggestions([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { from, to, dayKey } = todayIsoBounds();
      const { history } = await getPositionHistory(id, { limit: 8000, from, to });
      const detected = detectWalkSegments(history || []);
      const today = suggestionsForLocalDay(detected, dayKey);
      const visible = filterWalkSuggestions(today, {
        deviceId: id,
        walkSessions: walkSessions || [],
        dismissedKeys: dismissedGpsWalkKeys || [],
      }).map((s) => ({ ...s, gpsKey: gpsWalkKey(id, s) }));
      setSuggestions(visible);
    } catch (e) {
      setSuggestions([]);
      setError(e?.message || 'Could not load tracker history.');
    } finally {
      setLoading(false);
    }
  }, [deviceId, walkSessions, dismissedGpsWalkKeys]);

  useEffect(() => {
    void load();
  }, [load, petId]);

  return { suggestions, loading, error, refresh: load };
}
