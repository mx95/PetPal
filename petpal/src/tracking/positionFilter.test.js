import {
  buildRouteVertexMarkers,
  computeRouteFitPath,
  excludeFarGpsOutliers,
  hasSevereDeviceClockSkew,
  isPlausibleGpsJump,
  isTrustedGpsFix,
  kmBetween,
  resolveHistoryRoutePositions,
  resolveTrackerPositions,
} from './positionFilter';

function pt(lat, lng, receivedAt, extra = {}) {
  return {
    lat,
    lng,
    receivedAt,
    timestamp: receivedAt,
    source: 'gps',
    gpsValid: true,
    ...extra,
  };
}

describe('isTrustedGpsFix', () => {
  it('still trusts explicit GPS when gpsValid was cleared by a status packet', () => {
    expect(
      isTrustedGpsFix({
        lat: 34.82,
        lng: 32.4,
        source: 'gps',
        accuracy: 'high',
        gpsValid: false,
        warningApproximate: false,
      })
    ).toBe(true);
  });

  it('rejects LBS even when gpsValid is missing', () => {
    expect(
      isTrustedGpsFix({
        lat: 34.82,
        lng: 32.4,
        source: 'lbs',
        accuracy: 'low',
        gpsValid: false,
      })
    ).toBe(false);
  });
});

describe('isPlausibleGpsJump', () => {
  it('rejects multi-km hops when receive times are identical (batched fixes)', () => {
    const t = '2026-05-16T10:00:00.000Z';
    const home = pt(38.0, 23.7, t);
    const spike = pt(38.02, 23.72, t);
    expect(kmBetween(home, spike)).toBeGreaterThan(0.2);
    expect(isPlausibleGpsJump(home, spike)).toBe(false);
  });

  it('treats short collar GPS jitter as a plausible hop, not a sprint', () => {
    const a = pt(34.98468, 33.84502, '2026-08-14T08:19:03.000Z');
    const b = pt(34.98535, 33.84502, '2026-08-14T08:19:11.000Z');
    expect(kmBetween(a, b)).toBeGreaterThan(0.05);
    expect(kmBetween(a, b)).toBeLessThan(0.12);
    expect(isPlausibleGpsJump(a, b)).toBe(true);
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

  it('keeps a neighbourhood walk with GT06-style GPS gaps instead of collapsing to home', () => {
    const start = Date.parse('2026-08-14T08:17:00.000Z');
    const points = [];
    const home = { lat: 34.98468, lng: 33.84502 };
    const dest = { lat: 34.9754, lng: 33.85469 };
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      // ~8 s between ~70 m steps — looks like 30+ km/h on noisy collar GPS.
      const t = new Date(start + i * 8_000).toISOString();
      const f = i / steps;
      points.push(
        pt(home.lat + (dest.lat - home.lat) * f, home.lng + (dest.lng - home.lng) * f, t)
      );
    }
    const route = resolveHistoryRoutePositions(points);
    expect(route.length).toBeGreaterThan(steps / 2);
    const span = kmBetween(route[0], route[route.length - 1]);
    expect(span).toBeGreaterThan(1.2);
  });

  it('drops factory GPS in China so the Cyprus walk is the route', () => {
    const china = [];
    const walk = [];
    const chinaT = Date.parse('2026-08-12T14:04:00.000Z');
    for (let i = 0; i < 5; i++) {
      china.push(pt(22.67894, 113.79599, new Date(chinaT + i * 60_000).toISOString()));
    }
    const walkT = Date.parse('2026-08-12T14:18:00.000Z');
    for (let i = 0; i < 12; i++) {
      walk.push(
        pt(34.98468 - i * 0.0004, 33.84502 + i * 0.00035, new Date(walkT + i * 25_000).toISOString())
      );
    }
    const route = resolveHistoryRoutePositions([...china, ...walk]);
    expect(route.length).toBeGreaterThanOrEqual(8);
    expect(route.every((p) => p.lng < 50)).toBe(true);
    expect(route[0].lat).toBeGreaterThan(30);
  });

  it('keeps a Paphos walk when stale gpspos LASTPOS points end the day', () => {
    const walk = [];
    const walkT = Date.parse('2026-08-15T10:40:00.000Z');
    for (let i = 0; i < 40; i++) {
      const t = new Date(walkT + i * 30_000).toISOString();
      walk.push(
        pt(34.8207 + i * 0.00005, 32.3995 + i * 0.00004, t, { deviceTimeUtc: t })
      );
    }
    const lastpos = [];
    const recvT = Date.parse('2026-08-15T13:12:00.000Z');
    for (let i = 0; i < 48; i++) {
      lastpos.push(
        pt(34.9846733, 33.8448267, new Date(recvT + i * 1000).toISOString(), {
          deviceTimeUtc: '2026-08-12T14:27:02.000Z',
        })
      );
    }
    expect(hasSevereDeviceClockSkew(lastpos[0])).toBe(true);
    const kept = excludeFarGpsOutliers([...walk, ...lastpos]);
    expect(kept.every((p) => p.lng < 33)).toBe(true);
    const route = resolveHistoryRoutePositions([...walk, ...lastpos]);
    expect(route.length).toBeGreaterThan(20);
    expect(route.every((p) => Math.abs(p.lng - 32.4) < 0.05)).toBe(true);
  });

  it('does not collapse a Paphos walk when earlier same-day Larnaca noise is within Cyprus', () => {
    const noise = [];
    const noiseT = Date.parse('2026-08-15T09:28:00.000Z');
    for (let i = 0; i < 8; i++) {
      const t = new Date(noiseT + i * 10_000).toISOString();
      noise.push(pt(34.7212 + i * 0.0001, 33.2663 - i * 0.0002, t, { deviceTimeUtc: t }));
    }
    const walk = [];
    const walkT = Date.parse('2026-08-15T10:40:00.000Z');
    for (let i = 0; i < 40; i++) {
      const t = new Date(walkT + i * 30_000).toISOString();
      walk.push(
        pt(34.8207 + i * 0.00005, 32.3995 + i * 0.00004, t, { deviceTimeUtc: t })
      );
    }
    const kept = excludeFarGpsOutliers([...noise, ...walk]);
    expect(kept.every((p) => p.lng < 33)).toBe(true);
    const route = resolveHistoryRoutePositions([...noise, ...walk]);
    expect(route.length).toBeGreaterThan(20);
    expect(route.every((p) => Math.abs(p.lng - 32.4) < 0.05)).toBe(true);
  });

  it('seeds the route in the densest walk, not an earlier inbound drive within 10 km', () => {
    const drive = [];
    const driveT = Date.parse('2026-08-15T09:50:00.000Z');
    for (let i = 0; i < 6; i++) {
      const t = new Date(driveT + i * 60_000).toISOString();
      // ~8 km east of the densest Paphos cell — within outlier radius, too fast to join.
      drive.push(pt(34.77 + i * 0.002, 32.48 - i * 0.003, t, { deviceTimeUtc: t }));
    }
    const walk = [];
    const walkT = Date.parse('2026-08-15T10:40:00.000Z');
    for (let i = 0; i < 40; i++) {
      const t = new Date(walkT + i * 30_000).toISOString();
      walk.push(
        pt(34.8207 + i * 0.00005, 32.3995 + i * 0.00004, t, { deviceTimeUtc: t })
      );
    }
    const route = resolveHistoryRoutePositions([...drive, ...walk]);
    expect(route.length).toBeGreaterThan(20);
    expect(route.every((p) => Math.abs(p.lng - 32.4) < 0.05)).toBe(true);
    expect(route[0].lat).toBeGreaterThan(34.81);
  });
});
