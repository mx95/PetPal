import React, { useCallback, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { defaultMapCenter } from './locationDefaults';
import { searchOsmPlaces } from './placeSearch';

const mapsLib = ['places'];
/** Must match `../config/googleMapsLoaderId` and the id used in Nearby — one script load for the whole app. */
const mapsScriptId = 'petpal-google-maps';

/**
 * @param {{ onPicked: (lat: number, lng: number) => void, businessName: string, addressLine: string }} props
 */
export default function CompanyPlaceSearchField({ onPicked, businessName, addressLine }) {
  const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  if (key) {
    return <GooglePlaceSearch key={key} apiKey={key} onPicked={onPicked} businessName={businessName} addressLine={addressLine} />;
  }
  return <OsmPlaceSearch onPicked={onPicked} businessName={businessName} addressLine={addressLine} />;
}

/**
 * @param {{ apiKey: string, onPicked: (lat: number, lng: number) => void, businessName: string, addressLine: string }} props
 */
function GooglePlaceSearch({ apiKey, onPicked, businessName, addressLine }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: mapsScriptId,
    googleMapsApiKey: apiKey,
    libraries: mapsLib,
  });
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(/** @type {any[]} */ ([]));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(/** @type {string} */ (''));

  const runOsm = useCallback(async (text) => {
    setErr('');
    setBusy(true);
    try {
      const list = await searchOsmPlaces(text);
      setRows(
        list.map((p, i) => ({
          _key: `osm-${i}`,
          kind: 'osm',
          label: p.label,
          sublabel: p.type,
          lat: p.lat,
          lng: p.lng,
        }))
      );
      if (list.length === 0) setErr('No results. Refine the name or set the pin on the map.');
    } catch (e) {
      setErr(e?.message || 'Search failed.');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  const runGoogle = useCallback(() => {
    if (!isLoaded || !window.google?.maps?.places) return;
    setErr('');
    const t = q.trim();
    if (t.length < 2) {
      setErr('Type at least 2 characters.');
      return;
    }
    setBusy(true);
    const ac = new window.google.maps.places.AutocompleteService();
    const center = new window.google.maps.LatLng(defaultMapCenter.lat, defaultMapCenter.lng);
    const locationBias = new window.google.maps.Circle({ center, radius: 200_000 });
    const req = {
      input: t,
      componentRestrictions: { country: 'cy' },
      locationBias,
    };
    ac.getPlacePredictions(req, (predictions, status) => {
      if (
        status !== window.google.maps.places.PlacesServiceStatus.OK &&
        status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS
      ) {
        setBusy(false);
        runOsm(t);
        return;
      }
      if (!predictions || predictions.length === 0) {
        setRows([]);
        setBusy(false);
        runOsm(t);
        return;
      }
      setRows(
        predictions.slice(0, 12).map((p) => ({
          _key: p.place_id,
          kind: 'g',
          placeId: p.place_id,
          label: p.structured_formatting?.main_text || p.description,
          sublabel: p.structured_formatting?.secondary_text || '',
        }))
      );
      setBusy(false);
    });
  }, [q, isLoaded, runOsm]);

  const run = useCallback(() => {
    const t = q.trim();
    if (t.length < 2) {
      setErr('Type at least 2 characters.');
      return;
    }
    if (loadError) {
      runOsm(t);
      return;
    }
    if (isLoaded) runGoogle();
    else setErr('Maps are still loading…');
  }, [loadError, isLoaded, runGoogle, runOsm, q]);

  const onSelect = useCallback(
    (r) => {
      setErr('');
      if (r.kind === 'osm') {
        onPicked(r.lat, r.lng);
        setRows([]);
        return;
      }
      if (!isLoaded || !r.placeId) return;
      setBusy(true);
      const el = document.createElement('div');
      const svc = new window.google.maps.places.PlacesService(el);
      svc.getDetails(
        {
          placeId: r.placeId,
          fields: ['geometry', 'name', 'formatted_address', 'place_id'],
        },
        (place, status) => {
          setBusy(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const loc = place.geometry.location;
            onPicked(loc.lat(), loc.lng());
            setRows([]);
            return;
          }
          setErr('Could not load that place. Try another result or the map.');
        }
      );
    },
    [isLoaded, onPicked]
  );

  const fill = useCallback(() => {
    const s = [businessName, addressLine].filter(Boolean).join(' ').trim();
    if (s) setQ(s);
  }, [businessName, addressLine]);

  return (
    <div className="pp-companyMapSearch pp-companyMapSearch--google">
      <p className="pp-subtle pp-companyMapSearch__hint">
        Search uses <strong>Google Places</strong> in Cyprus, then the map to fine-tune. If nothing matches, we try
        OpenStreetMap.
      </p>
      {loadError ? (
        <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4 }}>
          Google could not load ({loadError.message || 'error'}). Using OpenStreetMap search only — check your API key
          and that Places is enabled in Google Cloud.
        </p>
      ) : !isLoaded ? (
        <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4 }}>
          Loading map services…
        </p>
      ) : null}
      <div className="pp-companyMapSearch__row">
        <input
          className="pp-input pp-companyMapSearch__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), run())}
          placeholder="Business name, street, or city in Cyprus"
          aria-label="Search for your business"
        />
        <button type="button" className="pp-btn pp-companyMapSearch__btn" disabled={busy} onClick={run}>
          {busy ? '…' : 'Search'}
        </button>
      </div>
      <button type="button" className="pp-link pp-companyMapSearch__fill" onClick={fill}>
        Fill from name and address above
      </button>
      {err ? <p className="pp-error pp-companyMapSearch__err">{err}</p> : null}
      {rows.length > 0 ? (
        <ul className="pp-companyMapSearch__results" role="listbox" aria-label="Search results">
          {rows.map((r) => (
            <li key={r._key}>
              <button type="button" className="pp-companyMapSearch__resultBtn" onClick={() => onSelect(r)}>
                <span className="pp-companyMapSearch__resultLabel">{r.label}</span>
                {r.sublabel ? <span className="pp-companyMapSearch__resultType">{r.sublabel}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * @param {{ onPicked: (lat: number, lng: number) => void, businessName: string, addressLine: string }} props
 */
function OsmPlaceSearch({ onPicked, businessName, addressLine }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(/** @type {any[]} */ ([]));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    setErr('');
    const t = q.trim();
    if (t.length < 2) {
      setErr('Type at least 2 characters.');
      return;
    }
    setBusy(true);
    try {
      const list = await searchOsmPlaces(t);
      setRows(
        list.map((p, i) => ({
          _key: `o-${i}`,
          kind: 'osm',
          label: p.label,
          sublabel: p.type,
          lat: p.lat,
          lng: p.lng,
        }))
      );
      if (list.length === 0) setErr('No results. Add a city or set the pin manually on the map.');
    } catch (e) {
      setErr(e?.message || 'Search failed.');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [q]);

  const fill = useCallback(() => {
    const s = [businessName, addressLine].filter(Boolean).join(' ').trim();
    if (s) setQ(s);
  }, [businessName, addressLine]);

  return (
    <div className="pp-companyMapSearch">
      <p className="pp-subtle pp-companyMapSearch__hint">
        Search with <strong>OpenStreetMap</strong> (free; not every business is listed). You can also drag the pin.
      </p>
      <div className="pp-companyMapSearch__row">
        <input
          className="pp-input pp-companyMapSearch__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), run())}
          placeholder="e.g. Pet shop, Makarios, Limassol…"
          aria-label="Search for your business on the map"
        />
        <button type="button" className="pp-btn pp-companyMapSearch__btn" disabled={busy} onClick={run}>
          {busy ? '…' : 'Search'}
        </button>
      </div>
      <button type="button" className="pp-link pp-companyMapSearch__fill" onClick={fill}>
        Fill from name and address above
      </button>
      {err ? <p className="pp-error pp-companyMapSearch__err">{err}</p> : null}
      {rows.length > 0 ? (
        <ul className="pp-companyMapSearch__results" role="listbox" aria-label="Map search results">
          {rows.map((r) => (
            <li key={r._key}>
              <button
                type="button"
                className="pp-companyMapSearch__resultBtn"
                onClick={() => {
                  onPicked(r.lat, r.lng);
                  setRows([]);
                  setErr('');
                }}
              >
                <span className="pp-companyMapSearch__resultLabel">{r.label}</span>
                {r.sublabel ? <span className="pp-companyMapSearch__resultType">{r.sublabel}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
