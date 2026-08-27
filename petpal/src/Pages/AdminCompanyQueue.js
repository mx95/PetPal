import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import {
  adminApproveCompany,
  adminRejectCompany,
  fetchPendingCompanyApplications,
} from '../company/companyFirestore';
import {
  adminApproveShelter,
  adminRejectShelter,
  adminReactivateShelter,
  adminSuspendShelter,
  fetchPendingShelterApplications,
} from '../shelter/shelterFirestore';
import { useI18n } from '../i18n/I18nContext';

function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export default function AdminCompanyQueue() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();
  const [list, setList] = useState(/** @type {import('../company/companyTypes').CompanyProfile[]} */ ([]));
  const [shelterList, setShelterList] = useState(/** @type {import('../shelter/shelterTypes').ShelterProfile[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [actionId, setActionId] = useState(/** @type {string | null} */ (null));
  const [noteById, setNoteById] = useState(() => ({}));

  const refresh = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const rows = await fetchPendingCompanyApplications();
      setList(rows);
      const shelters = await fetchPendingShelterApplications();
      setShelterList(shelters);
    } catch (e) {
      setErr(e?.message || t('admin.companyQueue.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
  }, [isAdmin, refresh]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!firebaseReady) {
    return (
      <div className="pp-grid">
        <div className="pp-col-12">
          <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  async function approve(id) {
    setActionId(id);
    setErr('');
    try {
      await adminApproveCompany(id, noteById[id] || '');
      await refresh();
    } catch (e) {
      setErr(e?.message || t('admin.companyQueue.errApprove'));
    } finally {
      setActionId(null);
    }
  }

  async function reject(id) {
    setActionId(id);
    setErr('');
    try {
      await adminRejectCompany(id, noteById[id] || t('admin.companyQueue.defaultRejectNote'));
      await refresh();
    } catch (e) {
      setErr(e?.message || t('admin.companyQueue.errReject'));
    } finally {
      setActionId(null);
    }
  }

  async function approveShelter(id) {
    setActionId(id);
    setErr('');
    try {
      await adminApproveShelter(id, noteById[id] || '');
      await refresh();
    } catch (e) {
      setErr(e?.message || t('admin.shelterQueue.errApprove'));
    } finally {
      setActionId(null);
    }
  }

  async function rejectShelter(id) {
    setActionId(id);
    setErr('');
    try {
      await adminRejectShelter(id, noteById[id] || t('admin.companyQueue.defaultRejectNote'));
      await refresh();
    } catch (e) {
      setErr(e?.message || t('admin.shelterQueue.errReject'));
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge" style={{ background: 'rgba(180, 35, 24, 0.1)', color: '#b42318' }}>
              {t('admin.badge')}
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('admin.companyQueue.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 640 }}>
              {t('admin.companyQueue.subPrefix')}{' '}
              <code>admins/&lt;yourUid&gt;</code> {t('admin.companyQueue.subSuffix')}
            </p>
          </div>
          <Link className="pp-link" to="/dashboard">
            {t('admin.backDashboard')}
          </Link>
        </div>
      </div>
      {err ? (
        <div className="pp-col-12">
          <p className="pp-error" style={{ margin: 0 }}>
            {err}
          </p>
        </div>
      ) : null}
      <div className="pp-col-12">
        {loading ? (
          <p className="pp-subtle">{t('admin.loading')}</p>
        ) : list.length === 0 ? (
          <p className="pp-subtle">{t('admin.companyQueue.empty')}</p>
        ) : (
          <ul className="pp-adminCompanyList" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {list.map((c) => {
              const id = c.id;
              if (!id) return null;
              return (
                <li key={id} className="pp-card pp-pad" style={{ marginBottom: 12 }}>
                  <h2 className="pp-sectionTitle" style={{ marginTop: 0 }}>
                    {c.businessName}
                  </h2>
                  <p className="pp-subtle" style={{ marginTop: 4, marginBottom: 4 }}>
                    {t('admin.companyQueue.applicationId')}: <code style={{ fontSize: 12 }}>{id}</code>
                  </p>
                  {c.ownerUid ? (
                    <p className="pp-subtle" style={{ marginTop: 4, marginBottom: 4 }}>
                      {t('admin.companyQueue.ownerUid')}: <code style={{ fontSize: 12 }}>{c.ownerUid}</code>
                    </p>
                  ) : null}
                  {c.addressLine ? (
                    <p className="pp-subtle" style={{ marginTop: 4 }}>
                      {c.addressLine}
                    </p>
                  ) : null}
                  {c.publicEmail ? (
                    <p className="pp-subtle" style={{ marginTop: 4 }}>
                      {t('admin.companyQueue.email')}: {c.publicEmail}
                    </p>
                  ) : null}
                  {c.lat != null && c.lng != null ? (
                    <p style={{ marginTop: 8 }}>
                      <a
                        className="pp-link"
                        href={mapsLink(c.lat, c.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('admin.companyQueue.openPin')}
                      </a>
                    </p>
                  ) : null}
                  <div style={{ marginTop: 10 }}>
                    <div className="pp-label" style={{ fontSize: 12 }}>
                      {t('admin.companyQueue.noteLabel')}
                    </div>
                    <input
                      className="pp-input"
                      style={{ maxWidth: 480, marginTop: 4, fontSize: 14 }}
                      value={noteById[id] || ''}
                      onChange={(e) => setNoteById((m) => ({ ...m, [id]: e.target.value }))}
                      placeholder={t('admin.companyQueue.notePlaceholder')}
                    />
                  </div>
                  <div className="pp-row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="pp-btn pp-btnPrimary"
                      disabled={actionId === id}
                      onClick={() => approve(id)}
                    >
                      {actionId === id ? t('admin.busyShort') : t('admin.companyQueue.approve')}
                    </button>
                    <button type="button" className="pp-btn" disabled={actionId === id} onClick={() => reject(id)}>
                      {actionId === id ? t('admin.busyShort') : t('admin.companyQueue.reject')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="pp-col-12" style={{ marginTop: 24 }}>
        <h2 className="pp-h1" style={{ fontSize: 22 }}>
          {t('admin.shelterQueue.title')}
        </h2>
        {loading ? (
          <p className="pp-subtle">{t('admin.loading')}</p>
        ) : shelterList.length === 0 ? (
          <p className="pp-subtle">{t('admin.shelterQueue.empty')}</p>
        ) : (
          <ul className="pp-adminCompanyList" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {shelterList.map((s) => {
              const id = s.id;
              if (!id) return null;
              return (
                <li key={id} className="pp-card pp-pad" style={{ marginBottom: 12 }}>
                  <h3 className="pp-sectionTitle" style={{ marginTop: 0 }}>
                    {s.shelterName}
                  </h3>
                  <p className="pp-subtle">{s.city} · {s.contactPerson}</p>
                  <p className="pp-subtle">{s.publicEmail} · {s.phoneNumber}</p>
                  {s.description ? <p style={{ marginTop: 8 }}>{s.description}</p> : null}
                  <div className="pp-row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" className="pp-btn pp-btnPrimary" disabled={actionId === id} onClick={() => approveShelter(id)}>
                      {actionId === id ? t('admin.busyShort') : t('admin.shelterQueue.approve')}
                    </button>
                    <button type="button" className="pp-btn" disabled={actionId === id} onClick={() => rejectShelter(id)}>
                      {actionId === id ? t('admin.busyShort') : t('admin.shelterQueue.reject')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
