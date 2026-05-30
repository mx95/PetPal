import {
  buildRouteVertexMarkers,
  computeRouteFitPath,
  isPlausibleGpsJump,
  kmBetween,
  resolveHistoryRoutePositions,
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

describe('buildRouteVertexMarkers', () => {
  it('samples turns and distance steps without listing every redundant fix', () => {
    const base = Date.parse('2026-05-16T13:00:00.000Z');
    const iso = (min) => new Date(base + min * 60_000).toISOString();
    const points = [
      pt(34.96, 33.12, iso(0)),
      pt(34.9601, 33.12, iso(1)),
      pt(34.9602, 33.12, iso(2)),
      pt(34.9615, 33.121, iso(3)),
      pt(34.9625, 33.123, iso(4)),
    ];
    const markers = buildRouteVertexMarkers(points, { maxVertices: 10, minStepKm: 0.01 });
    expect(markers.length).toBeGreaterThan(2);
    expect(markers[0].kind).toBe('start');
    expect(markers[markers.length - 1].kind).toBe('end');
  });
});

describe('computeRouteFitPath', () => {
  it('ignores far GPS spikes when computing fit bounds', () => {
    const core = [
      { lat: 34.96, lng: 33.12 },
      { lat: 34.961, lng: 33.121 },
      { lat: 34.962, lng: 33.122 },
      { lat: 34.963, lng: 33.123 },
    ];
    const withSpike = [...core, { lat: 35.05, lng: 33.4 }];
    const fit = computeRouteFitPath(withSpike);
    expect(fit.length).toBeGreaterThan(0);
    const maxLat = Math.max(...fit.map((p) => p.lat));
    expect(maxLat).toBeLessThan(35.0);
  });
});

describe('resolveHistoryRoutePositions', () => {
  it('does not draw lines between alternating distant cell-tower clusters', () => {
    const base = Date.parse('2026-05-16T13:00:00.000Z');
    const iso = (min) => new Date(base + min * 60_000).toISOString();
    const A = [34.99942, 33.98033];
    const B = [34.98478, 33.84349];
    const points = [];
    for (let i = 0; i < 6; i++) points.push(pt(A[0], A[1], iso(i)));
    for (let i = 0; i < 3; i++) points.push(pt(B[0], B[1], iso(10 + i)));
    for (let i = 0; i < 6; i++) points.push(pt(A[0], A[1], iso(20 + i)));
    for (let i = 0; i < 4; i++) points.push(pt(B[0], B[1], iso(30 + i)));

    const route = resolveHistoryRoutePositions(points);
    expect(route.length).toBeGreaterThan(0);

    let maxSeg = 0;
    for (let i = 1; i < route.length; i++) {
      maxSeg = Math.max(maxSeg, kmBetween(route[i - 1], route[i]));
    }
    expect(maxSeg).toBeLessThan(2);
  });
});
