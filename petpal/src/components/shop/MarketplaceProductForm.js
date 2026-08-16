import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { MARKETPLACE_CATEGORIES } from '../../shop/marketplaceCategories';
import {
  commissionPercentLabel,
  formatEurFromCents,
  syncLinkedPrices,
} from '../../shop/marketplacePricing';
import { uploadMarketplaceProductPhoto } from '../../shop/productPhotoStorage';

/**
 * Shared create/edit form for marketplace products (business + admin).
 */
export default function MarketplaceProductForm({
  initial = null,
  uid,
  busy = false,
  submitLabel,
  onSubmit,
  onCancel,
  showSelfShip = true,
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState(initial?.category || 'treats');
  const [selfShip, setSelfShip] = useState(Boolean(initial?.selfShip));
  const [lastEdited, setLastEdited] = useState(/** @type {'merchant'|'listed'} */ ('merchant'));
  const [merchantInput, setMerchantInput] = useState(
    initial?.merchantPriceCents != null ? (Number(initial.merchantPriceCents) / 100).toFixed(2) : '50.00'
  );
  const [listedInput, setListedInput] = useState(() => {
    if (initial?.listedPriceCents != null) return (Number(initial.listedPriceCents) / 100).toFixed(2);
    const next = syncLinkedPrices({
      merchantPriceCents: 5000,
      listedPriceCents: 0,
      selfShip: false,
      lastEdited: 'merchant',
    });
    return (next.listedPriceCents / 100).toFixed(2);
  });
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '');
  const [imageStoragePath, setImageStoragePath] = useState(initial?.imageStoragePath || '');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!initial) return;
    setTitle(initial.title || '');
    setDescription(initial.description || '');
    setCategory(initial.category || 'treats');
    setSelfShip(Boolean(initial.selfShip));
    setMerchantInput(
      initial.merchantPriceCents != null ? (Number(initial.merchantPriceCents) / 100).toFixed(2) : '50.00'
    );
    setListedInput(
      initial.listedPriceCents != null ? (Number(initial.listedPriceCents) / 100).toFixed(2) : ''
    );
    setImageUrl(initial.imageUrl || '');
    setImageStoragePath(initial.imageStoragePath || '');
  }, [initial]);

  const synced = useMemo(() => {
    const merchantCents = Math.round((Number(merchantInput) || 0) * 100);
    const listedCents = Math.round((Number(listedInput) || 0) * 100);
    return syncLinkedPrices({
      merchantPriceCents: merchantCents,
      listedPriceCents: listedCents || merchantCents,
      selfShip,
      lastEdited,
    });
  }, [merchantInput, listedInput, selfShip, lastEdited]);

  const onMerchantChange = (raw) => {
    setLastEdited('merchant');
    setMerchantInput(raw);
    const merchantCents = Math.round((Number(raw) || 0) * 100);
    const next = syncLinkedPrices({
      merchantPriceCents: merchantCents,
      listedPriceCents: 0,
      selfShip,
      lastEdited: 'merchant',
    });
    setListedInput((next.listedPriceCents / 100).toFixed(2));
  };

  const onListedChange = (raw) => {
    setLastEdited('listed');
    setListedInput(raw);
    const listedCents = Math.round((Number(raw) || 0) * 100);
    const next = syncLinkedPrices({
      merchantPriceCents: 0,
      listedPriceCents: listedCents,
      selfShip,
      lastEdited: 'listed',
    });
    setMerchantInput((next.merchantPriceCents / 100).toFixed(2));
  };

  const onSelfShipChange = (checked) => {
    setSelfShip(checked);
    const merchantCents = Math.round((Number(merchantInput) || 0) * 100);
    const listedCents = Math.round((Number(listedInput) || 0) * 100);
    const next = syncLinkedPrices({
      merchantPriceCents: merchantCents,
      listedPriceCents: listedCents,
      selfShip: checked,
      lastEdited,
    });
    setMerchantInput((next.merchantPriceCents / 100).toFixed(2));
    setListedInput((next.listedPriceCents / 100).toFixed(2));
  };

  const onPickImage = async (file) => {
    if (!file || !uid) return;
    setErr('');
    setUploading(true);
    try {
      const uploaded = await uploadMarketplaceProductPhoto({
        uid,
        file,
        productKey: initial?.id || 'new',
      });
      if (!uploaded?.imageUrl) throw new Error(t('marketplace.errUpload'));
      setImageUrl(uploaded.imageUrl);
      setImageStoragePath(uploaded.imageStoragePath);
    } catch (e) {
      setErr(e?.message || t('marketplace.errUpload'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        selfShip,
        merchantPriceCents: synced.merchantPriceCents,
        listedPriceCents: synced.listedPriceCents,
        imageUrl,
        imageStoragePath,
        lastEdited,
      });
    } catch (ex) {
      setErr(ex?.message || t('common.errorGeneric'));
    }
  };

  return (
    <form className="pp-form pp-marketplaceProductForm" onSubmit={(e) => void handleSubmit(e)}>
      {err ? <p className="pp-error">{err}</p> : null}

      <label className="pp-field">
        <span className="pp-field__label">{t('marketplace.fieldTitle')}</span>
        <input
          className="pp-input"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('marketplace.fieldTitlePh')}
        />
      </label>

      <label className="pp-field">
        <span className="pp-field__label">{t('marketplace.fieldDescription')}</span>
        <textarea
          className="pp-input"
          rows={3}
          maxLength={800}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('marketplace.fieldDescriptionPh')}
        />
      </label>

      <label className="pp-field">
        <span className="pp-field__label">{t('marketplace.fieldCategory')}</span>
        <select className="pp-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {MARKETPLACE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {t(`marketplace.category.${c.id}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="pp-marketplaceProductForm__prices">
        <label className="pp-field">
          <span className="pp-field__label">{t('marketplace.merchantPrice')}</span>
          <input
            className="pp-input"
            type="number"
            min="0.05"
            step="0.05"
            required
            value={merchantInput}
            onChange={(e) => onMerchantChange(e.target.value)}
          />
        </label>
        <label className="pp-field">
          <span className="pp-field__label">{t('marketplace.listedPrice')}</span>
          <input
            className="pp-input"
            type="number"
            min="0.05"
            step="0.05"
            required
            value={listedInput}
            onChange={(e) => onListedChange(e.target.value)}
          />
        </label>
      </div>

      <p className="pp-subtle pp-marketplaceProductForm__hint">
        {t('marketplace.priceHint', {
          merchant: formatEurFromCents(synced.merchantPriceCents),
          commission: formatEurFromCents(synced.commissionCents),
          percent: commissionPercentLabel(synced.rate),
          listed: formatEurFromCents(synced.listedPriceCents),
        })}
      </p>

      {showSelfShip ? (
        <>
          <label className="pp-field pp-field--checkbox">
            <input
              type="checkbox"
              checked={selfShip}
              onChange={(e) => onSelfShipChange(e.target.checked)}
            />
            <span>{t('marketplace.selfShip')}</span>
          </label>
          <p className="pp-subtle">
            {selfShip ? t('marketplace.selfShipOn') : t('marketplace.selfShipOff')}
          </p>
        </>
      ) : null}

      <label className="pp-field">
        <span className="pp-field__label">{t('marketplace.fieldImage')}</span>
        <input
          className="pp-input"
          type="file"
          accept="image/*"
          disabled={uploading || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPickImage(file);
            e.target.value = '';
          }}
        />
      </label>
      {imageUrl ? (
        <div className="pp-marketplaceProductForm__preview">
          <img src={imageUrl} alt="" />
        </div>
      ) : null}

      <div className="pp-row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="submit" className="pp-btn pp-btn--primary" disabled={busy || uploading}>
          {busy || uploading ? t('admin.saving') : submitLabel || t('marketplace.save')}
        </button>
        {onCancel ? (
          <button type="button" className="pp-btn" disabled={busy} onClick={onCancel}>
            {t('common.cancel')}
          </button>
        ) : null}
      </div>
    </form>
  );
}
