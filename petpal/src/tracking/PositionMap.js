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

function LeafletPositionMap({ lat, lng, path = [], routeMarkers = [], playbackPosition = null }) {
  const z = 16;
  const hasPath = Array.isArray(path) && path.length > 1;
  const center = playbackPosition || (path[0] || { lat, lng });
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
          <LeafletPolyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#5b37ff', weight: 5, opacity: 0.84 }} />
          <LeafletPolyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#a78bfa', weight: 10, opacity: 0.18 }} />
          {routeMarkers.map((m) => (
            <CircleMarker
              key={m.id}
              center={[m.lat, m.lng]}
              radius={m.kind === 'start' || m.kind === 'end' ? 9 : 6}
              pathOptions={{
                color: m.kind === 'end' ? '#ef4444' : m.kind === 'rest' ? '#64748b' : '#5b37ff',
                fillColor: m.kind === 'end' ? '#ef4444' : m.kind === 'rest' ? '#64748b' : '#5b37ff',
                fillOpacity: 0.86,
                weight: 3,
              }}
            >
              <Popup>{m.label}</Popup>
            </CircleMarker>
          ))}
          {playbackPosition ? (
            <CircleMarker center={[playbackPosition.lat, playbackPosition.lng]} radius={11} pathOptions={{ color: '#fff', fillColor: '#5b37ff', fillOpacity: 1, weight: 4 }}>
              <Popup>Playback position</Popup>
            </CircleMarker>
          ) : null}
        </>
      ) : (
        <LeafletMarker position={[lat, lng]}>
          <Popup>Last reported position</Popup>
        </LeafletMarker>
      )}
    </MapContainer>
  );
}

function GooglePositionMap({ lat, lng, apiKey, path = [], routeMarkers = [], playbackPosition = null }) {
  const [authFailed, setAuthFailed] = useState(false);
  useEffect(() => subscribeGoogleMapsAuthFailure(() => setAuthFailed(true)), []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
    /** Same as Nearby — one shared script load per app (Places unused here but required for a single loader id). */
    libraries: ['places'],
  });

  const hasPath = Array.isArray(path) && path.length > 1;
  const center = playbackPosition || (path[0] || { lat, lng });

  if (authFailed || loadError) {
    return <LeafletPositionMap lat={lat} lng={lng} path={path} routeMarkers={routeMarkers} playbackPosition={playbackPosition} />;
  }

  if (!isLoaded) {
    return (
      <div className="pp-subtle" style={{ padding: 24, textAlign: 'center' }}>
        Loading map…
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={googleMapContainerStyle}
      center={center}
      zoom={16}
      options={googleMapOptions}
    >
      {hasPath ? (
        <>
          <Polyline path={path} options={{ strokeColor: '#5b37ff', strokeOpacity: 0.86, strokeWeight: 5 }} />
          {routeMarkers.map((m) => (
            <Marker key={m.id} position={{ lat: m.lat, lng: m.lng }} label={m.kind === 'start' ? 'S' : m.kind === 'end' ? 'E' : '•'} title={m.label} />
          ))}
          {playbackPosition ? <Marker position={playbackPosition} title="Playback position" /> : null}
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
 * @param {{ lat: number, lng: number }} props
 */
export default function PositionMap({ lat, lng, path = [], routeMarkers = [], playbackPosition = null }) {
  const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY?.trim();
  return (
    <div className="pp-leaflet-wrap">
      {key ? (
        <GooglePositionMap lat={lat} lng={lng} apiKey={key} path={path} routeMarkers={routeMarkers} playbackPosition={playbackPosition} />
      ) : (
        <LeafletPositionMap lat={lat} lng={lng} path={path} routeMarkers={routeMarkers} playbackPosition={playbackPosition} />
      )}
    </div>
  );
}
