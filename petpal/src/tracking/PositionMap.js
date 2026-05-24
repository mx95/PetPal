import L from 'leaflet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Circle as GoogleCircle, GoogleMap, Marker, useGoogleMap, useJsApiLoader } from '@react-google-maps/api';
import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

import { GOOGLE_MAPS_LOADER_ID } from '../config/googleMapsLoaderId';
import { subscribeGoogleMapsAuthFailure } from '../config/googleMapsAuthFailure';
import { accuracyRadiusMeters, useAnimatedLatLng } from './mapLiveUtils';
import {
  LIVE_MAP_ZOOM,
  buildCircularGooglePetIconUrl,
  buildGooglePetMarkerIcon,
  buildLeafletPetMarkerIcon,
} from './mapPetMarker';

import 'leaflet/dist/leaflet.css';

import { trackingUsesGoogleMaps } from './trackingMapProvider';

const defaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: icon2x,
  shadowUrl: shadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

const ROUTE_DOT = '#ef4444';
const ROUTE_DOT_ACTIVE = '#22c55e';
const ROUTE_LINE = '#ef4444';
const LIVE_ACCENT = '#5b37ff';
const LIVE_TRAIL = 'rgba(91, 55, 255, 0.45)';

const googleMapContainerStyle = {
  width: '100%',
  height: '100%',
  minHeight: 'min(52vh, 440px)',
};

const LIVE_MAP_FILL_MIN_HEIGHT = 'min(52vh, 480px)';

const googleMapContainerStyleFill = {
  width: '100%',
  height: '100%',
  minHeight: LIVE_MAP_FILL_MIN_HEIGHT,
};

const googleMapOptions = {
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  clickableIcons: false,
};

const livePetIcon = L.divIcon({
  className: 'pp-live-marker-leaflet',
  html: '<span class="pp-live-marker__dot" aria-hidden="true"></span><span class="pp-live-marker__pulse" aria-hidden="true"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function markerFill(active) {
  return active ? ROUTE_DOT_ACTIVE : ROUTE_DOT;
}

function leafletDotRadius(kind, active, emphasizeVertices = false) {
  if (emphasizeVertices) {
    if (active) return 11;
    if (kind === 'start' || kind === 'end') return 8;
    return 7;
  }
  if (active) return kind === 'start' || kind === 'end' ? 8 : 7;
  if (kind === 'start' || kind === 'end') return 4;
  return 3;
}

function leafletDotStroke(active) {
  if (active) return { weight: 2.5, color: '#ffffff' };
  return { weight: 1.25, color: '#ffffff' };
}

/** Wait until the host has real pixels before mounting Leaflet/Google (fixes blank map after SPA nav). */
function MapSizeGate({ children, active = true, layoutTick = 0, className = '' }) {
  const hostRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !active) {
      setReady(false);
      return undefined;
    }

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const { width, height } = host.getBoundingClientRect();
      setReady(width >= 48 && height >= 48);
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(host);

    const timers = [0, 80, 200, 450, 900, 1400].map((ms) => window.setTimeout(measure, ms));

    return () => {
      cancelled = true;
      ro?.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [active, layoutTick]);

  return (
    <div
      ref={hostRef}
      className={`pp-mapSizeGate ${className}`.trim()}
      style={{ width: '100%', height: '100%', minHeight: LIVE_MAP_FILL_MIN_HEIGHT }}
    >
      {ready && active ? children : (
        <div className="pp-mapLoading" aria-hidden>
          <span className="pp-mapLoading__pulse" />
        </div>
      )}
    </div>
  );
}

function FlyTo({ lat, lng, smooth = true }) {
  const map = useMap();
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const zoom = map.getZoom() || 16;
    if (smooth) map.flyTo([lat, lng], zoom, { duration: 0.55 });
    else map.setView([lat, lng], zoom);
  }, [lat, lng, map, smooth]);
  return null;
}

