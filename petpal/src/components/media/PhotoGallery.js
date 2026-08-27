import React, { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';

/**
 * @param {{ photos: Array<{ url?: string, photoUrl?: string }>, className?: string }} props
 */
export default function PhotoGallery({ photos, className = '' }) {
  const { t } = useI18n();
  const urls = useMemo(
    () => (photos || []).map((p) => String(p.url || p.photoUrl || '').trim()).filter(Boolean),
    [photos]
  );
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const current = urls[index] || '';

  if (!urls.length) {
    return (
      <div className={`pp-photoGallery pp-photoGallery--empty ${className}`.trim()}>
        <div className="pp-photoGallery__placeholder" aria-hidden>
          🐾
        </div>
      </div>
    );
  }

  function prev() {
    setIndex((i) => (i - 1 + urls.length) % urls.length);
  }

  function next() {
    setIndex((i) => (i + 1) % urls.length);
  }

  const gallery = (
    <div className={`pp-photoGallery ${className}`.trim()}>
      <div className="pp-photoGallery__stage">
        <img src={current} alt="" className="pp-photoGallery__img" />
        {urls.length > 1 ? (
          <>
            <button type="button" className="pp-photoGallery__nav pp-photoGallery__nav--prev" onClick={prev} aria-label={t('photos.prev')}>
              ‹
            </button>
            <button type="button" className="pp-photoGallery__nav pp-photoGallery__nav--next" onClick={next} aria-label={t('photos.next')}>
              ›
            </button>
            <span className="pp-photoGallery__counter">
              {index + 1}/{urls.length}
            </span>
          </>
        ) : null}
        <button type="button" className="pp-photoGallery__fullscreen" onClick={() => setFullscreen(true)}>
          {t('photos.fullscreen')}
        </button>
      </div>
      {urls.length > 1 ? (
        <div className="pp-photoGallery__thumbs">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              className={`pp-photoGallery__thumb${i === index ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={t('photos.photoN', { n: i + 1 })}
            >
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  if (!fullscreen) return gallery;

  return (
    <>
      {gallery}
      <div className="pp-photoGallery__overlay" role="dialog" aria-modal="true">
        <button type="button" className="pp-photoGallery__close" onClick={() => setFullscreen(false)}>
          {t('common.close')}
        </button>
        <img src={current} alt="" className="pp-photoGallery__overlayImg" />
        {urls.length > 1 ? (
          <div className="pp-photoGallery__overlayNav">
            <button type="button" onClick={prev}>
              ‹
            </button>
            <span>
              {index + 1}/{urls.length}
            </span>
            <button type="button" onClick={next}>
              ›
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
