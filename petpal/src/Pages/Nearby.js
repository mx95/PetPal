import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import {
  getCategoryById,
  NEARBY_CATEGORIES,
  NEARBY_SEARCH_RADIUS_M,
} from '../config/nearbyPlaceCategories';
import { GOOGLE_MAPS_LOADER_ID } from '../config/googleMapsLoaderId';
import { subscribeGoogleMapsAuthFailure } from '../config/googleMapsAuthFailure';
import { useI18n } from '../i18n/I18nContext';
import { subscribeProviders } from '../bookings/providerDirectoryFirestore';
import { providerBoostIsActive, providerDistanceKm } from '../bookings/bookingBrowseUtils';
import { isFirebaseConfigured } from '../firebase';

const mapContainerStyle = { width: '100%', height: 'min(62vh, 640px)', minHeight: 340, borderRadius: 28 };
const DEFAULT_CENTER = { lat: 35.173, lng: 33.364 };
const mapOptions = { disableDefaultUI: false, streetViewControl: false, mapTypeControl: false };

function placePhotoUrl(place, width = 360, height = 220) {
  try {
    return place?.photos?.[0]?.getUrl({ maxWidth: width, maxHeight: height }) || '';
  } catch {
    return '';
  }
}

function placeLatLng(place) {
  const loc = place?.geometry?.location;
  if (!loc) return null;
  const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
  const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function distanceKm(from, place) {
  const to = placeLatLng(place);
  if (!from || !to) return null;
  const r = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function mapsUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place?.name || '')}&query_place_id=${encodeURIComponent(place?.place_id || '')}`;
}

function NoKeyView() {
  const { t } = useI18n();
  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-badge">{t('nearbyPage.badge')}</div>
        <h1 className="pp-h1" style={{ marginTop: 10 }}>
          {t('nearbyPage.noKeyTitle')}
        </h1>
        <p className="pp-subtle" style={{ maxWidth: 560 }}>
          {t('nearbyPage.noKeyBrief')}
        </p>
      </div>
    </div>
  );
}

function LoadErrorView({ err }) {
  const { t } = useI18n();
  return (
    <div className="pp-card pp-pad" style={{ borderColor: 'rgba(180, 35, 24, 0.35)' }}>
      <p className="pp-error" style={{ margin: 0 }}>
        {t('nearbyPage.loadFailTitle')} {err?.message || String(err)}
      </p>
      <p className="pp-subtle" style={{ marginTop: 10, marginBottom: 0 }}>
        {t('nearbyPage.loadFailHint')}
      </p>
    </div>
  );
}

function NearbyMap({ apiKey }) {
  const { t } = useI18n();
  const [mapsAuthFailed, setMapsAuthFailed] = useState(false);
  useEffect(() => subscribeGoogleMapsAuthFailure(() => setMapsAuthFailed(true)), []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
    libraries: ['places'],
  });

  const [map, setMap] = useState(null);
  const [searchCenter, setSearchCenter] = useState(DEFAULT_CENTER);
  const [locationNote, setLocationNote] = useState(() => ({ kind: 'default' }));
  const [selectedCategoryId, setSelectedCategoryId] = useState(NEARBY_CATEGORIES[0].id);
  const [searchScope, setSearchScope] = useState('radius');
  const [places, setPlaces] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [activePlace, setActivePlace] = useState(null);
  const [locFetching, setLocFetching] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [allProviders, setAllProviders] = useState(/** @type {Record<string, unknown>[]} */ ([]));

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setAllProviders([]);
      return undefined;
    }
    return subscribeProviders(
      (rows) => setAllProviders(rows),
      () => setAllProviders([])
    );
  }, []);

  const petpalPartners = useMemo(() => {
    const center = userLocation || searchCenter;
    const loc = Number.isFinite(center?.lat) && Number.isFinite(center?.lng) ? center : null;
    return allProviders
      .filter((p) => providerBoostIsActive(p))
      .map((p) => ({ p, km: providerDistanceKm(p, loc) }))
      .sort((a, b) => {
        if (a.km != null && b.km != null) return a.km - b.km;
        if (a.km != null) return -1;
        if (b.km != null) return 1;
        return String(a.p.displayName || '').localeCompare(String(b.p.displayName || ''));
      })
      .slice(0, 12);
  }, [allProviders, userLocation, searchCenter]);

  const selectedCategory = useMemo(() => getCategoryById(selectedCategoryId, t), [selectedCategoryId, t]);
  const mapCenter = useMemo(
    () => ({ lat: searchCenter.lat, lng: searchCenter.lng }),
    [searchCenter.lat, searchCenter.lng]
  );

  const runPlacesSearch = useCallback(
    (mode, centerOverride) => {
      if (!map || !isLoaded || !window.google?.maps?.places) return;
      const scope = mode || searchScope;
      const center = centerOverride || searchCenter;
      setActivePlace(null);
      setSearchStatus('loading');
      setPlaces([]);

      const service = new window.google.maps.places.PlacesService(map);
      const cat = NEARBY_CATEGORIES.find((c) => c.id === selectedCategoryId) || NEARBY_CATEGORIES[0];

      const request = {};
      if (cat.type) request.type = cat.type;
      if (cat.keyword) request.keyword = cat.keyword;
      if (!cat.type && !cat.keyword) request.keyword = 'pet';

      if (scope === 'bounds') {
        const bounds = map.getBounds();
        if (!bounds) {
          setSearchStatus('error');
          return;
        }
        request.bounds = bounds;
      } else {
        const loc = new window.google.maps.LatLng(center.lat, center.lng);
        request.location = loc;
        request.radius = NEARBY_SEARCH_RADIUS_M;
      }

      service.nearbySearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          setPlaces(results.slice(0, 20));
          setSearchStatus('ok');
          return;
        }
        if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          setSearchStatus('empty');
          return;
        }
        if (status === window.google.maps.places.PlacesServiceStatus.INVALID_REQUEST) {
          setSearchStatus('invalid_area');
          return;
        }
        setSearchStatus('error');
      });
    },
    [map, isLoaded, searchCenter, selectedCategoryId, searchScope]
  );

  useEffect(() => {
    if (isLoaded && map) runPlacesSearch();
  }, [isLoaded, map, selectedCategoryId, searchCenter.lat, searchCenter.lng, runPlacesSearch]);

  function onUseMyLocation() {
    setLocationNote({ kind: 'none' });
    if (!navigator.geolocation) {
      setLocationNote({ kind: 'text', message: t('nearbyPage.locUnavailable') });
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setLocationNote({
        kind: 'text',
        message: 'Location needs HTTPS or localhost. Open the app on HTTPS, localhost, or the mobile app build.',
      });
      return;
    }
    setLocFetching(true);
    setSearchStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(next);
        setSearchCenter(next);
        setLocFetching(false);
        setLocationNote({ kind: 'none' });
        if (map && window.google?.maps) {
          map.panTo(new window.google.maps.LatLng(next.lat, next.lng));
          map.setZoom(14);
        }
        setSearchScope('radius');
        runPlacesSearch('radius', next);
      },
      (err) => {
        setLocFetching(false);
        setSearchStatus('idle');
        const reason =
          err?.code === 1
            ? 'Location permission was denied. Allow location access for this site/app and try again.'
            : err?.code === 2
              ? 'Your location is unavailable right now. Check GPS/location services and try again.'
              : err?.code === 3
                ? 'Getting your location timed out. Move near a window or try again.'
                : t('nearbyPage.locDenied');
        setLocationNote({ kind: 'text', message: reason });
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 }
    );
  }

  function onSearchThisArea() {
    setSearchScope('bounds');
    runPlacesSearch('bounds');
  }

  function onSearchNearMe() {
    setSearchScope('radius');
    if (map && window.google?.maps) {
      map.panTo(new window.google.maps.LatLng(searchCenter.lat, searchCenter.lng));
      map.setZoom(14);
    }
    runPlacesSearch('radius');
  }

  const radiusKm = NEARBY_SEARCH_RADIUS_M / 1000;

  if (loadError || mapsAuthFailed) {
    const err = loadError || { message: t('nearbyPage.mapsApiNotActivated') };
    return <LoadErrorView err={err} />;
  }
  if (!isLoaded) {
    return <p className="pp-subtle">{t('nearbyPage.loadingMap')}</p>;
  }

  return (
    <div className="pp-nearby-page">
      <div className="pp-nearbyHeader">
        <div>
          <h1 className="pp-nearbyHeader__title">
            {t('nearbyPage.title')}
          </h1>
          <p className="pp-nearbyHeader__sub">{t('nearbyPage.introLead')} nearby places for your pet.</p>
        </div>
        <Link className="pp-link" to="/dashboard">
          {t('common.backDashboard')}
        </Link>
      </div>

      {locationNote?.kind === 'text' ? (
        <p className="pp-subtle" style={{ marginTop: 12, marginBottom: 0, fontSize: 14 }}>
          {locationNote.message}
        </p>
      ) : null}

      {petpalPartners.length ? (
        <section className="pp-sponsoredRail pp-nearbyPartners" aria-label="PetPal recommended businesses">
          <div className="pp-sponsoredRail__head">
            <span>Recommended on PetPal</span>
            <small>Boosted vet, groom, and hotel partners — book services from Bookings</small>
          </div>
          <div className="pp-sponsoredRail__row pp-nearbyPartners__row">
            {petpalPartners.map(({ p, km }) => (
              <Link
                key={String(p.id)}
                to={`/bookings/provider/${encodeURIComponent(String(p.id))}`}
                className="pp-nearbyPartnerCard"
              >
                <span className="pp-nearbyPartnerCard__badge">Partner</span>
                <strong className="pp-nearbyPartnerCard__name">{String(p.displayName || 'Business')}</strong>
                {p.address ? <span className="pp-nearbyPartnerCard__addr">{String(p.address)}</span> : null}
                <span className="pp-nearbyPartnerCard__cta">
                  {km != null ? `${km.toFixed(1)} km · ` : null}
                  View and book →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <h2 className="pp-sectionTitle" style={{ marginTop: 22 }}>
        {t('nearbyPage.whatLooking')}
      </h2>
      <div className="pp-nearby-grid" role="group" aria-label={t('nearbyPage.ariaCategories')}>
        {NEARBY_CATEGORIES.map((c) => {
          const active = c.id === selectedCategoryId;
          const loc = getCategoryById(c.id, t);
          return (
            <button
              key={c.id}
              type="button"
              className={`pp-nearby-tile ${active ? 'pp-nearby-tile--active' : ''}`}
              onClick={() => setSelectedCategoryId(c.id)}
              aria-pressed={active}
            >
              <span className="pp-nearby-tile__icon" aria-hidden>
                {c.icon}
              </span>
              <span className="pp-nearby-tile__label">{loc.label}</span>
              <span className="pp-nearby-tile__desc">{loc.description}</span>
            </button>
          );
        })}
      </div>
      <p className="pp-nearby-hint" style={{ marginTop: 10 }}>
        {t('nearbyPage.selected')} <strong>{selectedCategory.label}</strong>
        {searchScope === 'bounds' ? (
          <span>{t('nearbyPage.searchingVisibleMap')}</span>
        ) : (
          <span>{t('nearbyPage.nearYouKm', { km: radiusKm })}</span>
        )}
      </p>

      <div className="pp-nearby-body pp-nearby-body--separated">
        <section className="pp-nearby-mapStage pp-card" aria-label="Nearby map">
          <div className="pp-nearby-mapWrap">
            <div className="pp-nearby-mapActions">
            <button
              type="button"
              className="pp-nearby-cta pp-nearby-cta--location"
              onClick={onUseMyLocation}
              disabled={locFetching}
            >
              {locFetching ? t('nearbyPage.locFetching') : t('nearbyPage.useMyLocation')}
            </button>
            <button type="button" className="pp-nearby-cta pp-nearby-cta--primary" onClick={onSearchThisArea}>
              {t('nearbyPage.searchThisArea')}
            </button>
            <button
              type="button"
              className="pp-nearby-cta"
              onClick={onSearchNearMe}
              title={t('nearbyPage.searchNearHint')}
            >
              {t('nearbyPage.searchNearMe')}
            </button>
            </div>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={14}
              onLoad={setMap}
              options={mapOptions}
              onClick={() => setActivePlace(null)}
            >
              {places.map((p) =>
                p.geometry?.location ? (
                  <Marker
                    key={p.place_id}
                    position={p.geometry.location}
                    title={p.name}
                    animation={activePlace?.place_id === p.place_id ? window.google.maps.Animation.BOUNCE : window.google.maps.Animation.DROP}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: activePlace?.place_id === p.place_id ? 9 : 7,
                      fillColor: activePlace?.place_id === p.place_id ? '#5b37ff' : '#ffffff',
                      fillOpacity: 1,
                      strokeColor: '#5b37ff',
                      strokeWeight: 3,
                    }}
                    onClick={() => setActivePlace(p)}
                  />
                ) : null
              )}
              {userLocation ? (
                <Marker
                  position={userLocation}
                  title="Your location"
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#2563eb',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3,
                  }}
                />
              ) : null}
              {activePlace?.geometry?.location ? (
                <InfoWindow
                  position={activePlace.geometry.location}
                  onCloseClick={() => setActivePlace(null)}
                >
                  <div className="pp-nearby-info">
                    <button type="button" className="pp-nearby-info__close" onClick={() => setActivePlace(null)} aria-label="Close place preview">
                      ×
                    </button>
                    <div className="pp-nearby-info__image">
                      {placePhotoUrl(activePlace, 260, 160) ? <img src={placePhotoUrl(activePlace, 260, 160)} alt="" /> : <span aria-hidden>{selectedCategory.icon}</span>}
                    </div>
                    <strong>{activePlace.name}</strong>
                    <div className="pp-nearby-info__chips">
                      <span>{selectedCategory.label}</span>
                      {activePlace.rating != null ? <span>★ {Number(activePlace.rating).toFixed(1)}</span> : null}
                      {distanceKm(userLocation || searchCenter, activePlace) != null ? (
                        <span>{distanceKm(userLocation || searchCenter, activePlace).toFixed(1)} km</span>
                      ) : null}
                    </div>
                    {activePlace.vicinity ? <div className="pp-nearby-info__addr">{activePlace.vicinity}</div> : null}
                    <a
                      className="pp-nearby-info__maps"
                      href={mapsUrl(activePlace)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('nearbyPage.infoOpenMaps')}
                    </a>
                  </div>
                </InfoWindow>
              ) : null}
            </GoogleMap>
          </div>
        </section>

        <aside className="pp-nearby-sheet pp-card" aria-label={t('nearbyPage.resultsHeading')}>
          <div className="pp-nearby-sheet__handle" aria-hidden />
          <h3 className="pp-nearby-listTitle">{t('nearbyPage.resultsHeading')}</h3>
          {searchStatus === 'loading' ? <p className="pp-subtle">{t('nearbyPage.searching')}</p> : null}
          {searchStatus === 'empty' ? (
            <p className="pp-subtle">{t('nearbyPage.noResultsCat')}</p>
          ) : null}
          {searchStatus === 'invalid_area' ? (
            <p className="pp-error" style={{ marginBottom: 8 }}>
              {t('nearbyPage.areaTooLarge')}
            </p>
          ) : null}
          {searchStatus === 'error' ? (
            <p className="pp-error">{t('nearbyPage.searchFailedPlaces')}</p>
          ) : null}
          {searchStatus === 'ok' && !places.length ? (
            <p className="pp-subtle">{t('nearbyPage.noMarkers')}</p>
          ) : null}
          <ol className="pp-nearby-list">
            {places.map((p) => {
              const photo = placePhotoUrl(p);
              const km = distanceKm(userLocation || searchCenter, p);
              const active = activePlace?.place_id === p.place_id;
              return (
              <li key={p.place_id} className={active ? 'is-active' : ''}>
                <button
                  type="button"
                  className={`pp-nearby-listItem ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    setActivePlace(p);
                    if (map && p.geometry?.location) {
                      map.panTo(p.geometry.location);
                      map.setZoom(16);
                    }
                  }}
                >
                  <span className="pp-nearby-listItem__thumb">
                    {photo ? <img src={photo} alt="" /> : <span aria-hidden>{selectedCategory.icon}</span>}
                  </span>
                  <span className="pp-nearby-listItem__body">
                    <span className="pp-nearby-listItem__name">{p.name}</span>
                    <span className="pp-nearby-listItem__meta">
                      <span className="pp-nearby-listItem__chip">{selectedCategory.label}</span>
                      {p.rating != null ? <span className="pp-nearby-listItem__chip">★ {Number(p.rating).toFixed(1)}</span> : null}
                      {km != null ? <span className="pp-nearby-listItem__chip">{km.toFixed(1)} km</span> : null}
                    </span>
                    {p.vicinity ? <span className="pp-nearby-listItem__vicinity">{p.vicinity}</span> : null}
                  </span>
                </button>
                <div className="pp-nearby-listItem__actions">
                  <button
                    type="button"
                    className="pp-nearby-listItem__preview"
                    onClick={() => {
                      setActivePlace(p);
                      if (map && p.geometry?.location) {
                        map.panTo(p.geometry.location);
                        map.setZoom(16);
                      }
                    }}
                  >
                    Preview
                  </button>
                  <a className="pp-nearby-listItem__maps" href={mapsUrl(p)} target="_blank" rel="noopener noreferrer">
                    Open in Maps ↗
                  </a>
                </div>
              </li>
              );
            })}
          </ol>
        </aside>
      </div>
      <section className="pp-card pp-nearbyInfoCard">
        <button type="button" className="pp-nearbyInfoCard__toggle" onClick={() => setInfoOpen((v) => !v)} aria-expanded={infoOpen}>
          <span>How nearby search works</span>
          <strong>{infoOpen ? 'Close' : 'Learn more'}</strong>
        </button>
        {infoOpen ? (
          <div className="pp-nearbyInfoCard__body">
            <p>
              {t('nearbyPage.introLead')} <strong>{t('nearbyPage.introSearchArea')}</strong>{' '}
              {t('nearbyPage.introMid')} <strong>{t('nearbyPage.introSearchNear')}</strong>{' '}
              {t('nearbyPage.introTrail', { radiusKm })}
            </p>
            <p>{t('nearbyPage.locDefaultHint')}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function Nearby() {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return <NoKeyView />;
  }
  return <NearbyMap apiKey={apiKey} />;
}
