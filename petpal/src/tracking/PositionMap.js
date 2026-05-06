import L from 'leaflet';
import React, { useEffect, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { MapContainer, Marker as LeafletMarker, Popup, TileLayer, useMap } from 'react-leaflet';

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
const googleMapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: true };

function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom() || 16, { duration: 0.5 });
  }, [lat, lng, map]);
  return null;
}

function LeafletPositionMap({ lat, lng }) {
  const z = 16;
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={z}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <FlyTo lat={lat} lng={lng} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LeafletMarker position={[lat, lng]}>
        <Popup>Last reported position</Popup>
      </LeafletMarker>
    </MapContainer>
  );
}

function GooglePositionMap({ lat, lng, apiKey }) {
  const [authFailed, setAuthFailed] = useState(false);
  useEffect(() => subscribeGoogleMapsAuthFailure(() => setAuthFailed(true)), []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
    /** Same as Nearby — one shared script load per app (Places unused here but required for a single loader id). */
    libraries: ['places'],
  });

  const center = { lat, lng };

  if (authFailed || loadError) {
    return <LeafletPositionMap lat={lat} lng={lng} />;
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
      <Marker position={center} />
    </GoogleMap>
  );
}

/**
 * Uses Google Maps when `REACT_APP_GOOGLE_MAPS_API_KEY` is set (same loader id as Nearby).
 * Falls back to Leaflet + OpenStreetMap when no key or Google script fails.
 *
 * @param {{ lat: number, lng: number }} props
 */
export default function PositionMap({ lat, lng }) {
  const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY?.trim();
  return (
    <div className="pp-leaflet-wrap">
      {key ? <GooglePositionMap lat={lat} lng={lng} apiKey={key} /> : <LeafletPositionMap lat={lat} lng={lng} />}
    </div>
  );
}
