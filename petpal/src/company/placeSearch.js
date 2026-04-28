import { defaultMapCenter } from './locationDefaults';

/**
 * Search places (businesses, POIs, addresses) via Photon — OSM-backed, no API key.
 * Biased toward Cyprus using the same default center as the map.
 *
 * @param {string} query
 * @returns {Promise<{ lat: number, lng: number, label: string, type?: string }[]>}
 */
export async function searchOsmPlaces(query) {
  let q = String(query || '').trim();
  if (q.length < 2) return [];

  if (!/cyprus|κύπρος|limassol|lemesos|nicosia|larnaca|paphos|famagusta|kyrenia|paralimni/i.test(q)) {
    q = `${q} Cyprus`;
  }

  const params = new URLSearchParams({
    q,
    limit: '10',
    lang: 'en',
  });
  params.set('lat', String(defaultMapCenter.lat));
  params.set('lon', String(defaultMapCenter.lng));

  const url = `https://photon.komoot.io/api/?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  const features = Array.isArray(data.features) ? data.features : [];

  return features.map((f) => {
    const coords = f.geometry?.coordinates;
    const lng = coords?.[0];
    const lat = coords?.[1];
    const p = f.properties || {};
    const parts = [p.name, p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street, p.city, p.state, p.country].filter(
      Boolean
    );
    const label = parts.length ? parts.join(', ') : p.label || q;
    return {
      lat: Number(lat),
      lng: Number(lng),
      label: String(label),
      type: p.type ? String(p.type) : undefined,
    };
  }).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
}
