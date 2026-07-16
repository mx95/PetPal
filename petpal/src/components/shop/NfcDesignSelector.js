import React, { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { getNfcTagDesignById, NFC_TAG_DESIGNS } from '../../data/nfcTagDesigns';
import NfcDesignCard from './NfcDesignCard';

/**
 * Reusable NFC tag design picker. Add designs only in NFC_TAG_DESIGNS.
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
  const selected = useMemo(
    () => getNfcTagDesignById(selectedDesignId) || designs[0],
    [selectedDesignId, designs]
  );

  if (!designs.length) return null;

  return (
    <div className="pp-nfcDesignSelector" role="group" aria-label={t('shopPage.nfcDesignAria')}>
      <h3 className="pp-nfcDesignSelector__title">{t('shopPage.nfcDesignTitle')}</h3>

      <div className="pp-nfcDesignSelector__preview">
        <div className="pp-nfcDesignSelector__previewLabel">{t('shopPage.nfcDesignSelected')}</div>
        <img
          className="pp-nfcDesignSelector__previewImg"
          src={selected.image}
          alt={selected.name}
        />
        <div className="pp-nfcDesignSelector__previewName">{selected.name}</div>
      </div>

      <div className="pp-nfcDesignSelector__grid">
        {designs.map((design) => (
          <NfcDesignCard
            key={design.id}
            design={design}
            selected={design.id === selected.id}
            disabled={disabled}
            onSelect={onChange}
          />
        ))}
      </div>
    </div>
  );
}
