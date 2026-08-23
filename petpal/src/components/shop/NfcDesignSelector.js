import React, { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { getNfcTagDesignById, NFC_TAG_DESIGNS } from '../../data/nfcTagDesigns';
import NfcDesignCard from './NfcDesignCard';

/**
 * NFC tag design picker — horizontal snap carousel (touch / scroll only).
 *
 * @param {{
 *   selectedDesignId: number,
 *   onChange: (id: number) => void,
 *   disabled?: boolean,
 *   designs?: Array<{ id: number, name: string, image: string }>,
 * }} props
 */
export default function NfcDesignSelector({
  selectedDesignId,
  onChange,
  disabled = false,
  designs = NFC_TAG_DESIGNS,
}) {
  const { t } = useI18n();
  const trackRef = useRef(null);
  const selected = useMemo(
    () => getNfcTagDesignById(selectedDesignId) || designs[0],
    [selectedDesignId, designs]
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !selected?.id) return;
    const card = el.querySelector(`[data-nfc-design-id="${selected.id}"]`);
    if (!(card instanceof HTMLElement)) return;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2;
    el.scrollTo({
      left: Math.max(0, target),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [selected?.id]);

  if (!designs.length) return null;

  return (
    <div className="pp-nfcDesignSelector" role="group" aria-label={t('shopPage.nfcDesignAria')}>
      <h3 className="pp-nfcDesignSelector__title">{t('shopPage.nfcDesignTitle')}</h3>

      <div className="pp-nfcDesignSelector__preview">
        <div className="pp-nfcDesignSelector__previewLabel">{t('shopPage.nfcDesignSelected')}</div>
        <figure className="pp-nfcDesignSelector__previewMedia">
          <img
            className="pp-nfcDesignSelector__previewImg"
            src={selected.image}
            alt={selected.name}
          />
        </figure>
        <div className="pp-nfcDesignSelector__previewName">{selected.name}</div>
      </div>

      <div className="pp-nfcDesignSelector__carousel">
        <div className="pp-nfcDesignSelector__track" ref={trackRef} tabIndex={0}>
          {designs.map((design) => (
            <div
              key={design.id}
              className="pp-nfcDesignSelector__slide"
              data-nfc-design-id={design.id}
            >
              <NfcDesignCard
                design={design}
                selected={design.id === selected.id}
                disabled={disabled}
                onSelect={onChange}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
