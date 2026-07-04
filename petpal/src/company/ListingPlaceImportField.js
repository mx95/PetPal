import React, { useCallback, useMemo, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { defaultMapCenter } from './locationDefaults';
import { searchOsmPlaces } from './placeSearch';
import FillFromAboveButton from './FillFromAboveButton';

const mapsLib = ['places'];
const mapsScriptId = 'petpal-google-maps';

function formatOpeningHours(weekdayText = []) {
  if (!weekdayText.length) return '';
  return weekdayText.join('; ').slice(0, 240);
}

/**
 * Search Google Maps / OSM and import listing fields into the provider profile form.
 * @param {{ onImport: (data: { displayName?: string, address?: string, phone?: string, workingHours?: string }) => void, displayName?: string, address?: string }} props
 */
export default function ListingPlaceImportField({ onImport, displayName = '', address = '' }) {
  const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  if (key) {
    return (
      <GoogleListingImport
        apiKey={key}
        onImport={onImport}
        displayName={displayName}
        address={address}
      />
    );
  }
  return (
    <OsmListingImport onImport={onImport} displayName={displayName} address={address} />
  );
}

function GoogleListingImport({ apiKey, onImport, displayName, address }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: mapsScriptId,
    googleMapsApiKey: apiKey,
    libraries: mapsLib,
  });
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

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
          address: p.label,
        }))
      );
      if (!list.length) setErr('No results. Try a different search.');
    } catch (e) {
      setErr(e?.message || 'Search failed.');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, []);

  const runGoogle = useCallback(() => {
    if (!isLoaded || !window.google?.maps?.places) return;
    const t = q.trim();
    if (t.length < 2) {
      setErr('Type at least 2 characters.');
      return;
    }
    setErr('');
    setBusy(true);
    const ac = new window.google.maps.places.AutocompleteService();
    const center = new window.google.maps.LatLng(defaultMapCenter.lat, defaultMapCenter.lng);
    ac.getPlacePredictions(
      {
        input: t,
        componentRestrictions: { country: 'cy' },
        locationBias: new window.google.maps.Circle({ center, radius: 200_000 }),
      },
      (predictions, status) => {
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK &&
          status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS
        ) {
          setBusy(false);
          void runOsm(t);
          return;
        }
        if (!predictions?.length) {
          setRows([]);
          setBusy(false);
          void runOsm(t);
          return;
        }
        setRows(
          predictions.slice(0, 10).map((p) => ({
            _key: p.place_id,
            kind: 'g',
            placeId: p.place_id,
            label: p.structured_formatting?.main_text || p.description,
            sublabel: p.structured_formatting?.secondary_text || '',
          }))
        );
        setBusy(false);
      }
    );
  }, [isLoaded, q, runOsm]);

  const run = useCallback(() => {
    const t = q.trim();
    if (t.length < 2) {
      setErr('Type at least 2 characters.');
      return;
    }
    if (loadError) {
      void runOsm(t);
      return;
    }
    if (isLoaded) runGoogle();
    else setErr('Maps are still loading…');
  }, [loadError, isLoaded, runGoogle, runOsm, q]);

  const onSelect = useCallback(
    (r) => {
      setErr('');
      if (r.kind === 'osm') {
        onImport({ displayName: r.label.split(',')[0]?.trim() || r.label, address: r.address || r.label });
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
          fields: ['name', 'formatted_address', 'formatted_phone_number', 'international_phone_number', 'opening_hours'],
        },
        (place, status) => {
          setBusy(false);
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
            setErr('Could not load that listing. Try another result.');
            return;
          }
          onImport({
            displayName: place.name || r.label,
            address: place.formatted_address || r.sublabel || '',
            phone: place.formatted_phone_number || place.international_phone_number || '',
            workingHours: formatOpeningHours(place.opening_hours?.weekday_text),
          });
          setRows([]);
        }
      );
    },
    [isLoaded, onImport]
  );

  const canFill = useMemo(
    () => Boolean([displayName, address].filter(Boolean).join(' ').trim()),
    [displayName, address]
  );

  return (
    <ListingSearchUi
      q={q}
      setQ={setQ}
      rows={rows}
      busy={busy}
      err={err}
      run={run}
      onSelect={onSelect}
      canFill={canFill}
      onFill={() => setQ([displayName, address].filter(Boolean).join(' ').trim())}
      hint="Search your Google Maps listing to fill name, address, phone, and hours."
    />
  );
}

function OsmListingImport({ onImport, displayName, address }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    const t = q.trim();
    if (t.length < 2) {
      setErr('Type at least 2 characters.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const list = await searchOsmPlaces(t);
      setRows(
        list.map((p, i) => ({
          _key: `o-${i}`,
          kind: 'osm',
          label: p.label,
          sublabel: p.type,
          address: p.label,
        }))
      );
      if (!list.length) setErr('No results. Try adding a city name.');
    } catch (e) {
      setErr(e?.message || 'Search failed.');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [q]);

  const canFill = useMemo(
    () => Boolean([displayName, address].filter(Boolean).join(' ').trim()),
    [displayName, address]
  );

  return (
    <ListingSearchUi
      q={q}
      setQ={setQ}
      rows={rows}
      busy={busy}
      err={err}
      run={run}
      onSelect={(r) => {
        onImport({ displayName: r.label.split(',')[0]?.trim() || r.label, address: r.address || r.label });
        setRows([]);
      }}
      canFill={canFill}
      onFill={() => setQ([displayName, address].filter(Boolean).join(' ').trim())}
      hint="Search OpenStreetMap to fill your listing name and address."
    />
  );
}

function ListingSearchUi({ q, setQ, rows, busy, err, run, onSelect, canFill, onFill, hint }) {
  return (
    <div className="pp-companyMapSearch pp-listingPlaceImport">
      <p className="pp-subtle pp-companyMapSearch__hint">{hint}</p>
      <div className="pp-companyMapSearch__row">
        <input
          className="pp-input pp-companyMapSearch__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), run())}
          placeholder="Business name or address"
          aria-label="Search Google Maps listing"
        />
        <div className="pp-companyMapSearch__actions">
          <button type="button" className="pp-btn pp-companyMapSearch__btn" disabled={busy} onClick={run}>
            {busy ? '…' : 'Search'}
          </button>
          <FillFromAboveButton onClick={onFill} disabled={!canFill} />
        </div>
      </div>
      {err ? <p className="pp-error pp-companyMapSearch__err">{err}</p> : null}
      {rows.length > 0 ? (
        <ul className="pp-companyMapSearch__results" role="listbox" aria-label="Listing search results">
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
