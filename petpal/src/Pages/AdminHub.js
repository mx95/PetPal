import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';

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
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">Firebase is not configured.</p>
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
              Admin
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              Admin tools
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 700 }}>
              These actions can affect live user accounts and devices. Only accounts with a Firestore document in{' '}
              <code>admins/&lt;uid&gt;</code> can access this page.
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            ← Dashboard
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-actionGrid">
          <AdminActionCard
            to="/admin/company-approvals"
            icon="🏪"
            title="Company approvals"
            desc="Review pending venue applications."
          />
          <AdminActionCard
            to="/admin/devices"
            icon="🛰️"
            title="Device registry"
            desc="View all IMEIs, add collars, assign 365GPS or GPSPOS protocol."
          />
          <AdminActionCard
            to="/admin/broadcast"
            icon="📬"
            title="Broadcast inbox"
            desc="Send a message to every user’s profile inbox."
          />
          <AdminActionCard
            to="/admin/bookings"
            icon="📅"
            title="All bookings"
            desc="Live Firestore feed of every appointment — search by customer, provider, or booking id."
          />
          <AdminActionCard
            to="/admin/orders"
            icon="📦"
            title="Shop orders"
            desc="Track payments, shipping, and GPS tracker fulfilment — update status per customer."
          />
        </div>
      </div>
    </div>
  );
}

