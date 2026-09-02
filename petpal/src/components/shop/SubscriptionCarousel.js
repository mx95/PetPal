import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Horizontal snap carousel for subscription plan cards (mobile-first).
 */
export default function SubscriptionCarousel({ children, ariaLabel = 'Subscription plans' }) {
  const trackRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const slideCount = React.Children.count(children);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActiveFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || slideCount < 1) return;
    const slides = track.querySelectorAll('.pp-shopSubCarousel__slide');
    if (!slides.length) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((slide, idx) => {
      const el = /** @type {HTMLElement} */ (slide);
      const slideCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(slideCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    });
    setActiveIndex(best);
  }, [slideCount]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateActiveFromScroll);
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    updateActiveFromScroll();
    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener('scroll', onScroll);
    };
  }, [updateActiveFromScroll, slideCount]);

  function scrollToIndex(idx) {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelectorAll('.pp-shopSubCarousel__slide')[idx];
    if (!slide) return;
    slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  if (slideCount === 0) return null;

  return (
    <div className="pp-shopSubCarousel" aria-label={ariaLabel}>
      <div className="pp-shopSubCarousel__track" ref={trackRef} role="list">
        {React.Children.map(children, (child, idx) => (
          <div className="pp-shopSubCarousel__slide" role="listitem" key={idx}>
            {child}
          </div>
        ))}
      </div>
      {slideCount > 1 ? (
        <div className="pp-shopSubCarousel__dots" role="tablist" aria-label="Plan slides">
          {Array.from({ length: slideCount }, (_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={activeIndex === idx}
              aria-label={`Plan ${idx + 1} of ${slideCount}`}
              className={`pp-shopSubCarousel__dot${activeIndex === idx ? ' is-active' : ''}`}
              onClick={() => scrollToIndex(idx)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
