import React, { memo } from 'react';
import { OverlayView } from '@react-google-maps/api';

function pinOffset() {
  // Larger pin — keep tip anchored on the place.
  return { x: -24, y: -56 };
}

/**
 * Category emoji pin on the Nearby Google Map.
 * OverlayView (DOM) keeps emoji readable and tap targets large on mobile;
 * map center is uncontrolled so these no longer flicker while panning.
 */
function NearbyCategoryPin({ place, category, active, onClick }) {
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

export default memo(NearbyCategoryPin);
