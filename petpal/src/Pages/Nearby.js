import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import {
  getCategoryById,
  NEARBY_CATEGORIES,
  NEARBY_SEARCH_RADIUS_M,
} from '../config/nearbyPlaceCategories';

const mapContainerStyle = { width: '100%', height: 420, borderRadius: 16 };
const DEFAULT_CENTER = { lat: 51.5074, lng: -0.1278 };
const mapOptions = { disableDefaultUI: false, streetViewControl: false, mapTypeControl: false };

function noKeyView() {
  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-badge">Nearby</div>
        <h1 className="pp-h1" style={{ marginTop: 10 }}>
          Map &amp; places
        </h1>
        <p className="pp-subtle" style={{ maxWidth: 560 }}>
          Add a <strong>Google Maps</strong> browser key to <code>petpal/.env.local</code> as{' '}
          <code style={{ fontSize: 13 }}>REACT_APP_GOOGLE_MAPS_API_KEY=…</code> and enable{' '}
          <strong>Maps JavaScript API</strong> and <strong>Places API</strong> for your project, then
          restart <code style={{ fontSize: 13 }}>yarn start</code>.
        </p>
      </div>
    </div>
  );
}

function loadErrorView(err) {
  return (
    <div className="pp-card pp-pad" style={{ borderColor: 'rgba(180, 35, 24, 0.35)' }}>
      <p className="pp-error" style={{ margin: 0 }}>
        Google Maps could not load: {err?.message || String(err)}
      </p>
      <p className="pp-subtle" style={{ marginTop: 10, marginBottom: 0 }}>
        Check the API key, billing, and that Maps JavaScript API + Places API are enabled.
      </p>
    </div>
  );
}

function NearbyMap({ apiKey }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'petpal-maps',
    googleMapsApiKey: apiKey,
    libraries: ['places'],
  });

  const [map, setMap] = useState(null);
  /** Center for “Search near me” and initial map; not when picking a list row. */
  const [searchCenter, setSearchCenter] = useState(DEFAULT_CENTER);
  const [locationNote, setLocationNote] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(NEARBY_CATEGORIES[0].id);
  /** 'radius' = around you; 'bounds' = current map window (pan/zoom out, then search). */
  const [searchScope, setSearchScope] = useState('radius');
  const [places, setPlaces] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [activePlace, setActivePlace] = useState(null);

  const selectedCategory = useMemo(() => getCategoryById(selectedCategoryId), [selectedCategoryId]);
  const mapCenter = useMemo(
    () => ({ lat: searchCenter.lat, lng: searchCenter.lng }),
    [searchCenter.lat, searchCenter.lng]
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationNote('Location unavailable — showing a default area. You can still browse categories.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSearchCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationNote(null);
      },
      () => {
        setLocationNote(
          'Location permission denied — using a default map center. Enable location for results near you.'
        );
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 }
    );
  }, []);

  const runPlacesSearch = useCallback(
    (mode) => {
      if (!map || !isLoaded || !window.google?.maps?.places) return;
      const scope = mode || searchScope;
      setActivePlace(null);
      setSearchStatus('loading');
      setPlaces([]);

      const service = new window.google.maps.places.PlacesService(map);
      const cat = getCategoryById(selectedCategoryId);

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
    // Re-run when category/location refines “near me”; not when only searchScope changes (buttons call runPlacesSearch directly).
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

  if (loadError) {
    return loadErrorView(loadError);
  }
  if (!isLoaded) {
    return <p className="pp-subtle">Loading map…</p>;
  }

  return (
    <div className="pp-nearby-page">
      <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="pp-badge">Nearby</div>
          <h1 className="pp-h1" style={{ marginTop: 10 }}>
            Pet-friendly places
          </h1>
          <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 640 }}>
            Choose a category, then use <strong>Search this area</strong> after you pan or zoom the map
            to load results for the whole view — or <strong>Search near me</strong> for a {NEARBY_SEARCH_RADIUS_M / 1000}{' '}
            km search around you.
          </p>
        </div>
        <Link className="pp-link" to="/dashboard">
          ← Dashboard
        </Link>
      </div>

      {locationNote ? (
        <p className="pp-subtle" style={{ marginTop: 12, marginBottom: 0, fontSize: 14 }}>
          {locationNote}
        </p>
      ) : null}

      <h2 className="pp-sectionTitle" style={{ marginTop: 22 }}>
        What are you looking for?
      </h2>
      <div className="pp-nearby-grid" role="group" aria-label="Place type">
        {NEARBY_CATEGORIES.map((c) => {
          const active = c.id === selectedCategoryId;
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
              <span className="pp-nearby-tile__label">{c.label}</span>
              <span className="pp-nearby-tile__desc">{c.description}</span>
            </button>
          );
        })}
      </div>
      <p className="pp-nearby-hint" style={{ marginTop: 10 }}>
        Selected: <strong>{selectedCategory.label}</strong>
        {searchScope === 'bounds' ? (
          <span> · Searching the visible map</span>
        ) : (
          <span> · Near you ({NEARBY_SEARCH_RADIUS_M / 1000} km)</span>
        )}
      </p>

      <div className="pp-nearby-body">
        <div className="pp-nearby-mapWrap">
          <div className="pp-nearby-mapActions">
            <button type="button" className="pp-nearby-cta pp-nearby-cta--primary" onClick={onSearchThisArea}>
              Search this area
            </button>
            <button
              type="button"
              className="pp-nearby-cta"
              onClick={onSearchNearMe}
              title="5 km around your location"
            >
              Search near me
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
                      ★ {activePlace.rating.toFixed(1)} ({activePlace.user_ratings_total || 0} reviews)
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
                    Open in Google Maps ↗
                  </a>
                </div>
              </InfoWindow>
            ) : null}
          </GoogleMap>
        </div>

        <div className="pp-nearby-listPanel">
          <h3 className="pp-nearby-listTitle">Results</h3>
          {searchStatus === 'loading' ? <p className="pp-subtle">Searching…</p> : null}
          {searchStatus === 'empty' ? <p className="pp-subtle">No results for this category here.</p> : null}
          {searchStatus === 'invalid_area' ? (
            <p className="pp-error" style={{ marginBottom: 8 }}>
              Area too large for this search. Zoom in, then use &quot;Search this area&quot; again.
            </p>
          ) : null}
          {searchStatus === 'error' ? (
            <p className="pp-error">Search failed. Check Places API and quotas.</p>
          ) : null}
          {searchStatus === 'ok' && !places.length ? <p className="pp-subtle">No markers to show.</p> : null}
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
    return noKeyView();
  }
  return <NearbyMap apiKey={apiKey} />;
}
