import L from 'leaflet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

import 'leaflet/dist/leaflet.css';

import { defaultMapCenter } from './locationDefaults';

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

function ClickToPlace({ onPick, disabled }) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Pans the map when the parent picks a place from search (recenterSignal increments).
 */
function FlyToSearchResult({ lat, lng, recenterSignal }) {
  const map = useMap();
  const last = useRef(0);
  useEffect(() => {
    if (!recenterSignal || recenterSignal === last.current) return;
    last.current = recenterSignal;
    map.flyTo([lat, lng], 17, { duration: 0.45 });
  }, [lat, lng, recenterSignal, map]);
  return null;
}

function MapInstanceBridge({ onMap }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

/**
 * Picker for a single lat/lng on OpenStreetMap (no Google key required).
 * @param {{ lat: number, lng: number, onChange: (lat: number, lng: number) => void, disabled?: boolean, recenterSignal?: number }} props
 */
export default function LocationPicker({ lat, lng, onChange, disabled, recenterSignal = 0 }) {
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const mapRef = useRef(null);
  useEffect(() => {
    setMapReady(true);
  }, []);

  const safeLat = Number.isFinite(Number(lat)) ? Number(lat) : defaultMapCenter.lat;
  const safeLng = Number.isFinite(Number(lng)) ? Number(lng) : defaultMapCenter.lng;

  const onMarkerDrag = useCallback(
    (e) => {
      const p = e.target.getLatLng();
      onChange(p.lat, p.lng);
    },
    [onChange]
  );

  const goToCurrentLocation = useCallback(() => {
    if (disabled || locating) return;
    if (!navigator?.geolocation) {
      setLocError('Geolocation is not available in this browser/device.');
      return;
    }
    setLocError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (g) => {
        const nextLat = g.coords.latitude;
        const nextLng = g.coords.longitude;
        onChange(nextLat, nextLng);
        if (mapRef.current) mapRef.current.flyTo([nextLat, nextLng], 17, { duration: 0.45 });
        setLocating(false);
      },
      (err) => {
        const msg =
          err?.code === 1
            ? 'Location permission denied. Please allow location access in your browser settings.'
            : err?.code === 2
              ? 'Could not detect your location. Try again in an open-sky area or with better network.'
              : 'Location request timed out. Please try again.';
        setLocError(msg);
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 12_000 }
    );
  }, [disabled, locating, onChange]);

  return (
    <div
      className="pp-leaflet-wrap pp-companyMap"
      role="application"
      aria-label="Choose business location on map"
      style={{ position: 'relative' }}
    >
      <p className="pp-subtle" style={{ fontSize: 12, marginBottom: 8 }}>
        Search for your business, then fine-tune by dragging the pin or clicking the map.
      </p>
      {!mapReady ? (
        <div
          style={{ height: 320, width: '100%', background: 'rgba(0, 0, 0, 0.04)', borderRadius: 12 }}
          aria-hidden
        />
      ) : (
        <MapContainer
          center={[safeLat, safeLng]}
          zoom={15}
          scrollWheelZoom={!disabled}
          style={{ height: 320, width: '100%' }}
        >
          <MapInstanceBridge onMap={(map) => { mapRef.current = map; }} />
          <FlyToSearchResult lat={safeLat} lng={safeLng} recenterSignal={recenterSignal} />
          <ClickToPlace onPick={onChange} disabled={!!disabled} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[safeLat, safeLng]}
            draggable={!disabled}
            eventHandlers={{ dragend: onMarkerDrag }}
          />
        </MapContainer>
      )}
      <button
        type="button"
        className="pp-btn"
        onClick={goToCurrentLocation}
        disabled={!!disabled || locating}
        aria-label="Use my current location"
        title="Use my current location"
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          zIndex: 600,
          width: 40,
          height: 40,
          borderRadius: 12,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          boxShadow: '0 8px 20px rgba(16,24,40,.18)',
          background: '#fff',
        }}
      >
        {locating ? '…' : '◎'}
      </button>
      {locError ? (
        <p className="pp-error" style={{ margin: '8px 0 0', fontSize: 12 }}>
          {locError}
        </p>
      ) : null}
    </div>
  );
}

export { defaultMapCenter };
