import {
  detectWalkSegments,
  filterWalkSuggestions,
  gpsWalkKey,
  MIN_WALK_KM,
} from './walkDetection';

function pt(lat, lng, receivedAt, speed = 3) {
  return {
    lat,
    lng,
    receivedAt,
    timestamp: receivedAt,
    source: 'gps',
    gpsValid: true,
    speed,
  };
}

function walkRoute(startMs, count = 12, stepKm = 0.03) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = new Date(startMs + i * 3 * 60 * 1000).toISOString();
    out.push(pt(38 + i * stepKm * 0.009, 23.7 + i * stepKm * 0.012, t, 3.5));
  }
  return out;
}

describe('detectWalkSegments', () => {
  it('detects a continuous walk with enough distance and duration', () => {
    const start = Date.parse('2026-05-16T09:00:00.000Z');
    const points = walkRoute(start, 14, 0.04);
    const segments = detectWalkSegments(points);
    expect(segments.length).toBeGreaterThanOrEqual(1);
    expect(segments[0].distanceKm).toBeGreaterThanOrEqual(MIN_WALK_KM);
    expect(segments[0].durationMin).toBeGreaterThanOrEqual(5);
  });

  it('ignores a short idle cluster', () => {
    const t0 = '2026-05-16T10:00:00.000Z';
    const t1 = '2026-05-16T10:02:00.000Z';
    const points = [pt(38, 23.7, t0, 0), pt(38.0001, 23.7001, t1, 0)];
    expect(detectWalkSegments(points)).toHaveLength(0);
  });
});

describe('filterWalkSuggestions', () => {
  it('removes suggestions already logged with gpsKey', () => {
    const s = {
      dedupeKey: '1-2-150',
      startAt: '2026-05-16T09:00:00.000Z',
      endAt: '2026-05-16T09:40:00.000Z',
      distanceKm: 1.5,
      durationMin: 40,
    };
    const key = gpsWalkKey('123', s);
    const out = filterWalkSuggestions([s], {
      deviceId: '123',
      walkSessions: [{ gpsKey: key, source: 'gps' }],
    });
    expect(out).toHaveLength(0);
  });
});
