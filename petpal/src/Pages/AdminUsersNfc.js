import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { getFirebaseApp } from '../firebase';
import AdminCopyButton from '../admin/AdminCopyButton';
import { fetchAdminUsersDirectory, filterAdminDirectory, publicPetAbsoluteUrl, publicPetPath } from '../admin/adminDirectory';

const REGION = 'europe-west1';

function functionsClient() {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  const functions = getFunctions(app, REGION);
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_FUNCTIONS_EMULATOR === '1') {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
  return functions;
}

export default function AdminUsersNfc() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, adminReady, firebaseReady } = useCompany();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [search, setSearch] = useState('');
  const [busyUid, setBusyUid] = useState('');

  const reload = () => {
    setLoading(true);
    setErr('');
    return fetchAdminUsersDirectory()
      .then((list) => setRows(list))
      .catch((e) => {
        setErr(e?.message || t('admin.hub.usersNfcErr'));
        setRows([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!firebaseReady || !adminReady || !isAdmin) {
      setLoading(false);
      return undefined;
    }
    void reload();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady, adminReady, isAdmin, t]);

  const filtered = useMemo(() => filterAdminDirectory(rows, search), [rows, search]);
  const totals = useMemo(() => {
    const accounts = rows.length;
    const pets = rows.reduce((n, row) => n + (Array.isArray(row.pets) ? row.pets.length : 0), 0);
    const business = rows.filter((row) => row.accountType === 'company').length;
    const shelter = rows.filter((row) => row.accountType === 'shelter').length;
    return { accounts, pets, business, shelter };
  }, [rows]);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  async function onDeleteUser(uid, label, email) {
    const confirmMsg = t('adminUsersNfc.confirmDelete', { name: label || email || uid });
    if (!window.confirm(confirmMsg)) return;
    setBusyUid(uid);
    setErr('');
    setOk('');
    try {
      const fn = httpsCallable(functionsClient(), 'adminDeleteUser');
      const result = await fn({ uid });
      const deletedUid = result?.data?.uid || uid;
      const deletedEmail = String(result?.data?.email || email || '').trim();
      setOk(
        deletedEmail
          ? t('adminUsersNfc.deleteOkWithEmail', { email: deletedEmail, uid: deletedUid })
          : t('adminUsersNfc.deleteOk', { uid: deletedUid })
      );
      await reload();
    } catch (e) {
      setErr(e?.message || t('adminUsersNfc.deleteFailed'));
    } finally {
      setBusyUid('');
    }
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) return <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>;
  if (!adminReady) return <p className="pp-subtle">{t('admin.loading')}</p>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  function accountTypeLabel(row) {
    const type = String(row.accountType || 'individual').toLowerCase();
    const key = `adminUsersNfc.accountType.${type}`;
    const translated = t(key);
    return translated === key ? t('adminUsersNfc.accountType.individual') : translated;
  }

  function accountTypeClass(row) {
    const type = String(row.accountType || 'individual').toLowerCase();
    if (type === 'company') return 'pp-adminAccountType--company';
    if (type === 'shelter') return 'pp-adminAccountType--shelter';
    return 'pp-adminAccountType--individual';
  }

  function profileStatusLabel(row) {
    if (!row.profileStatus) return '';
    const kind = row.profileKind === 'shelter' ? 'shelter' : 'company';
    const key = `adminUsersNfc.profileStatus.${kind}.${row.profileStatus}`;
    const translated = t(key);
    return translated === key ? row.profileStatus : translated;
  }

  return (
    <div className="pp-pad">
      <Link className="pp-link" to="/admin">
        ← {t('admin.backAdminHub')}
      </Link>
      <h1 className="pp-h1" style={{ marginTop: 10 }}>
        {t('adminUsersNfc.title')}
      </h1>
      <p className="pp-subtle" style={{ maxWidth: 720 }}>
        {t('adminUsersNfc.intro')}
      </p>

      {!loading ? (
        <div className="pp-adminUsersNfc__totals" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <span className="pp-badge">{t('admin.hub.userCount', { n: totals.accounts })}</span>
          <span className="pp-badge">{t('admin.hub.petCount', { n: totals.pets })}</span>
          <span className="pp-badge">{t('adminUsersNfc.businessCount', { n: totals.business })}</span>
          <span className="pp-badge">{t('adminUsersNfc.shelterCount', { n: totals.shelter })}</span>
        </div>
      ) : null}

      <input
        type="search"
        className="pp-input"
        style={{ marginTop: 14, maxWidth: 480 }}
        placeholder={t('admin.hub.usersNfcSearch')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {err ? <div className="pp-error" style={{ marginTop: 12 }}>{err}</div> : null}
      {ok ? <div className="pp-shopBanner" role="status" style={{ marginTop: 12 }}>{ok}</div> : null}
      {loading ? <p className="pp-subtle">{t('admin.hub.usersNfcLoading')}</p> : null}
      {!loading && !filtered.length ? (
        <p className="pp-subtle">{search.trim() ? t('admin.hub.usersNfcEmptyFiltered') : t('admin.hub.usersNfcEmpty')}</p>
      ) : null}

      <ul className="pp-adminUserList">
        {filtered.map((row) => (
          <li key={row.uid} className="pp-card pp-adminUserCard">
            <div className="pp-adminUserCard__head">
              <div>
                <div className="pp-adminUserCard__titleRow">
                  <strong>{row.name || row.email || t('admin.hub.unnamedUser')}</strong>
                  <span className={`pp-adminAccountType ${accountTypeClass(row)}`}>{accountTypeLabel(row)}</span>
                </div>
                {row.profileName ? (
                  <div className="pp-adminUserCard__profileLine">
                    <span className="pp-subtle">
                      {row.profileKind === 'shelter' ? t('adminUsersNfc.shelterProfile') : t('adminUsersNfc.businessProfile')}
                      {': '}
                      <strong>{row.profileName}</strong>
                    </span>
                    {row.profileStatus ? (
                      <span className={`pp-adminProfileStatus pp-adminProfileStatus--${row.profileStatus}`}>
                        {profileStatusLabel(row)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="pp-subtle">
                  {row.email || '—'}
                  {row.phone ? ` · ${row.phone}` : ''}
                </div>
                <div className="pp-adminUserCard__uid">
                  {t('admin.hub.userUid')}: <code>{row.uid}</code>
                  <AdminCopyButton value={row.uid} label={t('admin.hub.copyUid')} />
                </div>
              </div>
              <div className="pp-adminUserCard__headActions">
                <span className="pp-badge">{t('admin.hub.petCount', { n: row.pets.length })}</span>
                <button
                  type="button"
                  className="pp-btn pp-btn--ghost pp-adminShopAssets__removeBtn"
                  disabled={Boolean(busyUid) || row.uid === user.uid}
                  onClick={() => void onDeleteUser(row.uid, row.name || row.email, row.email)}
                >
                  {busyUid === row.uid ? t('adminUsersNfc.deleting') : t('adminUsersNfc.deleteUser')}
                </button>
              </div>
            </div>

            {row.pets.length ? (
              <ul className="pp-adminPetNfcList">
                {row.pets.map((pet) => {
                  const path = publicPetPath(pet.publicId);
                  const url = publicPetAbsoluteUrl(pet.publicId, origin);
                  return (
                    <li key={`${row.uid}:${pet.id}`} className="pp-adminPetNfc">
                      <div className="pp-adminPetNfc__name">
                        <strong>{pet.name}</strong>
                        {pet.breed ? <span className="pp-subtle"> · {pet.breed}</span> : null}
                        {pet.nfcTag ? <span className="pp-adminPetNfc__chip">{t('admin.hub.nfcYes')}</span> : null}
                        {pet.imei ? (
                          <span className="pp-subtle">
                            {' '}
                            · {t('admin.hub.imei')}: <code>{pet.imei}</code>
                          </span>
                        ) : null}
                      </div>
                      {pet.publicId ? (
                        <div className="pp-adminPetNfc__id">
                          <div>
                            <span className="pp-adminPetNfc__label">{t('admin.hub.publicId')}</span>
                            <code className="pp-adminPetNfc__code">{pet.publicId}</code>
                          </div>
                          <div className="pp-adminPetNfc__actions">
                            <AdminCopyButton value={pet.publicId} label={t('admin.hub.copyId')} />
                            <AdminCopyButton value={url} label={t('admin.hub.copyUrl')} />
                            <Link className="pp-link" to={path} target="_blank" rel="noreferrer">
                              {t('admin.hub.openProfile')}
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <p className="pp-subtle">{t('admin.hub.missingPublicId')}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="pp-subtle">{t('admin.hub.noPets')}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