function LeafletInvalidateSize({ active = true }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return undefined;
    const run = () => {
      try {
        map.invalidateSize({ animate: false, pan: false });
      } catch {
        /* map may be tearing down */
      }
    };
    run();
    const raf = requestAnimationFrame(run);
    const timers = [120, 400, 800, 1200].map((ms) => window.setTimeout(run, ms));
    window.addEventListener('resize', run);

    const container = map.getContainer?.();
    let ro;
    if (container && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => run());
      ro.observe(container);
      if (container.parentElement) ro.observe(container.parentElement);
    }

    let io;
    if (container && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) run();
      });
      io.observe(container);
    }

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', run);
      ro?.disconnect();
      io?.disconnect();
    };
  }, [map, active]);
  return null;
}

function GoogleMapResize() {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || !window.google?.maps?.event) return undefined;
    const run = () => {
      window.google.maps.event.trigger(map, 'resize');
      const c = map.getCenter();
      if (c) map.setCenter(c);
    };
    const raf = requestAnimationFrame(run);
    window.addEventListener('resize', run);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', run);
    };
  }, [map]);
  return null;
}

function FitRoute({ path, zoom = 16 }) {
  const map = useMap();
  useEffect(() => {
    if (!Array.isArray(path) || path.length === 0) return;
    if (path.length === 1) {
      const p = path[0];
      if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        map.setView([p.lat, p.lng], zoom, { animate: false });
      }
      return;
    }
    const bounds = L.latLngBounds(path.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: Math.max(zoom, 16) });
  }, [path, map, zoom]);
  return null;
}

function LeafletFollowPan({ lat, lng, follow, zoom = LIVE_MAP_ZOOM }) {
  const map = useMap();
  useEffect(() => {
    if (!follow || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const targetZoom = Math.max(map.getZoom(), zoom);
    map.setView([lat, lng], targetZoom, { animate: true, duration: 0.45 });
  }, [lat, lng, follow, map, zoom]);
  return null;
}

function LeafletUserPanDetector({ onUserPan }) {
  useMapEvents({
    dragstart() {
      onUserPan?.();
    },
    zoomstart() {
      onUserPan?.();
    },
  });
  return null;
}

function GoogleFollowPan({ lat, lng, follow, zoom = LIVE_MAP_ZOOM }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || !follow || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.panTo({ lat, lng });
    if (map.getZoom() < zoom) map.setZoom(zoom);
  }, [map, follow, lat, lng, zoom]);
  return null;
}

function GoogleFitRoute({ path, zoom = 16 }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || !window.google?.maps || !Array.isArray(path) || path.length === 0) return;
    if (path.length === 1) {
      const p = path[0];
      if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        map.setCenter({ lat: p.lat, lng: p.lng });
        map.setZoom(zoom);
      }
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 48);
  }, [map, path]);
  return null;
}

function GoogleNativePolyline({ path, options }) {
  const map = useGoogleMap();
  const routePath = useMemo(() => normalizeRoutePath(path), [path]);
  const optionsKey = useMemo(() => JSON.stringify(options || {}), [options]);

  useEffect(() => {
    if (!map || !window.google?.maps || routePath.length < 2) return undefined;
    let opts = {};
    try {
      opts = JSON.parse(optionsKey);
    } catch {
      opts = {};
    }
    const line = new window.google.maps.Polyline({ path: routePath, map, ...opts });
    return () => {
      line.setMap(null);
    };
  }, [map, routePath, optionsKey]);

  return null;
}

function GoogleRoutePolylines({ path, emphasize }) {
  const glowOptions = useMemo(
    () => ({
      geodesic: false,
      strokeColor: ROUTE_LINE,
      strokeOpacity: 0.18,
      strokeWeight: emphasize ? 10 : 8,
    }),
    [emphasize]
  );
  const lineOptions = useMemo(
    () => ({
      geodesic: false,
      strokeColor: ROUTE_LINE,
      strokeOpacity: 1,
      strokeWeight: emphasize ? 5 : 4,
    }),
    [emphasize]
  );
  return (
    <>
      <GoogleNativePolyline path={path} options={glowOptions} />
      <GoogleNativePolyline path={path} options={lineOptions} />
    </>
  );
}

