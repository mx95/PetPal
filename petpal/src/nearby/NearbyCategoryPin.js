import React from 'react';
import { OverlayView } from '@react-google-maps/api';

function pinOffset() {
  return { x: -18, y: -42 };
}

/**
 * Category emoji pin on the Nearby Google Map (replaces generic blue dots).
 */
export default function NearbyCategoryPin({ place, category, active, onClick }) {
  const loc = place?.geometry?.location;
  if (!loc) return null;

  return (
    <OverlayView
      position={loc}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={pinOffset}
    >
      <button
        type="button"
        className={`pp-nearby-mapPin${active ? ' is-active' : ''}`}
        title={place.name || category.label}
        aria-label={place.name || category.label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick?.();
        }}
      >
        <span className="pp-nearby-mapPin__bubble" aria-hidden>
          {category.icon}
        </span>
        <span className="pp-nearby-mapPin__stem" aria-hidden />
      </button>
    </OverlayView>
  );
}
