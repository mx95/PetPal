import {
  isPlausibleGpsJump,
  kmBetween,
  resolveTrackerPositions,
} from './positionFilter';

function pt(lat, lng, receivedAt) {
  return { lat, lng, receivedAt, timestamp: receivedAt, source: 'gps', gpsValid: true };
}

describe('isPlausibleGpsJump', () => {
  it('rejects multi-km hops when receive times are identical (batched fixes)', () => {
    const t = '2026-05-16T10:00:00.000Z';
    const home = pt(38.0, 23.7, t);
    const spike = pt(38.02, 23.72, t);
    expect(kmBetween(home, spike)).toBeGreaterThan(0.2);
    expect(isPlausibleGpsJump(home, spike)).toBe(false);
  });
});

describe('resolveTrackerPositions', () => {
  it('holds last GPS on an outlier instead of drawing to it', () => {
    const t0 = '2026-05-16T10:00:00.000Z';
    const t1 = '2026-05-16T10:01:00.000Z';
    const t2 = '2026-05-16T10:02:00.000Z';
    const home = pt(38.0, 23.7, t0);
    const bad = pt(38.05, 23.75, t1);
    const back = pt(38.0001, 23.7001, t2);
    const out = resolveTrackerPositions([home, bad, back]);
    expect(out).toHaveLength(3);
    expect(out[1].lat).toBe(home.lat);
    expect(out[1].lng).toBe(home.lng);
    expect(out[1].positionHeldFromPreviousGps).toBe(true);
    expect(out[2].lat).toBe(home.lat);
    expect(out[2].positionHeldFromPreviousGps).toBe(true);
  });
});
