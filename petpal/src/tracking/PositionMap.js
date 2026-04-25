import L from 'leaflet';
import React, { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

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

function FlyTo({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom() || 16, { duration: 0.5 });
  }, [lat, lng, map]);
  return null;
}

/**
 * @param {{ lat: number, lng: number }} props
 */
export default function PositionMap({ lat, lng }) {
  const z = 16;
  return (
    <div className="pp-leaflet-wrap">
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
        <Marker position={[lat, lng]}>
          <Popup>Last reported position</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
