import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';

function AdminActionCard({ to, icon, title, desc }) {
  return (
    <Link to={to} className="pp-actionCard pp-actionCard--admin">
      <span className="pp-actionCard__icon" aria-hidden>
        {icon}
      </span>
      <div className="pp-actionCard__body">
        <span className="pp-actionCard__title">{title}</span>
        <span className="pp-actionCard__desc">{desc}</span>
      </div>
      <span className="pp-actionCard__arrow" aria-hidden>
        →
      </span>
    </Link>
  );
}

export default function AdminHub() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge" style={{ background: 'rgba(180, 35, 24, 0.1)', color: '#b42318' }}>
              {t('admin.badge')}
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('admin.hub.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 700 }}>
              {t('admin.hub.introPrefix')}{' '}
              <code>admins/&lt;uid&gt;</code> {t('admin.hub.introSuffix')}
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            {t('admin.backDashboard')}
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-actionGrid">
          <AdminActionCard
            to="/admin/company-approvals"
            icon="🏪"
            title={t('admin.hub.companyApprovalsTitle')}
            desc={t('admin.hub.companyApprovalsDesc')}
          />
          <AdminActionCard
            to="/admin/devices"
            icon="🛰️"
            title={t('admin.hub.deviceRegistryTitle')}
            desc={t('admin.hub.deviceRegistryDesc')}
          />
          <AdminActionCard
            to="/admin/broadcast"
            icon="📬"
            title={t('admin.hub.broadcastTitle')}
            desc={t('admin.hub.broadcastDesc')}
          />
          <AdminActionCard
            to="/admin/bookings"
            icon="📅"
            title={t('admin.hub.bookingsTitle')}
            desc={t('admin.hub.bookingsDesc')}
          />
          <AdminActionCard
            to="/admin/orders"
            icon="📦"
            title={t('admin.hub.ordersTitle')}
            desc={t('admin.hub.ordersDesc')}
          />
        </div>
      </div>
    </div>
  );
}

