import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import MarketplaceProductForm from './MarketplaceProductForm';
import { marketplaceCategoryEmoji } from '../../shop/marketplaceCategories';
import { formatEurFromCents } from '../../shop/marketplacePricing';
import {
  createMarketplaceProduct,
  deleteMarketplaceProduct,
  subscribeCompanyMarketplaceProducts,
  updateMarketplaceProduct,
} from '../../shop/marketplaceProductsFirestore';

function statusLabel(t, status) {
  if (status === 'approved') return t('marketplace.statusApproved');
  if (status === 'rejected') return t('marketplace.statusRejected');
  return t('marketplace.statusPending');
}

/**
 * Business portal: manage own marketplace products (pending until admin approves).
 */
export default function MarketplaceProductsPanel({
  companyId,
  companyName,
  uid,
}) {
  const { t } = useI18n();
  const [products, setProducts] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      return undefined;
    }
    return subscribeCompanyMarketplaceProducts(
      companyId,
      setProducts,
      (e) => setErr(e?.message || t('common.errorGeneric'))
    );
  }, [companyId, t]);

  const onCreate = async (payload) => {
    setBusy(true);
    setErr('');
    try {
      await createMarketplaceProduct({
        ...payload,
        sellerType: 'company',
        companyId,
        companyName,
        createdBy: uid,
        status: 'pending',
      });
      setShowForm(false);
    } catch (e) {
      setErr(e?.message || t('common.errorGeneric'));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const onUpdate = async (payload) => {
    if (!editing?.id) return;
    setBusy(true);
    setErr('');
    try {
      await updateMarketplaceProduct(editing.id, {
        ...payload,
        _merchantFallback: editing.merchantPriceCents,
        _listedFallback: editing.listedPriceCents,
        _selfShipFallback: editing.selfShip,
        // Edits by business return to pending review
        status: 'pending',
      });
      setEditing(null);
    } catch (e) {
      setErr(e?.message || t('common.errorGeneric'));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (product) => {
    if (!window.confirm(t('marketplace.confirmDelete'))) return;
    setErr('');
    try {
      await deleteMarketplaceProduct(product.id);
    } catch (e) {
      setErr(e?.message || t('common.errorGeneric'));
    }
  };

  return (
    <section className="pp-providerPanel">
      <div className="pp-providerPanel__head">
        <div>
          <h2>{t('marketplace.businessTitle')}</h2>
          <p>{t('marketplace.businessIntro')}</p>
        </div>
        <button
          type="button"
          className="pp-btn pp-btn--primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          + {t('marketplace.addProduct')}
        </button>
      </div>

      {err ? <div className="pp-error">{err}</div> : null}

      {showForm && !editing ? (
        <div className="pp-providerFormCard">
          <h3 className="pp-providerFormCard__title">{t('marketplace.addProduct')}</h3>
          <MarketplaceProductForm
            uid={uid}
            busy={busy}
            submitLabel={t('marketplace.submitForReview')}
            onCancel={() => setShowForm(false)}
            onSubmit={onCreate}
          />
        </div>
      ) : null}

      {editing ? (
        <div className="pp-providerFormCard">
          <h3 className="pp-providerFormCard__title">{t('marketplace.editProduct')}</h3>
          <MarketplaceProductForm
            initial={editing}
            uid={uid}
            busy={busy}
            submitLabel={t('marketplace.saveResubmit')}
            onCancel={() => setEditing(null)}
            onSubmit={onUpdate}
          />
        </div>
      ) : null}

      <div className="pp-marketplaceProductList">
        {products.length === 0 ? (
          <div className="pp-providerEmptyCard">{t('marketplace.emptyBusiness')}</div>
        ) : (
          products.map((p) => (
            <article key={p.id} className="pp-marketplaceProductCard">
              <div className="pp-marketplaceProductCard__media">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" />
                ) : (
                  <span aria-hidden>{marketplaceCategoryEmoji(p.category)}</span>
                )}
              </div>
              <div className="pp-marketplaceProductCard__body">
                <div className="pp-marketplaceProductCard__top">
                  <h3>{p.title}</h3>
                  <span className={`pp-marketplaceStatus pp-marketplaceStatus--${p.status}`}>
                    {statusLabel(t, p.status)}
                  </span>
                </div>
                <p className="pp-subtle">{p.description || t('marketplace.noDescription')}</p>
                <div className="pp-marketplaceProductCard__meta">
                  <span>{t(`marketplace.category.${p.category}`)}</span>
                  <span>
                    {t('marketplace.youKeep')} {formatEurFromCents(p.merchantPriceCents)}
                  </span>
                  <span>
                    {t('marketplace.listedAt')} {formatEurFromCents(p.listedPriceCents)}
                  </span>
                  <span>
                    {p.selfShip ? t('marketplace.badgeSelfShip') : t('marketplace.badgePetPalShip')} ·{' '}
                    {p.commissionPercent}%
                  </span>
                </div>
              </div>
              <div className="pp-marketplaceProductCard__actions">
                <button type="button" onClick={() => setEditing(p)}>
                  {t('providerPortal.edit')}
                </button>
                <button type="button" onClick={() => void onDelete(p)}>
                  {t('providerPortal.delete')}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
