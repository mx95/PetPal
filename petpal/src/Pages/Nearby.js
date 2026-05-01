import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import {
  getCategoryById,
  NEARBY_CATEGORIES,
  NEARBY_SEARCH_RADIUS_M,
} from '../config/nearbyPlaceCategories';
import { GOOGLE_MAPS_LOADER_ID } from '../config/googleMapsLoaderId';
import { useI18n } from '../i18n/I18nContext';

const mapContainerStyle = { width: '100%', height: 420, borderRadius: 16 };
const DEFAULT_CENTER = { lat: 35.173, lng: 33.364 };
const mapOptions = { disableDefaultUI: false, streetViewControl: false, mapTypeControl: false };

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
  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
    libraries: ['places'],
  });

  const [map, setMap] = useState(null);
  const [searchCenter, setSearchCenter] = useState(DEFAULT_CENTER);
  const [locationNote, setLocationNote] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(NEARBY_CATEGORIES[0].id);
  const [searchScope, setSearchScope] = useState('radius');
  const [places, setPlaces] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [activePlace, setActivePlace] = useState(null);

  const selectedCategory = useMemo(() => getCategoryById(selectedCategoryId, t), [selectedCategoryId, t]);
  const mapCenter = useMemo(
    () => ({ lat: searchCenter.lat, lng: searchCenter.lng }),
    [searchCenter.lat, searchCenter.lng]
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationNote(t('nearbyPage.locUnavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationNote(null);
      },
      () => {
        setLocationNote(t('nearbyPage.locDenied'));
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    );
  }, [t]);

  const runPlacesSearch = useCallback(
    (mode) => {
      if (!map || !isLoaded || !window.google?.maps?.places) return;
      const scope = mode || searchScope;
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
        const loc = new window.google.maps.LatLng(searchCenter.lat, searchCenter.lng);
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

  if (loadError) {
    return <LoadErrorView err={loadError} />;
  }
  if (!isLoaded) {
    return <p className="pp-subtle">{t('nearbyPage.loadingMap')}</p>;
  }

  return (
    <div className="pp-nearby-page">
      <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="pp-badge">{t('nearbyPage.badge')}</div>
          <h1 className="pp-h1" style={{ marginTop: 10 }}>
            {t('nearbyPage.title')}
          </h1>
          <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 640 }}>
            {t('nearbyPage.introLead')} <strong>{t('nearbyPage.introSearchArea')}</strong>{' '}
            {t('nearbyPage.introMid')} <strong>{t('nearbyPage.introSearchNear')}</strong>{' '}
            {t('nearbyPage.introTrail', { radiusKm })}
          </p>
        </div>
        <Link className="pp-link" to="/dashboard">
          {t('common.backDashboard')}
        </Link>
      </div>

      {locationNote ? (
        <p className="pp-subtle" style={{ marginTop: 12, marginBottom: 0, fontSize: 14 }}>
          {locationNote}
        </p>
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

      <div className="pp-nearby-body">
        <div className="pp-nearby-mapWrap">
          <div className="pp-nearby-mapActions">
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
                  onClick={() => setActivePlace(p)}
                />
              ) : null
            )}
            {activePlace?.geometry?.location ? (
              <InfoWindow
                position={activePlace.geometry.location}
                onCloseClick={() => setActivePlace(null)}
              >
                <div className="pp-nearby-info">
                  <strong>{activePlace.name}</strong>
                  {activePlace.vicinity ? <div>{activePlace.vicinity}</div> : null}
                  {activePlace.rating != null ? (
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      {t('leaderboardPage.starRatingLine', {
                        rating: activePlace.rating.toFixed(1),
                        reviews: activePlace.user_ratings_total || 0,
                      })}
                    </div>
                  ) : null}
                  <a
                    className="pp-link"
                    style={{ display: 'inline-block', marginTop: 8, padding: 0 }}
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      activePlace.name || ''
                    )}&query_place_id=${encodeURIComponent(activePlace.place_id || '')}`}
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

        <div className="pp-nearby-listPanel">
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
            {places.map((p) => (
              <li key={p.place_id}>
                <button
                  type="button"
                  className="pp-nearby-listItem"
                  onClick={() => {
                    setActivePlace(p);
                    if (map && p.geometry?.location) {
                      map.panTo(p.geometry.location);
                      map.setZoom(16);
                    }
                  }}
                >
                  <span className="pp-nearby-listItem__name">{p.name}</span>
                  {p.vicinity ? <span className="pp-nearby-listItem__vicinity">{p.vicinity}</span> : null}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
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
