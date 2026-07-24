import React, { useCallback, useMemo, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { haversineKm } from '../bookings/bookingBrowseUtils';
import { useI18n } from '../i18n/I18nContext';
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
  const { t } = useI18n();
  if (!hasRegisteredPin(profile)) {
    return (
      <p className="pp-subtle pp-listingPlaceImport__hint">
        {t('companyApply.importMapPinRequired')}
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
  const { t } = useI18n();
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
              reject(new Error(t('companyApply.importGoogleListingLoadFailed')));
              return;
            }
            if (distanceKmToPlace(place, lat, lng) > MAX_PIN_DISTANCE_KM) {
              reject(new Error(t('companyApply.importListingTooFar')));
              return;
            }
            resolve(place);
          }
        );
      }),
    [lat, lng, t]
  );

  const findPlaceAtPin = useCallback(() => {
    if (!isLoaded || !window.google?.maps?.places) {
      return Promise.reject(new Error(t('companyApply.mapsStillLoading')));
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
            reject(new Error(t('companyApply.importNoGoogleListingAtPin')));
            return;
          }
          const nearest = results
            .map((place) => ({ place, dist: distanceKmToPlace(place, lat, lng) }))
            .filter(({ dist }) => dist <= MAX_PIN_DISTANCE_KM)
            .sort((a, b) => a.dist - b.dist)[0];
          if (!nearest) {
            reject(new Error(t('companyApply.importNoGoogleListingMatch')));
            return;
          }
          resolve(nearest.place);
        }
      );
    });
  }, [businessName, isLoaded, lat, lng, profile.addressLine, t]);

  const loadListing = useCallback(async () => {
    setErr('');
    setBusy(true);
    setPreview(null);
    try {
      if (loadError) throw new Error(t('companyApply.importGoogleMapsLoadFailed'));
      let place;
      if (storedPlaceId) {
        place = await fetchPlaceDetails(storedPlaceId);
      } else {
        const found = await findPlaceAtPin();
        if (!found.place_id) throw new Error(t('companyApply.importNoVerifiedListingAtPin'));
        place = await fetchPlaceDetails(found.place_id);
      }
      const payload = placeImportPayload(place);
      setPreview(payload);
      onImport(payload);
    } catch (e) {
      setErr(e?.message || t('companyApply.importFailed'));
    } finally {
      setBusy(false);
    }
  }, [fetchPlaceDetails, findPlaceAtPin, loadError, onImport, storedPlaceId, t]);

  return (
    <VerifiedImportUi
      businessName={businessName || t('companyApply.yourBusinessFallback')}
      pinLabel={pinLabel}
      busy={busy}
      err={err}
      preview={preview}
      onLoad={loadListing}
      disabled={!isLoaded && !loadError}
      hint={
        storedPlaceId
          ? t('companyApply.importGoogleStoredHint')
          : t('companyApply.importGoogleFindHint')
      }
    />
  );
}

function VerifiedOsmListingImport({ profile, onImport }) {
  const { t } = useI18n();
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
      if (!match) throw new Error(t('companyApply.importNoListingNearPin'));
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
      setErr(e?.message || t('companyApply.importFailed'));
    } finally {
      setBusy(false);
    }
  }, [businessName, lat, lng, onImport, profile.addressLine, t]);

  return (
    <VerifiedImportUi
      businessName={businessName || t('companyApply.yourBusinessFallback')}
      pinLabel={pinLabel}
      busy={busy}
      err={err}
      preview={preview}
      onLoad={loadListing}
      hint={t('companyApply.importOsmHint')}
    />
  );
}

function VerifiedImportUi({ businessName, pinLabel, busy, err, preview, onLoad, disabled, hint }) {
  const { t } = useI18n();
  return (
    <div className="pp-listingPlaceImport">
      <p className="pp-subtle pp-listingPlaceImport__hint">{hint}</p>
      <div className="pp-listingPlaceImport__card">
        <div className="pp-listingPlaceImport__meta">
          <strong>{businessName}</strong>
          <span className="pp-muted">{pinLabel}</span>
        </div>
        <button type="button" className="pp-btn pp-btn--ghost" disabled={busy || disabled} onClick={() => void onLoad()}>
          {busy ? t('common.loading') : t('companyApply.loadListingData')}
        </button>
      </div>
      {preview ? (
        <p className="pp-success pp-listingPlaceImport__ok">
          {t('companyApply.importLoaded', {
            name: preview.displayName,
            address: preview.address ? ` — ${preview.address}` : '',
          })}
        </p>
      ) : null}
      {err ? <p className="pp-error pp-listingPlaceImport__err">{err}</p> : null}
    </div>
  );
}
