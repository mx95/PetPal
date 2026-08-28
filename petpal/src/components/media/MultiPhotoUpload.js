import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import {
  PHOTO_ACCEPT,
  PHOTO_MAX_COUNT,
  newPhotoDraftId,
  normalizePrimaryPhoto,
  prepareListingPhotoFile,
} from '../../media/photoUploadUtils';

/**
 * @param {{
 *   photos: import('../../media/photoUploadUtils').PhotoDraft[],
 *   onChange: (next: import('../../media/photoUploadUtils').PhotoDraft[]) => void,
 *   maxCount?: number,
 *   hint?: string,
 *   disabled?: boolean,
 * }} props
 */
export default function MultiPhotoUpload({ photos, onChange, maxCount = PHOTO_MAX_COUNT, hint, disabled }) {
  const { t } = useI18n();
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      photos.forEach((p) => {
        if (p.previewUrl?.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(p.previewUrl);
          } catch {
            // ignore
          }
        }
      });
    },
    [photos]
  );

  function setPrimary(id) {
    onChange(normalizePrimaryPhoto(photos.map((p) => ({ ...p, isPrimary: p.id === id }))));
  }

  function removePhoto(id) {
    const target = photos.find((p) => p.id === id);
    if (target?.previewUrl?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(target.previewUrl);
      } catch {
        // ignore
      }
    }
    onChange(normalizePrimaryPhoto(photos.filter((p) => p.id !== id)));
  }

  async function onFilesSelected(fileList) {
    setError('');
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = maxCount - photos.length;
    if (room <= 0) {
      setError(t('photos.errMaxCount', { count: maxCount }));
      return;
    }
    setBusy(true);
    const next = [...photos];
    try {
      for (const file of files.slice(0, room)) {
        if (!file?.type?.startsWith('image/')) {
          setError(t('photos.errType'));
          continue;
        }
        try {
          const prepared = await prepareListingPhotoFile(file);
          next.push({
            id: newPhotoDraftId(),
            previewUrl: URL.createObjectURL(prepared),
            file: prepared,
            isPrimary: next.length === 0,
          });
        } catch (e) {
          setError(e?.message === 'TOO_LARGE' ? t('photos.errTooLarge') : t('photos.errType'));
        }
      }
      if (next.length > photos.length) {
        onChange(normalizePrimaryPhoto(next));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pp-photoUpload">
      <p className="pp-subtle pp-photoUpload__hint">{hint || t('photos.hintClearFace')}</p>
      <div className="pp-photoUpload__grid">
        {photos.map((p) => (
          <figure key={p.id} className={`pp-photoUpload__item${p.isPrimary ? ' is-primary' : ''}`}>
            <img src={p.previewUrl || p.photoUrl} alt="" loading="lazy" />
            {p.isPrimary ? <span className="pp-photoUpload__badge">{t('photos.cover')}</span> : null}
            <div className="pp-photoUpload__actions">
              {!p.isPrimary ? (
                <button type="button" className="pp-photoUpload__btn" onClick={() => setPrimary(p.id)} disabled={disabled || busy}>
                  {t('photos.setCover')}
                </button>
              ) : null}
              <button type="button" className="pp-photoUpload__btn pp-photoUpload__btn--danger" onClick={() => removePhoto(p.id)} disabled={disabled || busy}>
                {t('photos.remove')}
              </button>
            </div>
          </figure>
        ))}
        {photos.length < maxCount ? (
          <button
            type="button"
            className="pp-photoUpload__add"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
            aria-label={t('photos.add')}
          >
            <span aria-hidden>+</span>
            <span>{t('photos.add')}</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        className="pp-visuallyHidden"
        onChange={(e) => {
          onFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      {error ? <p className="pp-error">{error}</p> : null}
    </div>
  );
}
