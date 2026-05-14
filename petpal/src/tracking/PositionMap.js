import L from 'leaflet';
import React, { useEffect, useState } from 'react';
import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Marker as LeafletMarker,
  Polyline as LeafletPolyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';

import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

import { GOOGLE_MAPS_LOADER_ID } from '../config/googleMapsLoaderId';
import { subscribeGoogleMapsAuthFailure } from '../config/googleMapsAuthFailure';

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

/** Route dots — align with tracker history UI (purple + white ring). */
const ROUTE_DOT = '#7c3aed';
const ROUTE_LINE = '#7c3aed';

const googleMapContainerStyle = {
  width: '100%',
  height: '100%',
  minHeight: 'min(52vh, 440px)',
};
const googleMapOptions = { streetViewControl: false, mapTypeControl: true, fullscreenControl: true };

function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom() || 16, { duration: 0.5 });
  }, [lat, lng, map]);
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

function markerFill(kind) {
  if (kind === 'end') return '#ef4444';
  if (kind === 'start') return '#22c55e';
  if (kind === 'rest') return '#64748b';
  return ROUTE_DOT;
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

function LeafletPositionMap({ lat, lng, path = [], routeMarkers = [], playbackPointIndex = null }) {
  const z = 16;
  const hasPath = Array.isArray(path) && path.length > 1;
  const head =
    playbackPointIndex != null && path[playbackPointIndex]
      ? path[playbackPointIndex]
      : path[0] || { lat, lng };
  const center = head;
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={z}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      {hasPath ? <FitRoute path={path} /> : <FlyTo lat={lat} lng={lng} />}
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
      </LayersControl>
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
                  fillColor: markerFill(m.kind),
                  fillOpacity: active ? 1 : 0.92,
                  opacity: 1,
                }}
              >
                <Popup>{m.label}</Popup>
              </CircleMarker>
            );
          })}
        </>
      ) : (
        <LeafletMarker position={[lat, lng]}>
          <Popup>Last reported position</Popup>
        </LeafletMarker>
      )}
    </MapContainer>
  );
}

function googleRouteDotIcon(maps, kind, active) {
  const scale = active ? (kind === 'start' || kind === 'end' ? 7 : 6.5) : kind === 'start' || kind === 'end' ? 4.5 : 3.5;
  const strokeWeight = active ? 2.5 : 1.25;
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: markerFill(kind),
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight,
    scale,
  };
}

function GooglePositionMap({ lat, lng, apiKey, path = [], routeMarkers = [], playbackPointIndex = null }) {
  const [authFailed, setAuthFailed] = useState(false);
  useEffect(() => subscribeGoogleMapsAuthFailure(() => setAuthFailed(true)), []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
    /** Same as Nearby — one shared script load per app (Places unused here but required for a single loader id). */
    libraries: ['places'],
  });

  const hasPath = Array.isArray(path) && path.length > 1;
  const head =
    playbackPointIndex != null && path[playbackPointIndex]
      ? path[playbackPointIndex]
      : path[0] || { lat, lng };
  const center = head;

  if (authFailed || loadError) {
    return <LeafletPositionMap lat={lat} lng={lng} path={path} routeMarkers={routeMarkers} playbackPointIndex={playbackPointIndex} />;
  }

  if (!isLoaded) {
    return (
      <div className="pp-subtle" style={{ padding: 24, textAlign: 'center' }}>
        Loading map…
      </div>
    );
  }

  return (
    <GoogleMap mapContainerStyle={googleMapContainerStyle} center={center} zoom={16} options={googleMapOptions}>
      {hasPath ? (
        <>
          <Polyline path={path} options={{ strokeColor: ROUTE_LINE, strokeOpacity: 0.88, strokeWeight: 2 }} />
          {routeMarkers.map((m) => {
            const active = playbackPointIndex != null && m.pointIndex === playbackPointIndex;
            const icon = googleRouteDotIcon(window.google.maps, m.kind, active);
            return <Marker key={`${m.id}-${active ? 'a' : 'i'}`} position={{ lat: m.lat, lng: m.lng }} icon={icon} title={m.label} />;
          })}
        </>
      ) : (
        <Marker position={center} />
      )}
    </GoogleMap>
  );
}

/**
 * Uses Google Maps when `REACT_APP_GOOGLE_MAPS_API_KEY` is set (same loader id as Nearby).
 * Falls back to Leaflet + OpenStreetMap when no key or Google script fails.
 *
 * @param {{ lat: number, lng: number, path?: Array, routeMarkers?: Array, playbackPointIndex?: number|null }} props
 * Route markers may include `pointIndex`, `kind` ('start'|'end'|'rest'|other), `id`, `label`.
 */
export default function PositionMap({ lat, lng, path = [], routeMarkers = [], playbackPointIndex = null }) {
  const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY?.trim();
  return (
    <div className="pp-leaflet-wrap">
      {key ? (
        <GooglePositionMap lat={lat} lng={lng} apiKey={key} path={path} routeMarkers={routeMarkers} playbackPointIndex={playbackPointIndex} />
      ) : (
        <LeafletPositionMap lat={lat} lng={lng} path={path} routeMarkers={routeMarkers} playbackPointIndex={playbackPointIndex} />
      )}
    </div>
  );
}
