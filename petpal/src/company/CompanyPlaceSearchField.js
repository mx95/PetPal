import React, { useCallback, useMemo, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { useI18n } from '../i18n/I18nContext';
import { defaultMapCenter } from './locationDefaults';
import { searchOsmPlaces } from './placeSearch';
import FillFromAboveButton from './FillFromAboveButton';

const mapsLib = ['places'];
/** Must match `../config/googleMapsLoaderId` and the id used in Nearby — one script load for the whole app. */
const mapsScriptId = 'petpal-google-maps';

function formatGoogleOpeningHours(openingHours) {
  if (!openingHours?.weekday_text?.length) return '';
  return openingHours.weekday_text.join(', ');
}

/**
 * @param {{ onPicked: (lat: number, lng: number, meta?: object) => void, businessName: string, addressLine: string }} props
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
  const { t } = useI18n();
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
      if (list.length === 0) setErr(t('companyApply.mapSearchNoResultsGoogleFallback'));
    } catch (e) {
      setErr(e?.message || t('companyApply.mapSearchFailed'));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [t]);

  const runGoogle = useCallback(() => {
    if (!isLoaded || !window.google?.maps?.places) return;
    setErr('');
    const text = q.trim();
    if (text.length < 2) {
      setErr(t('companyApply.mapSearchMinChars'));
      return;
    }
    setBusy(true);
    const ac = new window.google.maps.places.AutocompleteService();
    const center = new window.google.maps.LatLng(defaultMapCenter.lat, defaultMapCenter.lng);
    const locationBias = new window.google.maps.Circle({ center, radius: 200_000 });
    const req = {
      input: text,
      componentRestrictions: { country: 'cy' },
      locationBias,
    };
    ac.getPlacePredictions(req, (predictions, status) => {
      if (
        status !== window.google.maps.places.PlacesServiceStatus.OK &&
        status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS
      ) {
        setBusy(false);
        runOsm(text);
        return;
      }
      if (!predictions || predictions.length === 0) {
        setRows([]);
        setBusy(false);
        runOsm(text);
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
  }, [q, isLoaded, runOsm, t]);

  const run = useCallback(() => {
    const text = q.trim();
    if (text.length < 2) {
      setErr(t('companyApply.mapSearchMinChars'));
      return;
    }
    if (loadError) {
      runOsm(text);
      return;
    }
    if (isLoaded) runGoogle();
    else setErr(t('companyApply.mapsStillLoading'));
  }, [loadError, isLoaded, runGoogle, runOsm, q, t]);

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
          fields: [
            'geometry',
            'name',
            'formatted_address',
            'place_id',
            'formatted_phone_number',
            'international_phone_number',
            'opening_hours',
            'website',
          ],
        },
        (place, status) => {
          setBusy(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const loc = place.geometry.location;
            onPicked(loc.lat(), loc.lng(), {
              placeId: place.place_id || r.placeId || '',
              placeName: place.name || r.label || '',
              placeAddress: place.formatted_address || r.sublabel || '',
              phoneNumber: place.international_phone_number || place.formatted_phone_number || '',
              workingHours: formatGoogleOpeningHours(place.opening_hours),
              website: place.website || '',
            });
            setRows([]);
            return;
          }
          setErr(t('companyApply.mapSearchPlaceLoadFailed'));
        }
      );
    },
    [isLoaded, onPicked, t]
  );

  const canFill = useMemo(
    () => Boolean([businessName, addressLine].filter(Boolean).join(' ').trim()),
    [businessName, addressLine]
  );
  const fill = useCallback(() => {
    const s = [businessName, addressLine].filter(Boolean).join(' ').trim();
    if (s) setQ(s);
  }, [businessName, addressLine]);

  return (
    <div className="pp-companyMapSearch pp-companyMapSearch--google">
      <p className="pp-subtle pp-companyMapSearch__hint">
        {t('companyApply.mapSearchGoogleHint')}
      </p>
      {loadError ? (
        <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4 }}>
          {t('companyApply.googleLoadError', { reason: loadError.message || t('common.error') })}
        </p>
      ) : !isLoaded ? (
        <p className="pp-subtle" style={{ fontSize: 12, marginTop: 4 }}>
          {t('companyApply.loadingMapServices')}
        </p>
      ) : null}
      <div className="pp-companyMapSearch__row">
        <input
          className="pp-input pp-companyMapSearch__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), run())}
          placeholder={t('companyApply.mapSearchGooglePlaceholder')}
          aria-label={t('companyApply.mapSearchAria')}
        />
        <div className="pp-companyMapSearch__actions">
          <button type="button" className="pp-btn pp-companyMapSearch__btn" disabled={busy} onClick={run}>
            {busy ? '…' : t('companyApply.mapSearchButton')}
          </button>
          <FillFromAboveButton onClick={fill} disabled={!canFill} />
        </div>
      </div>
      {err ? <p className="pp-error pp-companyMapSearch__err">{err}</p> : null}
      {rows.length > 0 ? (
        <ul className="pp-companyMapSearch__results" role="listbox" aria-label={t('companyApply.mapSearchResultsAria')}>
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
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(/** @type {any[]} */ ([]));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    setErr('');
    const text = q.trim();
    if (text.length < 2) {
      setErr(t('companyApply.mapSearchMinChars'));
      return;
    }
    setBusy(true);
    try {
      const list = await searchOsmPlaces(text);
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
      if (list.length === 0) setErr(t('companyApply.mapSearchNoResultsOsm'));
    } catch (e) {
      setErr(e?.message || t('companyApply.mapSearchFailed'));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [q, t]);

  const canFill = useMemo(
    () => Boolean([businessName, addressLine].filter(Boolean).join(' ').trim()),
    [businessName, addressLine]
  );
  const fill = useCallback(() => {
    const s = [businessName, addressLine].filter(Boolean).join(' ').trim();
    if (s) setQ(s);
  }, [businessName, addressLine]);

  return (
    <div className="pp-companyMapSearch">
      <p className="pp-subtle pp-companyMapSearch__hint">
        {t('companyApply.mapSearchOsmHint')}
      </p>
      <div className="pp-companyMapSearch__row">
        <input
          className="pp-input pp-companyMapSearch__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), run())}
          placeholder={t('companyApply.mapSearchOsmPlaceholder')}
          aria-label={t('companyApply.mapSearchOsmAria')}
        />
        <div className="pp-companyMapSearch__actions">
          <button type="button" className="pp-btn pp-companyMapSearch__btn" disabled={busy} onClick={run}>
            {busy ? '…' : t('companyApply.mapSearchButton')}
          </button>
          <FillFromAboveButton onClick={fill} disabled={!canFill} />
        </div>
      </div>
      {err ? <p className="pp-error pp-companyMapSearch__err">{err}</p> : null}
      {rows.length > 0 ? (
        <ul className="pp-companyMapSearch__results" role="listbox" aria-label={t('companyApply.mapSearchMapResultsAria')}>
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