function GoogleLiveTrail({ path }) {
  const options = useMemo(
    () => ({
      geodesic: true,
      strokeColor: LIVE_ACCENT,
      strokeOpacity: 0.42,
      strokeWeight: 4,
    }),
    []
  );
  return <GoogleNativePolyline path={path} options={options} />;
}

function GoogleUserPanDetector({ onUserPan }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || !window.google?.maps?.event) return undefined;
    const drag = map.addListener('dragstart', () => onUserPan?.());
    return () => {
      if (drag) window.google.maps.event.removeListener(drag);
    };
  }, [map, onUserPan]);
  return null;
}

function MapRecenterButton({ visible, label, onClick }) {
  if (!visible) return null;
  return (
    <button type="button" className="pp-mapRecenter" onClick={onClick} aria-label={label}>
      <span className="pp-mapRecenter__icon" aria-hidden>
        ◎
      </span>
      <span className="pp-mapRecenter__text">{label}</span>
    </button>
  );
}

function googleRouteDotIcon(maps, kind, active, emphasizeVertices = false) {
  const scale = emphasizeVertices
    ? active
      ? 10
      : kind === 'start' || kind === 'end'
        ? 7
        : 6
    : active
      ? kind === 'start' || kind === 'end'
        ? 7
        : 6.5
      : kind === 'start' || kind === 'end'
        ? 4.5
        : 3.5;
  const strokeWeight = active ? 2.5 : emphasizeVertices ? 2 : 1.25;
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: markerFill(active),
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight,
    scale,
  };
}

function googleLiveMarkerIcon(maps) {
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: LIVE_ACCENT,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2.5,
    scale: 9,
  };
}

function liveAccuracyStyle(sourceKind) {
  if (sourceKind === 'wifi') {
    return { color: '#2f80ff', weight: 2, opacity: 0.55, dashArray: '6 6', fillColor: '#2f80ff', fillOpacity: 0.1 };
  }
  if (sourceKind === 'lbs') {
    return { color: '#667085', weight: 2, opacity: 0.45, dashArray: '4 8', fillColor: '#94a3b8', fillOpacity: 0.12 };
  }
  return { color: LIVE_ACCENT, weight: 1.5, opacity: 0.4, fillColor: LIVE_ACCENT, fillOpacity: 0.08 };
}

