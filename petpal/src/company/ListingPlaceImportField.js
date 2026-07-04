import React, { useCallback, useMemo, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { haversineKm } from '../bookings/bookingBrowseUtils';
import { searchOsmPlaces } from './placeSearch';

const mapsLib = ['places'];
const mapsScriptId = 'petpal-google-maps';
/** Max km between registered pin and Google listing — prevents importing another store. */
const MAX_PIN_DISTANCE_KM = 0.2;

function formatOpeningHours(weekdayText = []) {
  if (!weekdayText.length) return '';
  return weekdayText.join('; ').slice(0, 240);
}

function hasRegisteredPin(profile) {
  const lat = Number(profile?.lat);
  const lng = Number(profile?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function placeImportPayload(place) {
  return {
    displayName: place.name || '',
    address: place.formatted_address || '',
    phone: place.formatted_phone_number || place.international_phone_number || '',
    workingHours: formatOpeningHours(place.opening_hours?.weekday_text),
    googlePlaceId: place.place_id || '',
  };
}

function distanceKmToPlace(place, lat, lng) {
  const loc = place?.geometry?.location;
  if (!loc) return Infinity;
  const plat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
  const plng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
  return haversineKm(lat, lng, plat, plng);
}

/**
 * Import listing data only from the business registered map pin (set during application).
 * @param {{ profile: import('./companyTypes').CompanyProfile | null, onImport: Function }} props
 */
export default function ListingPlaceImportField({ profile, onImport }) {
  if (!hasRegisteredPin(profile)) {
    return (
      <p className="pp-subtle pp-listingPlaceImport__hint">
        Map pin required. Apply for a business account and set your location on the map to unlock listing import.
      </p>
    );
  }

  const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  if (key) {
    return <VerifiedGoogleListingImport apiKey={key} profile={profile} onImport={onImport} />;
  }
  return <VerifiedOsmListingImport profile={profile} onImport={onImport} />;
}

function VerifiedGoogleListingImport({ apiKey, profile, onImport }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: mapsScriptId,
    googleMapsApiKey: apiKey,
    libraries: mapsLib,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(null);

  const lat = Number(profile.lat);
  const lng = Number(profile.lng);
  const businessName = String(profile.businessName || profile.displayName || '').trim();
  const storedPlaceId = String(profile.googlePlaceId || '').trim();

  const pinLabel = useMemo(() => {
    if (profile.addressLine) return profile.addressLine;
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }, [profile.addressLine, lat, lng]);

  const fetchPlaceDetails = useCallback(
    (placeId) =>
      new Promise((resolve, reject) => {
        const el = document.createElement('div');
        const svc = new window.google.maps.places.PlacesService(el);
        svc.getDetails(
          {
            placeId,
            fields: [
              'place_id',
              'name',
              'geometry',
              'formatted_address',
              'formatted_phone_number',
              'international_phone_number',
              'opening_hours',
            ],
          },
          (place, status) => {
            if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
              reject(new Error('Could not load your Google listing.'));
              return;
            }
            if (distanceKmToPlace(place, lat, lng) > MAX_PIN_DISTANCE_KM) {
              reject(new Error('That listing is too far from your registered map pin.'));
              return;
            }
            resolve(place);
          }
        );
      }),
    [lat, lng]
  );

  const findPlaceAtPin = useCallback(() => {
    if (!isLoaded || !window.google?.maps?.places) {
      return Promise.reject(new Error('Maps are still loading…'));
    }
    const query = businessName || profile.addressLine || 'business';
    return new Promise((resolve, reject) => {
      const el = document.createElement('div');
      const svc = new window.google.maps.places.PlacesService(el);
      const center = new window.google.maps.LatLng(lat, lng);
      svc.findPlaceFromQuery(
        {
          query,
          fields: ['place_id', 'name', 'geometry', 'formatted_address'],
          locationBias: new window.google.maps.Circle({ center, radius: 150 }),
        },
        (results, status) => {
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
            reject(new Error('No Google listing found at your registered map pin.'));
            return;
          }
          const nearest = results
            .map((place) => ({ place, dist: distanceKmToPlace(place, lat, lng) }))
            .filter(({ dist }) => dist <= MAX_PIN_DISTANCE_KM)
            .sort((a, b) => a.dist - b.dist)[0];
          if (!nearest) {
            reject(new Error('No Google listing matches your registered map pin.'));
            return;
          }
          resolve(nearest.place);
        }
      );
    });
  }, [businessName, isLoaded, lat, lng, profile.addressLine]);

  const loadListing = useCallback(async () => {
    setErr('');
    setBusy(true);
    setPreview(null);
    try {
      if (loadError) throw new Error('Google Maps could not load.');
      let place;
      if (storedPlaceId) {
        place = await fetchPlaceDetails(storedPlaceId);
      } else {
        const found = await findPlaceAtPin();
        if (!found.place_id) throw new Error('No verified listing at your pin.');
        place = await fetchPlaceDetails(found.place_id);
      }
      const payload = placeImportPayload(place);
      setPreview(payload);
      onImport(payload);
    } catch (e) {
      setErr(e?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }, [fetchPlaceDetails, findPlaceAtPin, loadError, onImport, storedPlaceId]);

  return (
    <VerifiedImportUi
      businessName={businessName || 'Your business'}
      pinLabel={pinLabel}
      busy={busy}
      err={err}
      preview={preview}
      onLoad={loadListing}
      disabled={!isLoaded && !loadError}
      hint={
        storedPlaceId
          ? 'Loads data only from your verified Google listing at the map pin you set when applying.'
          : 'Finds the Google listing at your registered map pin — you cannot import other stores.'
      }
    />
  );
}

function VerifiedOsmListingImport({ profile, onImport }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(null);

  const lat = Number(profile.lat);
  const lng = Number(profile.lng);
  const businessName = String(profile.businessName || '').trim();
  const pinLabel = profile.addressLine || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const loadListing = useCallback(async () => {
    setErr('');
    setBusy(true);
    setPreview(null);
    try {
      const q = [businessName, profile.addressLine].filter(Boolean).join(', ').trim();
      const list = await searchOsmPlaces(q || `${lat}, ${lng}`);
      const match = list.find((p) => haversineKm(lat, lng, p.lat, p.lng) <= MAX_PIN_DISTANCE_KM);
      if (!match) throw new Error('No listing found near your registered map pin.');
      const payload = {
        displayName: match.label.split(',')[0]?.trim() || businessName,
        address: match.label,
        phone: '',
        workingHours: '',
        googlePlaceId: '',
      };
      setPreview(payload);
      onImport(payload);
    } catch (e) {
      setErr(e?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }, [businessName, lat, lng, onImport, profile.addressLine]);

  return (
    <VerifiedImportUi
      businessName={businessName || 'Your business'}
      pinLabel={pinLabel}
      busy={busy}
      err={err}
      preview={preview}
      onLoad={loadListing}
      hint="Loads address data from OpenStreetMap at your registered map pin only."
    />
  );
}

function VerifiedImportUi({ businessName, pinLabel, busy, err, preview, onLoad, disabled, hint }) {
  return (
    <div className="pp-listingPlaceImport">
      <p className="pp-subtle pp-listingPlaceImport__hint">{hint}</p>
      <div className="pp-listingPlaceImport__card">
        <div className="pp-listingPlaceImport__meta">
          <strong>{businessName}</strong>
          <span className="pp-muted">{pinLabel}</span>
        </div>
        <button type="button" className="pp-btn pp-btn--ghost" disabled={busy || disabled} onClick={() => void onLoad()}>
          {busy ? 'Loading…' : 'Load listing data'}
        </button>
      </div>
      {preview ? (
        <p className="pp-success pp-listingPlaceImport__ok">
          Loaded {preview.displayName}{preview.address ? ` — ${preview.address}` : ''}
        </p>
      ) : null}
      {err ? <p className="pp-error pp-listingPlaceImport__err">{err}</p> : null}
    </div>
  );
}
