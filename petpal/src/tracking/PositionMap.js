import L from 'leaflet';
import React, { useEffect, useMemo, useState } from 'react';
import { Circle as GoogleCircle, GoogleMap, Marker, Polyline, useGoogleMap, useJsApiLoader } from '@react-google-maps/api';
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

import 'leaflet/dist/leaflet.css';

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

const googleMapContainerStyleFill = {
  width: '100%',
  height: '100%',
  minHeight: '100%',
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

function leafletDotRadius(kind, active) {
  if (active) return kind === 'start' || kind === 'end' ? 8 : 7;
  if (kind === 'start' || kind === 'end') return 4;
  return 3;
}

function leafletDotStroke(active) {
  if (active) return { weight: 2.5, color: '#ffffff' };
  return { weight: 1.25, color: '#ffffff' };
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

function FitRoute({ path }) {
  const map = useMap();
  useEffect(() => {
    if (!Array.isArray(path) || path.length < 2) return;
    const bounds = L.latLngBounds(path.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
  }, [path, map]);
  return null;
}

function LeafletFollowPan({ lat, lng, follow }) {
  const map = useMap();
  useEffect(() => {
    if (!follow || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.panTo([lat, lng], { animate: true, duration: 0.45 });
  }, [lat, lng, follow, map]);
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

function GoogleFollowPan({ lat, lng, follow }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || !follow || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.panTo({ lat, lng });
  }, [map, follow, lat, lng]);
  return null;
}

function GoogleFitRoute({ path }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map || !window.google?.maps || !Array.isArray(path) || path.length < 2) return;
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 48);
  }, [map, path]);
  return null;
}

