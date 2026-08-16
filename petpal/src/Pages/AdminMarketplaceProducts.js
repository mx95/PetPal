import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import MarketplaceProductForm from '../components/shop/MarketplaceProductForm';
import { marketplaceCategoryEmoji } from '../shop/marketplaceCategories';
import { formatEurFromCents, PETPAL_SELLER_NAME } from '../shop/marketplacePricing';
import {
  createMarketplaceProduct,
  deleteMarketplaceProduct,
  setMarketplaceProductStatus,
  subscribeAllMarketplaceProducts,
  updateMarketplaceProduct,
} from '../shop/marketplaceProductsFirestore';

function statusLabel(t, status) {
  if (status === 'approved') return t('marketplace.statusApproved');
  if (status === 'rejected') return t('marketplace.statusRejected');
  return t('marketplace.statusPending');
}

export default function AdminMarketplaceProducts() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, adminReady, firebaseReady } = useCompany();
  const [products, setProducts] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!firebaseReady || !adminReady || !isAdmin) return undefined;
    return subscribeAllMarketplaceProducts(
      setProducts,
      (e) => setErr(e?.message || t('common.errorGeneric'))
    );
  }, [firebaseReady, adminReady, isAdmin, t]);

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) return <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>;
  if (!adminReady) return <p className="pp-subtle">{t('admin.loading')}</p>;
  if (!isAdmin) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">{t('admin.accessDenied')}</p>
          <Link className="pp-link" to="/dashboard">
            {t('admin.backDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  const visible = products.filter((p) => {
    if (filter === 'pending') return p.status === 'pending';
    if (filter === 'approved') return p.status === 'approved';
    if (filter === 'petpal') return p.sellerType === 'petpal';
    return true;
  });

  const onCreate = async (payload) => {
    setBusy(true);
    setErr('');
    try {
      await createMarketplaceProduct({
        ...payload,
        sellerType: 'petpal',
        companyId: 'petpal',
        companyName: PETPAL_SELLER_NAME,
        createdBy: user.uid,
        status: 'approved',
        selfShip: Boolean(payload.selfShip),
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
      });
      setEditing(null);
    } catch (e) {
      setErr(e?.message || t('common.errorGeneric'));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge" style={{ background: 'rgba(180, 35, 24, 0.1)', color: '#b42318' }}>
              {t('admin.badge')}
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('marketplace.adminTitle')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 720 }}>
              {t('marketplace.adminIntro')}
            </p>
          </div>
          <Link className="pp-link" to="/admin">
            {t('admin.backAdminTools')}
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            ['all', t('marketplace.filterAll')],
            ['pending', t('marketplace.filterPending')],
            ['approved', t('marketplace.filterApproved')],
            ['petpal', t('marketplace.filterPetpal')],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`pp-btn${filter === id ? ' pp-btn--primary' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="pp-btn pp-btn--primary"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            + {t('marketplace.addPetpalProduct')}
          </button>
        </div>
        {err ? <p className="pp-error">{err}</p> : null}
      </div>

      {showForm && !editing ? (
        <div className="pp-col-12 pp-col-md-8">
          <div className="pp-card pp-pad">
            <h2 className="pp-h2" style={{ marginTop: 0 }}>
              {t('marketplace.addPetpalProduct')}
            </h2>
            <p className="pp-subtle">{t('marketplace.petpalSellerNote')}</p>
            <MarketplaceProductForm
              uid={user.uid}
              busy={busy}
              submitLabel={t('marketplace.publish')}
              onCancel={() => setShowForm(false)}
              onSubmit={onCreate}
            />
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="pp-col-12 pp-col-md-8">
          <div className="pp-card pp-pad">
            <h2 className="pp-h2" style={{ marginTop: 0 }}>
              {t('marketplace.editProduct')}
            </h2>
            <MarketplaceProductForm
              initial={editing}
              uid={user.uid}
              busy={busy}
              submitLabel={t('marketplace.save')}
              onCancel={() => setEditing(null)}
              onSubmit={onUpdate}
            />
          </div>
        </div>
      ) : null}

      <div className="pp-col-12">
        <div className="pp-marketplaceProductList">
          {visible.length === 0 ? (
            <div className="pp-card pp-pad pp-subtle">{t('marketplace.emptyAdmin')}</div>
          ) : (
            visible.map((p) => (
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
                  <p className="pp-subtle">
                    {p.companyName} · {t(`marketplace.category.${p.category}`)}
                  </p>
                  <div className="pp-marketplaceProductCard__meta">
                    <span>
                      {t('marketplace.youKeep')} {formatEurFromCents(p.merchantPriceCents)}
                    </span>
                    <span>
                      {t('marketplace.listedAt')} {formatEurFromCents(p.listedPriceCents)}
                    </span>
                    <span>
                      {p.commissionPercent}% ·{' '}
                      {p.selfShip ? t('marketplace.badgeSelfShip') : t('marketplace.badgePetPalShip')}
                    </span>
                  </div>
                </div>
                <div className="pp-marketplaceProductCard__actions">
                  {p.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void setMarketplaceProductStatus(p.id, 'approved', user.uid)}
                      >
                        {t('marketplace.approve')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void setMarketplaceProductStatus(p.id, 'rejected', user.uid)}
                      >
                        {t('marketplace.reject')}
                      </button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => setEditing(p)}>
                    {t('providerPortal.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('marketplace.confirmDelete'))) {
                        void deleteMarketplaceProduct(p.id);
                      }
                    }}
                  >
                    {t('providerPortal.delete')}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
