import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import AdminCopyButton from './AdminCopyButton';
import { fetchAdminUsersDirectory, filterAdminDirectory, publicPetAbsoluteUrl, publicPetPath } from './adminDirectory';

export default function AdminUsersNfcPanel({ enabled }) {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setErr('');
    fetchAdminUsersDirectory()
      .then((list) => {
        if (!alive) return;
        setRows(list);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || t('admin.hub.usersNfcErr'));
        setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [enabled, t]);

  const filtered = useMemo(() => filterAdminDirectory(rows, search), [rows, search]);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <section className="pp-adminHubSection" id="admin-nfc">
      <div className="pp-adminHubSection__head">
        <div>
          <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
            {t('admin.hub.usersNfcTitle')}
          </h2>
          <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 720 }}>
            {t('admin.hub.usersNfcIntro')}
          </p>
        </div>
        <span className="pp-badge">{t('admin.hub.userCount', { n: filtered.length })}</span>
      </div>

      <input
        type="search"
        className="pp-input"
        style={{ marginTop: 14, maxWidth: 480 }}
        placeholder={t('admin.hub.usersNfcSearch')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {err ? <div className="pp-error" style={{ marginTop: 12 }}>{err}</div> : null}
      {loading ? <p className="pp-subtle">{t('admin.hub.usersNfcLoading')}</p> : null}
      {!loading && !filtered.length ? (
        <p className="pp-subtle">{search.trim() ? t('admin.hub.usersNfcEmptyFiltered') : t('admin.hub.usersNfcEmpty')}</p>
      ) : null}

      <ul className="pp-adminUserList">
        {filtered.map((user) => (
          <li key={user.uid} className="pp-card pp-adminUserCard">
            <div className="pp-adminUserCard__head">
              <div>
                <strong>{user.name || user.email || t('admin.hub.unnamedUser')}</strong>
                <div className="pp-subtle">
                  {user.email || '—'}
                  {user.phone ? ` · ${user.phone}` : ''}
                </div>
                <div className="pp-adminUserCard__uid">
                  {t('admin.hub.userUid')}: <code>{user.uid}</code>
                  <AdminCopyButton value={user.uid} label={t('admin.hub.copyUid')} />
                </div>
              </div>
              <span className="pp-badge">{t('admin.hub.petCount', { n: user.pets.length })}</span>
            </div>

            {user.pets.length ? (
              <ul className="pp-adminPetNfcList">
                {user.pets.map((pet) => {
                  const path = publicPetPath(pet.publicId);
                  const url = publicPetAbsoluteUrl(pet.publicId, origin);
                  return (
                    <li key={`${user.uid}:${pet.id}`} className="pp-adminPetNfc">
                      <div className="pp-adminPetNfc__name">
                        <strong>{pet.name}</strong>
                        {pet.breed ? <span className="pp-subtle"> · {pet.breed}</span> : null}
                        {pet.nfcTag ? <span className="pp-adminPetNfc__chip">{t('admin.hub.nfcYes')}</span> : null}
                        {pet.imei ? (
                          <span className="pp-subtle"> · {t('admin.hub.imei')}: <code>{pet.imei}</code></span>
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
                          <div className="pp-subtle pp-adminPetNfc__url">{url}</div>
                        </div>
                      ) : (
                        <p className="pp-subtle" style={{ margin: '6px 0 0' }}>
                          {t('admin.hub.missingPublicId')}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="pp-subtle" style={{ margin: '8px 0 0' }}>
                {t('admin.hub.noPets')}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