function GoogleUserPanDetector({ onUserPan }) {
  const map = useGoogleMap();
  useEffect(() => {
    if (!map) return;
    const drag = map.addListener('dragstart', () => onUserPan?.());
    return () => drag.remove();
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

function googleRouteDotIcon(maps, kind, active) {
  const scale = active ? (kind === 'start' || kind === 'end' ? 7 : 6.5) : kind === 'start' || kind === 'end' ? 4.5 : 3.5;
  const strokeWeight = active ? 2.5 : 1.25;
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

function LeafletLiveLayers({ lat, lng, follow, onUserPan, accuracyM, markerLabel, liveTrail = [] }) {
  const smooth = useAnimatedLatLng(lat, lng, { enabled: true });

  const trailPositions = useMemo(
    () => (Array.isArray(liveTrail) && liveTrail.length > 1 ? liveTrail.map((p) => [p.lat, p.lng]) : []),
    [liveTrail]
  );

  return (
    <>
      <LeafletUserPanDetector onUserPan={onUserPan} />
      <LeafletFollowPan lat={smooth.lat} lng={smooth.lng} follow={follow} />
      {trailPositions.length > 1 ? (
        <LeafletPolyline
          positions={trailPositions}
          pathOptions={{ color: LIVE_TRAIL, weight: 3, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
        />
      ) : null}
      {accuracyM != null && accuracyM > 0 ? (
        <Circle
          center={[smooth.lat, smooth.lng]}
          radius={accuracyM}
          pathOptions={{ color: LIVE_ACCENT, weight: 1, opacity: 0.35, fillColor: LIVE_ACCENT, fillOpacity: 0.07 }}
        />
      ) : null}
      <LeafletMarker position={[smooth.lat, smooth.lng]} icon={livePetIcon}>
        <Popup>{markerLabel || 'Last reported position'}</Popup>
      </LeafletMarker>
    </>
  );
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
}) {
  const [followEnabled, setFollowEnabled] = useState(true);
  const z = 16;
  const hasPath = Array.isArray(path) && path.length > 1;
  const head =
    playbackPointIndex != null && path[playbackPointIndex]
      ? path[playbackPointIndex]
      : path[0] || { lat, lng };
  const center = head;
  const playbackFollow = hasPath && playbackPointIndex != null;

  useEffect(() => {
    if (liveMode) setFollowEnabled(true);
  }, [liveMode, lat, lng]);

  return (
    <div className={`pp-positionMap${liveMode ? ' pp-positionMap--live' : ''}`}>
      {liveMode && !hasPath ? (
        <MapRecenterButton
          visible={!followEnabled}
          label={recenterLabel}
          onClick={() => setFollowEnabled(true)}
        />
      ) : null}
      <MapContainer center={[center.lat, center.lng]} zoom={z} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        {hasPath ? <FitRoute path={path} /> : liveMode ? null : <FlyTo lat={lat} lng={lng} />}
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
          />
        ) : null}
        {hasPath ? (
          <>
            <LeafletPolyline
              positions={path.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: ROUTE_LINE, weight: 2, opacity: 0.88, dashArray: '6 10' }}
            />
            <LeafletPolyline
              positions={path.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: ROUTE_LINE, weight: 8, opacity: 0.12, dashArray: '6 10' }}
            />
            {routeMarkers.map((m) => {
              const active = playbackPointIndex != null && m.pointIndex === playbackPointIndex;
              const r = leafletDotRadius(m.kind, active);
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
    </div>
  );
}

function GoogleLiveMapInner({ lat, lng, accuracyM, markerLabel, liveTrail, maps, follow, onUserPan }) {
  const smooth = useAnimatedLatLng(lat, lng, { enabled: true });

  const trailPath = useMemo(
    () => (Array.isArray(liveTrail) && liveTrail.length > 1 ? liveTrail : []),
    [liveTrail]
  );

  return (
    <>
      <GoogleUserPanDetector onUserPan={onUserPan} />
      <GoogleFollowPan lat={smooth.lat} lng={smooth.lng} follow={follow} />
      {trailPath.length > 1 ? (
        <Polyline
          path={trailPath}
          options={{ strokeColor: LIVE_ACCENT, strokeOpacity: 0.42, strokeWeight: 4, geodesic: true }}
        />
      ) : null}
      {accuracyM != null && accuracyM > 0 ? (
        <GoogleCircle
          center={{ lat: smooth.lat, lng: smooth.lng }}
          radius={accuracyM}
          options={{
            strokeColor: LIVE_ACCENT,
            strokeOpacity: 0.35,
            strokeWeight: 1,
            fillColor: LIVE_ACCENT,
            fillOpacity: 0.08,
            clickable: false,
            zIndex: 1,
          }}
        />
      ) : null}
      <Marker
        position={{ lat: smooth.lat, lng: smooth.lng }}
        icon={googleLiveMarkerIcon(maps)}
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

  const hasPath = Array.isArray(path) && path.length > 1;
  const head =
    playbackPointIndex != null && path[playbackPointIndex]
      ? path[playbackPointIndex]
      : path[0] || { lat, lng };
  const center = head;
  const smoothPlayback = useAnimatedLatLng(head.lat, head.lng, {
    enabled: hasPath && playbackPointIndex != null,
  });

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
    <div className={`pp-positionMap${liveMode ? ' pp-positionMap--live' : ''}`}>
      {liveMode && !hasPath ? (
        <MapRecenterButton
          visible={!followEnabled}
          label={recenterLabel}
          onClick={() => setFollowEnabled(true)}
        />
      ) : null}
      <GoogleMap
        mapContainerStyle={fill ? googleMapContainerStyleFill : googleMapContainerStyle}
        center={{ lat: displayLat, lng: displayLng }}
        zoom={16}
        options={googleMapOptions}
      >
        {hasPath ? <GoogleFitRoute path={path} /> : null}
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
          />
        ) : null}
        {hasPath ? (
          <>
            <Polyline path={path} options={{ strokeColor: ROUTE_LINE, strokeOpacity: 0.88, strokeWeight: 2, geodesic: true }} />
            <Polyline
              path={path}
              options={{ strokeColor: ROUTE_LINE, strokeOpacity: 0.14, strokeWeight: 8, geodesic: true }}
            />
            {routeMarkers.map((m) => {
              const active = playbackPointIndex != null && m.pointIndex === playbackPointIndex;
              const icon = googleRouteDotIcon(maps, m.kind, active);
              return (
                <Marker
                  key={`${m.id}-${active ? 'a' : 'i'}`}
                  position={{ lat: m.lat, lng: m.lng }}
                  icon={icon}
                  title={m.label}
                  zIndex={active ? 4 : 2}
                />
              );
            })}
          </>
        ) : !liveMode ? (
          <Marker position={center} title={markerLabel || 'Last reported position'} />
        ) : null}
      </GoogleMap>
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
}) {
  const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY?.trim();
  return (
    <div className={`pp-leaflet-wrap${fill ? ' pp-leaflet-wrap--fill' : ''}${liveMode ? ' pp-leaflet-wrap--live' : ''}`}>
      {key ? (
        <GooglePositionMap
          lat={lat}
          lng={lng}
          apiKey={key}
          path={path}
          routeMarkers={routeMarkers}
          playbackPointIndex={playbackPointIndex}
          fill={fill}
          liveMode={liveMode}
          accuracyM={accuracyM}
          markerLabel={markerLabel}
          liveTrail={liveTrail}
          recenterLabel={recenterLabel}
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
        />
      )}
    </div>
  );
}