function LeafletLiveLayers({
  lat,
  lng,
  follow,
  onUserPan,
  accuracyM,
  markerLabel,
  liveTrail = [],
  petMarker = null,
}) {
  const smooth = useAnimatedLatLng(lat, lng, { enabled: true });

  const trailPositions = useMemo(
    () => (Array.isArray(liveTrail) && liveTrail.length > 1 ? liveTrail.map((p) => [p.lat, p.lng]) : []),
    [liveTrail]
  );

  const petIcon = useMemo(() => {
    if (!petMarker) return livePetIcon;
    return buildLeafletPetMarkerIcon({
      photoUrl: petMarker.photoUrl,
      placeholderEmoji: petMarker.placeholderEmoji,
      sourceKind: petMarker.sourceKind,
      name: petMarker.name || markerLabel,
    });
  }, [petMarker, markerLabel]);

  const accStyle = liveAccuracyStyle(petMarker?.sourceKind);

  return (
    <>
      <LeafletUserPanDetector onUserPan={onUserPan} />
      <LeafletFollowPan lat={smooth.lat} lng={smooth.lng} follow={follow} zoom={LIVE_MAP_ZOOM} />
      {trailPositions.length > 1 ? (
        <LeafletPolyline
          positions={trailPositions}
          pathOptions={{ color: LIVE_TRAIL, weight: 3, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
        />
      ) : null}
      {accuracyM != null && accuracyM > 0 ? (
        <Circle center={[smooth.lat, smooth.lng]} radius={accuracyM} pathOptions={accStyle} />
      ) : null}
      <LeafletMarker position={[smooth.lat, smooth.lng]} icon={petIcon} zIndexOffset={1000}>
        <Popup>{markerLabel || 'Last reported position'}</Popup>
      </LeafletMarker>
    </>
  );
}

function normalizeRoutePath(path) {
  if (!Array.isArray(path)) return [];
  return path
    .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

function LeafletPositionMap({
  lat,
  lng,
  path = [],
  routeMarkers = [],
  playbackPointIndex = null,
  liveMode = false,
  accuracyM = null,
  markerLabel = '',
  liveTrail = [],
  recenterLabel = 'Follow pet',
  showRouteVertices = false,
  petMarker = null,
  mapActive = true,
  layoutTick = 0,
}) {
  const [followEnabled, setFollowEnabled] = useState(true);
  const z = liveMode ? LIVE_MAP_ZOOM : 16;
  const routePath = useMemo(() => normalizeRoutePath(path), [path]);
  const hasPath = routePath.length > 1;
  const head =
    playbackPointIndex != null && routePath[playbackPointIndex]
      ? routePath[playbackPointIndex]
      : routePath[0] || { lat, lng };
  const center = head;
  const playbackFollow = hasPath && playbackPointIndex != null;

  const displayMarkers = useMemo(() => {
    if (routeMarkers.length) return routeMarkers;
    if (!showRouteVertices || !routePath.length) return [];
    return routePath.map((p, i) => ({
      id: `vertex-${i}`,
      pointIndex: i,
      lat: p.lat,
      lng: p.lng,
      kind: i === 0 ? 'start' : i === routePath.length - 1 ? 'end' : 'walk',
      label: '',
    }));
  }, [routeMarkers, showRouteVertices, routePath]);

  useEffect(() => {
    if (liveMode) setFollowEnabled(true);
  }, [liveMode, lat, lng]);

  return (
    <div className={`pp-positionMap${liveMode ? ' pp-positionMap--live' : ''}${showRouteVertices ? ' pp-positionMap--routeVertices' : ''}`}>
      {liveMode && !hasPath ? (
        <MapRecenterButton
          visible={!followEnabled}
          label={recenterLabel}
          onClick={() => setFollowEnabled(true)}
        />
      ) : null}
      <MapSizeGate active={mapActive} layoutTick={layoutTick} className="pp-mapSizeGate--fill">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={z}
          scrollWheelZoom
          style={{ height: '100%', width: '100%', minHeight: liveMode ? LIVE_MAP_FILL_MIN_HEIGHT : undefined }}
        >
          <LeafletInvalidateSize active={mapActive} />
        {hasPath ? (
          <FitRoute path={routePath} />
        ) : accuracyM != null && accuracyM > 0 ? (
          <FitRoute path={[{ lat, lng }]} zoom={liveMode ? LIVE_MAP_ZOOM : 16} />
        ) : liveMode ? (
          <FitRoute path={[{ lat, lng }]} zoom={LIVE_MAP_ZOOM} />
        ) : (
          <FlyTo lat={lat} lng={lng} />
        )}
        {playbackFollow ? (
          <FlyTo lat={head.lat} lng={head.lng} smooth />
        ) : null}
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Tiles &copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        {liveMode && !hasPath ? (
          <LeafletLiveLayers
            lat={lat}
            lng={lng}
            follow={followEnabled}
            onUserPan={() => setFollowEnabled(false)}
            accuracyM={accuracyM}
            markerLabel={markerLabel}
            liveTrail={liveTrail}
            petMarker={petMarker}
          />
        ) : null}
        {!hasPath && accuracyM != null && accuracyM > 0 ? (
          <Circle
            center={[lat, lng]}
            radius={accuracyM}
            pathOptions={{
              color: LIVE_ACCENT,
              fillColor: LIVE_ACCENT,
              fillOpacity: 0.14,
              weight: 1.5,
            }}
          />
        ) : null}
        {hasPath ? (
          <>
            <LeafletPolyline
              positions={routePath.map((p) => [p.lat, p.lng])}
              smoothFactor={0}
              pathOptions={{
                color: ROUTE_LINE,
                weight: showRouteVertices ? 4 : 3,
                opacity: 0.95,
                lineCap: 'butt',
                lineJoin: 'miter',
              }}
            />
            <LeafletPolyline
              positions={routePath.map((p) => [p.lat, p.lng])}
              smoothFactor={0}
              pathOptions={{
                color: ROUTE_LINE,
                weight: showRouteVertices ? 10 : 9,
                opacity: 0.16,
                lineCap: 'butt',
                lineJoin: 'miter',
              }}
            />
            {displayMarkers.map((m) => {
              const active = playbackPointIndex != null && m.pointIndex === playbackPointIndex;
              const r = leafletDotRadius(m.kind, active, showRouteVertices);
              const stroke = leafletDotStroke(active);
              return (
                <CircleMarker
                  key={m.id}
                  center={[m.lat, m.lng]}
                  radius={r}
                  pathOptions={{
                    color: stroke.color,
                    weight: stroke.weight,
                    fillColor: markerFill(active),
                    fillOpacity: active ? 1 : 0.92,
                    opacity: 1,
                  }}
                >
                  <Popup>{m.label}</Popup>
                </CircleMarker>
              );
            })}
          </>
        ) : !liveMode ? (
          <LeafletMarker position={[lat, lng]}>
            <Popup>{markerLabel || 'Last reported position'}</Popup>
          </LeafletMarker>
        ) : null}
        </MapContainer>
      </MapSizeGate>
    </div>
  );
}

function GoogleLiveMapInner({
  lat,
  lng,
  accuracyM,
  markerLabel,
  liveTrail,
  maps,
  follow,
  onUserPan,
  petMarker = null,
}) {
  const smooth = useAnimatedLatLng(lat, lng, { enabled: true });
  const [petIconUrl, setPetIconUrl] = useState(null);

  useEffect(() => {
    const photo = petMarker?.photoUrl;
    if (!photo) {
      setPetIconUrl(null);
      return undefined;
    }
    let cancelled = false;
    buildCircularGooglePetIconUrl(photo)
      .then((url) => {
        if (!cancelled) setPetIconUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPetIconUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [petMarker?.photoUrl]);

  const trailPath = useMemo(() => normalizeRoutePath(liveTrail), [liveTrail]);

  const markerIcon = useMemo(() => {
    if (!petMarker) return googleLiveMarkerIcon(maps);
    return buildGooglePetMarkerIcon(maps, {
      photoUrl: petMarker.photoUrl,
      iconUrl: petIconUrl || undefined,
      sourceKind: petMarker.sourceKind,
    });
  }, [maps, petMarker, petIconUrl]);

  const accStroke =
    petMarker?.sourceKind === 'wifi' ? '#2f80ff' : petMarker?.sourceKind === 'lbs' ? '#94a3b8' : LIVE_ACCENT;

  return (
    <>
      <GoogleUserPanDetector onUserPan={onUserPan} />
      <GoogleFollowPan lat={smooth.lat} lng={smooth.lng} follow={follow} zoom={LIVE_MAP_ZOOM} />
      {trailPath.length > 1 ? <GoogleLiveTrail path={trailPath} /> : null}
      {accuracyM != null && accuracyM > 0 ? (
        <GoogleCircle
          center={{ lat: smooth.lat, lng: smooth.lng }}
          radius={accuracyM}
          options={{
            strokeColor: accStroke,
            strokeOpacity: 0.5,
            strokeWeight: 2,
            fillColor: accStroke,
            fillOpacity: 0.1,
            clickable: false,
            zIndex: 1,
          }}
        />
      ) : null}
      <Marker
        position={{ lat: smooth.lat, lng: smooth.lng }}
        icon={markerIcon}
        title={markerLabel || 'Pet location'}
        zIndex={3}
      />
    </>
  );
}

function GooglePositionMap({
  lat,
  lng,
  apiKey,
  path = [],
  routeMarkers = [],
  playbackPointIndex = null,
  fill = false,
  liveMode = false,
  accuracyM = null,
  markerLabel = '',
  liveTrail = [],
  recenterLabel = 'Follow pet',
  showRouteVertices = false,
  petMarker = null,
  mapActive = true,
  layoutTick = 0,
}) {
  const [authFailed, setAuthFailed] = useState(false);
  const [followEnabled, setFollowEnabled] = useState(true);
  useEffect(() => subscribeGoogleMapsAuthFailure(() => setAuthFailed(true)), []);
  useEffect(() => {
    if (liveMode) setFollowEnabled(true);
  }, [liveMode, lat, lng]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
    libraries: ['places'],
  });

  const routePath = useMemo(() => normalizeRoutePath(path), [path]);
  const hasPath = routePath.length > 1;
  const head =
    playbackPointIndex != null && routePath[playbackPointIndex]
      ? routePath[playbackPointIndex]
      : routePath[0] || { lat, lng };
  const center = head;
  const smoothPlayback = useAnimatedLatLng(head.lat, head.lng, {
    enabled: hasPath && playbackPointIndex != null,
  });

  const displayMarkers = useMemo(() => {
    if (routeMarkers.length) return routeMarkers;
    if (!showRouteVertices || !routePath.length) return [];
    return routePath.map((p, i) => ({
      id: `vertex-${i}`,
      pointIndex: i,
      lat: p.lat,
      lng: p.lng,
      kind: i === 0 ? 'start' : i === routePath.length - 1 ? 'end' : 'walk',
      label: '',
    }));
  }, [routeMarkers, showRouteVertices, routePath]);

  if (authFailed || loadError) {
    return (
      <LeafletPositionMap
        lat={lat}
        lng={lng}
        path={path}
        routeMarkers={routeMarkers}
        playbackPointIndex={playbackPointIndex}
        fill={fill}
        liveMode={liveMode}
        accuracyM={accuracyM}
        markerLabel={markerLabel}
        liveTrail={liveTrail}
        recenterLabel={recenterLabel}
        showRouteVertices={showRouteVertices}
        petMarker={petMarker}
        mapActive={mapActive}
        layoutTick={layoutTick}
      />
    );
  }

  if (!isLoaded) {
    return (
      <div className="pp-mapLoading">
        <span className="pp-mapLoading__pulse" aria-hidden />
        Loading map…
      </div>
    );
  }

  const maps = window.google.maps;
  const displayLat = hasPath && playbackPointIndex != null ? smoothPlayback.lat : lat;
  const displayLng = hasPath && playbackPointIndex != null ? smoothPlayback.lng : lng;

  return (
    <div className={`pp-positionMap${liveMode ? ' pp-positionMap--live' : ''}${showRouteVertices ? ' pp-positionMap--routeVertices' : ''}`}>
      {liveMode && !hasPath ? (
        <MapRecenterButton
          visible={!followEnabled}
          label={recenterLabel}
          onClick={() => setFollowEnabled(true)}
        />
      ) : null}
      <MapSizeGate active={mapActive} layoutTick={layoutTick} className="pp-mapSizeGate--fill">
        <GoogleMap
          mapContainerStyle={fill ? googleMapContainerStyleFill : googleMapContainerStyle}
          center={{ lat: displayLat, lng: displayLng }}
          zoom={liveMode && !hasPath ? LIVE_MAP_ZOOM : 16}
          options={googleMapOptions}
        >
          {fill ? <GoogleMapResize /> : null}
        {hasPath ? (
          <GoogleFitRoute path={routePath} />
        ) : accuracyM != null && accuracyM > 0 ? (
          <GoogleFitRoute path={[{ lat, lng }]} zoom={liveMode ? LIVE_MAP_ZOOM : 16} />
        ) : liveMode ? (
          <GoogleFitRoute path={[{ lat, lng }]} zoom={LIVE_MAP_ZOOM} />
        ) : null}
        {hasPath && playbackPointIndex != null ? (
          <GoogleFollowPan lat={smoothPlayback.lat} lng={smoothPlayback.lng} follow />
        ) : null}
        {liveMode && !hasPath ? (
          <GoogleLiveMapInner
            lat={lat}
            lng={lng}
            accuracyM={accuracyM}
            markerLabel={markerLabel}
            liveTrail={liveTrail}
            maps={maps}
            follow={followEnabled}
            onUserPan={() => setFollowEnabled(false)}
            petMarker={petMarker}
          />
        ) : null}
        {!hasPath && accuracyM != null && accuracyM > 0 ? (
          <GoogleCircle
            center={{ lat, lng }}
            radius={accuracyM}
            options={{
              strokeColor: LIVE_ACCENT,
              strokeOpacity: 0.55,
              strokeWeight: 1.5,
              fillColor: LIVE_ACCENT,
              fillOpacity: 0.14,
            }}
          />
        ) : null}
        {hasPath ? (
          <>
            <GoogleRoutePolylines path={routePath} emphasize={showRouteVertices} />
            {displayMarkers.map((m) => {
              const active = playbackPointIndex != null && m.pointIndex === playbackPointIndex;
              const icon = googleRouteDotIcon(maps, m.kind, active, showRouteVertices);
              return (
                <Marker
                  key={`${m.id}-${active ? 'a' : 'i'}`}
                  position={{ lat: m.lat, lng: m.lng }}
                  icon={icon}
                  title={m.label}
                  zIndex={active ? 30 : 20}
                />
              );
            })}
          </>
        ) : !liveMode ? (
          <Marker position={center} title={markerLabel || 'Last reported position'} />
        ) : null}
        </GoogleMap>
      </MapSizeGate>
    </div>
  );
}

/**
 * Google Maps when API key is set; otherwise Leaflet + OSM.
 * @param {boolean} [liveMode] Smooth marker, follow mode, trail, accuracy ring
 * @param {number|null} [accuracyM] Accuracy circle radius in meters
 * @param {string} [markerLabel] Popup / marker title
 * @param {Array<{lat:number,lng:number}>} [liveTrail] Recent live positions (breadcrumb)
 * @param {string} [recenterLabel] Accessible label for follow button
 */
export default function PositionMap({
  lat,
  lng,
  path = [],
  routeMarkers = [],
  playbackPointIndex = null,
  fill = false,
  liveMode = false,
  accuracyM = null,
  markerLabel = '',
  liveTrail = [],
  recenterLabel = 'Follow pet',
  showRouteVertices = false,
  petMarker = null,
  mapActive = true,
  layoutTick = 0,
}) {
  const useGoogle = trackingUsesGoogleMaps();
  const googleKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY?.trim();
  return (
    <div className={`pp-leaflet-wrap${fill ? ' pp-leaflet-wrap--fill' : ''}${liveMode ? ' pp-leaflet-wrap--live' : ''}`}>
      {useGoogle ? (
        <GooglePositionMap
          lat={lat}
          lng={lng}
          apiKey={googleKey}
          path={path}
          routeMarkers={routeMarkers}
          playbackPointIndex={playbackPointIndex}
          fill={fill}
          liveMode={liveMode}
          accuracyM={accuracyM}
          markerLabel={markerLabel}
          liveTrail={liveTrail}
          recenterLabel={recenterLabel}
          showRouteVertices={showRouteVertices}
          petMarker={petMarker}
          mapActive={mapActive}
          layoutTick={layoutTick}
        />
      ) : (
        <LeafletPositionMap
          lat={lat}
          lng={lng}
          path={path}
          routeMarkers={routeMarkers}
          playbackPointIndex={playbackPointIndex}
          fill={fill}
          liveMode={liveMode}
          accuracyM={accuracyM}
          markerLabel={markerLabel}
          liveTrail={liveTrail}
          recenterLabel={recenterLabel}
          showRouteVertices={showRouteVertices}
          petMarker={petMarker}
          mapActive={mapActive}
          layoutTick={layoutTick}
        />
      )}
    </div>
  );
}
