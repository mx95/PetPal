import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import {
  getCategoryById,
  NEARBY_CATEGORIES,
  NEARBY_DEFAULT_CATEGORY_ID,
  NEARBY_SEARCH_RADIUS_M,
} from '../config/nearbyPlaceCategories';
import { nearbyCategoryForPlace } from '../nearby/classifyNearbyPlace';
import { filterAcceptableNearbyPlaces } from '../nearby/nearbyPlaceQuality';
import {
  getNearbyPlacesCache,
  nearbyPlacesCacheKey,
  setNearbyPlacesCache,
} from '../nearby/nearbyPlacesCache';
import { fetchCachedNearbyPlaces } from '../nearby/nearbyPlacesServerCache';
import { fetchLiveNearbyPlaces } from '../nearby/nearbyPlacesLiveSearch';
import { distanceKm } from '../nearby/placeMapUtils';
import NearbyCategoryPin from '../nearby/NearbyCategoryPin';
import { GOOGLE_MAPS_LOADER_ID } from '../config/googleMapsLoaderId';
import { subscribeGoogleMapsAuthFailure } from '../config/googleMapsAuthFailure';
import { useI18n } from '../i18n/I18nContext';
import { subscribeProviders } from '../bookings/providerDirectoryFirestore';
import { providerNearbyBoostIsActive, providerDistanceKm } from '../bookings/bookingBrowseUtils';
import { isBookingBrowseEnabled } from '../bookings/bookingFeature';
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
  const moreSearchGenRef = useRef(0);
  const [locationNote, setLocationNote] = useState(() => ({ kind: 'default' }));
  const [selectedCategoryId, setSelectedCategoryId] = useState(NEARBY_DEFAULT_CATEGORY_ID);
  const [searchScope, setSearchScope] = useState('radius');
  const [geoSettled, setGeoSettled] = useState(false);
  const [places, setPlaces] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [activePlace, setActivePlace] = useState(null);
  const [locFetching, setLocFetching] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [allProviders, setAllProviders] = useState(/** @type {Record<string, unknown>[]} */ ([]));
  const autoLocRequested = useRef(false);

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
      .filter((p) => providerNearbyBoostIsActive(p))
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
  const userLocationIcon = useMemo(
    () =>
      typeof window !== 'undefined' && window.google?.maps?.SymbolPath
        ? {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          }
        : undefined,
    // Recreate once Maps JS is loaded (isLoaded flips true).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoaded]
  );

  const searchCenterRef = useRef(searchCenter);
  const userLocationRef = useRef(userLocation);
  const searchScopeRef = useRef(searchScope);
  const lastPanRef = useRef({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng });
  searchCenterRef.current = searchCenter;
  userLocationRef.current = userLocation;
  searchScopeRef.current = searchScope;

  const runPlacesSearch = useCallback(
    async (mode, centerOverride, { skipCache = false } = {}) => {
      if (!map) return;
      if (!isFirebaseConfigured()) {
        setSearchStatus('cache_unavailable');
        return;
      }

      const scope = mode || searchScopeRef.current;
      const center = centerOverride || searchCenterRef.current;
      const searchGen = ++moreSearchGenRef.current;
      setSearchStatus('loading');

      const cat = NEARBY_CATEGORIES.find((c) => c.id === selectedCategoryId) || NEARBY_CATEGORIES[0];
      const boundsForCache = scope === 'bounds' ? map.getBounds() : null;
      if (scope === 'bounds' && !boundsForCache) {
        setSearchStatus('error');
        return;
      }

      const cacheKey = nearbyPlacesCacheKey({
        categoryId: cat.id,
        scope,
        center,
        bounds: boundsForCache,
      });

      const maxResults = cat.id === 'more' ? 60 : cat.id === 'pet_cafe' ? 40 : 20;

      const publishPlaces = (merged, { fromSessionCache = false } = {}) => {
        if (moreSearchGenRef.current !== searchGen) return;
        const sortCenter = userLocationRef.current || center;
        const filtered = filterAcceptableNearbyPlaces(merged, {
          selectedCategoryId: cat.id,
        });
        const ranked = [...filtered].sort((a, b) => {
          const da = distanceKm(sortCenter, a);
          const db = distanceKm(sortCenter, b);
          if (da == null && db == null) return 0;
          if (da == null) return 1;
          if (db == null) return -1;
          return da - db;
        });
        const nextPlaces = ranked.length ? ranked.slice(0, maxResults) : [];

        setPlaces((prev) => {
          if (moreSearchGenRef.current !== searchGen) return prev;
          if (!nextPlaces.length) return [];
          const prevById = new Map(prev.map((p) => [p.place_id, p]));
          return nextPlaces.map((p) => prevById.get(p.place_id) || p);
        });
        setSearchStatus(nextPlaces.length ? 'ok' : 'empty');
        if (!fromSessionCache && nextPlaces.length) {
          setNearbyPlacesCache(cacheKey, nextPlaces);
        }
      };

      if (!skipCache) {
        const sessionCached = getNearbyPlacesCache(cacheKey);
        if (sessionCached?.length) {
          publishPlaces(sessionCached, { fromSessionCache: true });
          return;
        }
      }

      try {
        let merged = await fetchCachedNearbyPlaces({
          categoryId: cat.id,
          center,
          scope,
          mapBounds: boundsForCache,
        });
        if (moreSearchGenRef.current !== searchGen) return;

        // Server cache not populated yet (or no places in this radius) — fall back
        // to live Google Places so the map is not empty for users.
        if (!merged?.length && window.google?.maps?.places) {
          try {
            merged = await fetchLiveNearbyPlaces({
              map,
              categoryId: cat.id,
              center,
              scope,
              mapBounds: boundsForCache,
            });
          } catch {
            // Keep empty merged; publishPlaces will show empty status.
          }
        }
        if (moreSearchGenRef.current !== searchGen) return;
        publishPlaces(merged || []);
      } catch {
        if (moreSearchGenRef.current !== searchGen) return;
        // Firestore unavailable — try live Places before failing.
        if (window.google?.maps?.places) {
          try {
            const live = await fetchLiveNearbyPlaces({
              map,
              categoryId: cat.id,
              center,
              scope,
              mapBounds: boundsForCache,
            });
            if (moreSearchGenRef.current !== searchGen) return;
            publishPlaces(live || []);
            return;
          } catch {
            /* fall through */
          }
        }
        if (moreSearchGenRef.current !== searchGen) return;
        setSearchStatus('error');
      }
    },
    [map, selectedCategoryId]
  );

  useEffect(() => {
    if (!isLoaded || !map || !geoSettled) return;
    runPlacesSearch();
  }, [isLoaded, map, geoSettled, selectedCategoryId, searchCenter.lat, searchCenter.lng, runPlacesSearch]);

  // Intentionally uncontrolled map: do not bind `center`/`zoom` props (they fight
  // user pans and remount overlays). Pan only when searchCenter changes on purpose.
  useEffect(() => {
    if (!map || !window.google?.maps) return;
    const prev = lastPanRef.current;
    if (
      Math.abs(prev.lat - mapCenter.lat) < 1e-7 &&
      Math.abs(prev.lng - mapCenter.lng) < 1e-7
    ) {
      return;
    }
    lastPanRef.current = { lat: mapCenter.lat, lng: mapCenter.lng };
    map.panTo(new window.google.maps.LatLng(mapCenter.lat, mapCenter.lng));
  }, [map, mapCenter.lat, mapCenter.lng]);

  const settleGeo = useCallback(() => {
    setGeoSettled(true);
  }, []);

  const requestUserLocation = useCallback(
    ({ silent = false } = {}) => {
      if (!navigator.geolocation) {
        if (!silent) setLocationNote({ kind: 'text', message: t('nearbyPage.locUnavailable') });
        settleGeo();
        return;
      }
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        if (!silent) {
          setLocationNote({
            kind: 'text',
            message: t('nearbyPage.locHttpsRequired'),
          });
        }
        settleGeo();
        return;
      }
      setLocFetching(true);
      if (!silent) setSearchStatus('loading');
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
            lastPanRef.current = { lat: next.lat, lng: next.lng };
          }
          setSearchScope('radius');
          settleGeo();
        },
        (err) => {
          setLocFetching(false);
          settleGeo();
          if (!silent) {
            setSearchStatus('idle');
            const reason =
              err?.code === 1
                ? t('nearbyPage.locPermissionDenied')
                : err?.code === 2
                  ? t('nearbyPage.locUnavailableNow')
                  : err?.code === 3
                    ? t('nearbyPage.locTimedOut')
                    : t('nearbyPage.locDenied');
            setLocationNote({ kind: 'text', message: reason });
          } else {
            setLocationNote((prev) =>
              prev.kind === 'default' ? { kind: 'text', message: t('nearbyPage.locDefaultHint') } : prev
            );
          }
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 }
      );
    },
    [map, settleGeo, t]
  );

  useEffect(() => {
    if (!isLoaded || !map || autoLocRequested.current) return;
    autoLocRequested.current = true;
    requestUserLocation({ silent: true });
  }, [isLoaded, map, requestUserLocation]);

  function onUseMyLocation() {
    setLocationNote({ kind: 'none' });
    requestUserLocation({ silent: false });
  }

  function onSearchThisArea() {
    setSearchScope('bounds');
    runPlacesSearch('bounds', undefined, { skipCache: true });
  }

  const onPinClick = useCallback((place) => {
    setActivePlace(place);
  }, []);

  const pinRows = useMemo(
    () =>
      places
        .filter((p) => p?.geometry?.location)
        .map((p) => ({
          place: p,
          category: nearbyCategoryForPlace(p, selectedCategoryId, t),
        })),
    [places, selectedCategoryId, t]
  );

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
      {isBookingBrowseEnabled() && petpalPartners.length ? (
        <section
          className={`pp-nearbyPartners${petpalPartners.length > 1 ? ' pp-nearbyPartners--carousel' : ''}`}
          aria-label={t('nearbyPage.recommendedBusinessesAria')}
        >
          <div className="pp-nearbyPartners__row" role="list">
            {petpalPartners.map(({ p, km }) => (
              <Link
                key={String(p.id)}
                to={`/bookings/provider/${encodeURIComponent(String(p.id))}`}
                className="pp-nearbyPartnerCard"
                role="listitem"
              >
                <div className="pp-nearbyPartnerCard__tags">
                  <span className="pp-nearbyPartnerCard__badge pp-nearbyPartnerCard__badge--recommended">
                    {t('nearbyPage.recommendedBadge')}
                  </span>
                  <span className="pp-nearbyPartnerCard__badge pp-nearbyPartnerCard__badge--partner">
                    {t('nearbyPage.partnerBadge')}
                  </span>
                </div>
                <strong className="pp-nearbyPartnerCard__name">
                  {String(p.displayName || t('nearbyPage.businessFallback'))}
                </strong>
                {p.address ? <span className="pp-nearbyPartnerCard__addr">{String(p.address)}</span> : null}
                <span className="pp-nearbyPartnerCard__cta">
                  {km != null
                    ? t('nearbyPage.partnerDistanceCta', { km: km.toFixed(1) })
                    : t('nearbyPage.partnerViewAndBook')}
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
      {selectedCategoryId === 'more' ? (
        <p className="pp-subtle" style={{ marginTop: 6, marginBottom: 0 }}>
          {t('nearbyPage.allServicesHint')}
        </p>
      ) : null}

      <div className="pp-nearby-body pp-nearby-body--separated">
        <section className="pp-nearby-mapStage pp-card" aria-label={t('nearbyPage.nearbyMapAria')}>
          <div className="pp-nearby-mapWrap">
            <div className="pp-nearby-mapFloatingBar">
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
              </div>
              {locationNote?.kind === 'text' ? (
                <p className="pp-nearby-mapLocNote" role="status">
                  {locationNote.message}
                </p>
              ) : null}
            </div>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              defaultCenter={DEFAULT_CENTER}
              defaultZoom={14}
              onLoad={setMap}
              options={mapOptions}
              onClick={() => setActivePlace(null)}
            >
              {pinRows.map(({ place: p, category: pinCategory }) => (
                <NearbyCategoryPin
                  key={p.place_id}
                  place={p}
                  category={pinCategory}
                  active={activePlace?.place_id === p.place_id}
                  onClick={() => onPinClick(p)}
                />
              ))}
              {userLocation ? (
                <Marker
                  position={userLocation}
                  title={t('nearbyPage.yourLocation')}
                  icon={userLocationIcon}
                />
              ) : null}
              {activePlace?.geometry?.location ? (
                <InfoWindow
                  position={activePlace.geometry.location}
                  onCloseClick={() => setActivePlace(null)}
                >
                  <div className="pp-nearby-info">
                    <button type="button" className="pp-nearby-info__close" onClick={() => setActivePlace(null)} aria-label={t('nearbyPage.closePlacePreview')}>
                      ×
                    </button>
                    <div className="pp-nearby-info__image">
                      {placePhotoUrl(activePlace, 260, 160) ? (
                        <img src={placePhotoUrl(activePlace, 260, 160)} alt="" />
                      ) : (
                        <span aria-hidden>
                          {nearbyCategoryForPlace(activePlace, selectedCategoryId, t).icon}
                        </span>
                      )}
                    </div>
                    <strong>{activePlace.name}</strong>
                    <div className="pp-nearby-info__chips">
                      <span>{nearbyCategoryForPlace(activePlace, selectedCategoryId, t).label}</span>
                      {activePlace.rating != null ? <span>★ {Number(activePlace.rating).toFixed(1)}</span> : null}
                      {distanceKm(userLocation || searchCenter, activePlace) != null ? (
                        <span>{t('nearbyPage.distanceKm', { km: distanceKm(userLocation || searchCenter, activePlace).toFixed(1) })}</span>
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
            <p className="pp-error">{t('nearbyPage.searchFailedCache')}</p>
          ) : null}
          {searchStatus === 'cache_unavailable' ? (
            <p className="pp-error">{t('nearbyPage.cacheUnavailable')}</p>
          ) : null}
          {searchStatus === 'ok' && !places.length ? (
            <p className="pp-subtle">{t('nearbyPage.noMarkers')}</p>
          ) : null}
          <ol className="pp-nearby-list">
            {places.map((p) => {
              const photo = placePhotoUrl(p);
              const km = distanceKm(userLocation || searchCenter, p);
              const active = activePlace?.place_id === p.place_id;
              const placeCategory = nearbyCategoryForPlace(p, selectedCategoryId, t);
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
                    {photo ? <img src={photo} alt="" /> : <span aria-hidden>{placeCategory.icon}</span>}
                  </span>
                  <span className="pp-nearby-listItem__body">
                    <span className="pp-nearby-listItem__name">{p.name}</span>
                    <span className="pp-nearby-listItem__meta">
                      <span className="pp-nearby-listItem__chip">{placeCategory.label}</span>
                      {p.rating != null ? <span className="pp-nearby-listItem__chip">★ {Number(p.rating).toFixed(1)}</span> : null}
                      {km != null ? <span className="pp-nearby-listItem__chip">{t('nearbyPage.distanceKm', { km: km.toFixed(1) })}</span> : null}
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
                    {t('nearbyPage.preview')}
                  </button>
                  <a className="pp-nearby-listItem__maps" href={mapsUrl(p)} target="_blank" rel="noopener noreferrer">
                    {t('nearbyPage.openInMaps')}
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
          <span>{t('nearbyPage.infoTitle')}</span>
          <strong>{infoOpen ? t('nearbyPage.infoClose') : t('nearbyPage.infoLearnMore')}</strong>
        </button>
        {infoOpen ? (
          <div className="pp-nearbyInfoCard__body">
            <p>
              {t('nearbyPage.introLead')} <strong>{t('nearbyPage.introSearchArea')}</strong>{' '}
              {t('nearbyPage.introMid')} <strong>{t('nearbyPage.introSearchNear')}</strong>{' '}
              {t('nearbyPage.introTrail', { radiusKm })}
            </p>
            <p>{t('nearbyPage.locDefaultHint')}</p>
            <p>{t('nearbyPage.serverCacheHint')}</p>
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
