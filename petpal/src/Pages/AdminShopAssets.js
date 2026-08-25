import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { DEFAULT_NFC_TAG_DESIGNS, DEFAULT_TRACKER_SHOP_IMAGE } from '../data/nfcTagDesigns';
import {
  defaultShopAssetsDoc,
  saveShopAssets,
  subscribeShopAssets,
} from '../shop/shopAssetsFirestore';
import { uploadShopAssetImage } from '../shop/shopAssetsStorage';

function nextDesignId(rows) {
  const ids = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
  return ids.length ? Math.max(...ids) + 1 : 1;
}

export default function AdminShopAssets() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, adminReady, firebaseReady } = useCompany();
  const [remote, setRemote] = useState(null);
  const [nfcDesigns, setNfcDesigns] = useState(() => defaultShopAssetsDoc().nfcDesigns);
  const [trackerImage, setTrackerImage] = useState(DEFAULT_TRACKER_SHOP_IMAGE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (!firebaseReady || !adminReady || !isAdmin) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return subscribeShopAssets(
      (doc) => {
        setRemote(doc);
        const base = doc?.nfcDesigns?.length
          ? doc.nfcDesigns
          : defaultShopAssetsDoc().nfcDesigns;
        setNfcDesigns(base.map((d) => ({ ...d, enabled: d.enabled !== false })));
        setTrackerImage(doc?.trackerImage || DEFAULT_TRACKER_SHOP_IMAGE);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || t('adminShopAssets.errLoad'));
        setLoading(false);
      }
    );
  }, [firebaseReady, adminReady, isAdmin, t]);

  const dirty = useMemo(() => {
    const remoteDesigns = remote?.nfcDesigns?.length
      ? remote.nfcDesigns
      : defaultShopAssetsDoc().nfcDesigns;
    const remoteTracker = remote?.trackerImage || DEFAULT_TRACKER_SHOP_IMAGE;
    return (
      JSON.stringify(nfcDesigns) !== JSON.stringify(remoteDesigns) ||
      trackerImage !== remoteTracker
    );
  }, [remote, nfcDesigns, trackerImage]);

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) return <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>;
  if (!adminReady) return <p className="pp-subtle">{t('admin.loading')}</p>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  function updateDesign(id, patch) {
    setNfcDesigns((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  async function onUploadNfc(id, file) {
    if (!file) return;
    setBusy(`nfc-${id}`);
    setErr('');
    try {
      const url = await uploadShopAssetImage(file, 'nfc', id);
      updateDesign(id, { image: url });
      setOk(t('adminShopAssets.uploadOk'));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy('');
    }
  }

  async function onUploadTracker(file) {
    if (!file) return;
    setBusy('tracker');
    setErr('');
    try {
      const url = await uploadShopAssetImage(file, 'tracker');
      setTrackerImage(url);
      setOk(t('adminShopAssets.uploadOk'));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy('');
    }
  }

  function addDesign() {
    const id = nextDesignId(nfcDesigns);
    const fallback = DEFAULT_NFC_TAG_DESIGNS.find((d) => d.id === id);
    setNfcDesigns((prev) => [
      ...prev,
      {
        id,
        name: fallback?.name || `Design ${id}`,
        image: fallback?.image || '/images/nfc-tags/nfc-tag-01.png',
        enabled: true,
      },
    ]);
  }

  function removeDesign(id) {
    setNfcDesigns((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== id);
    });
  }

  async function onSave() {
    setBusy('save');
    setErr('');
    setOk('');
    try {
      await saveShopAssets({
        nfcDesigns: nfcDesigns.map((d) => ({
          id: Number(d.id),
          name: String(d.name || '').trim() || `Design ${d.id}`,
          image: String(d.image || '').trim(),
          enabled: d.enabled !== false,
        })),
        trackerImage,
      });
      setOk(t('adminShopAssets.saved'));
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy('');
    }
  }

  function resetDefaults() {
    setNfcDesigns(defaultShopAssetsDoc().nfcDesigns);
    setTrackerImage(DEFAULT_TRACKER_SHOP_IMAGE);
  }

  return (
    <div className="pp-pad pp-adminShopAssetsPage">
      <Link className="pp-link" to="/admin">
        ← {t('admin.backAdminHub')}
      </Link>

      <div className="pp-adminShopAssetsPage__toolbar">
        <div>
          <h1 className="pp-h1" style={{ marginTop: 10, marginBottom: 4 }}>
            {t('adminShopAssets.title')}
          </h1>
          <p className="pp-subtle" style={{ margin: 0 }}>
            {t('adminShopAssets.sub')}
          </p>
        </div>
        <div className="pp-adminShopAssetsPage__actions">
          <button
            type="button"
            className="pp-btn pp-btn--primary"
            disabled={Boolean(busy) || !dirty}
            onClick={() => void onSave()}
          >
            {busy === 'save' ? t('admin.saving') : t('admin.save')}
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" disabled={Boolean(busy)} onClick={resetDefaults}>
            {t('adminShopAssets.resetDefaults')}
          </button>
        </div>
      </div>

      {err ? <div className="pp-error" style={{ marginTop: 12 }}>{err}</div> : null}
      {ok ? <div className="pp-shopBanner" role="status">{ok}</div> : null}
      {loading ? <p className="pp-subtle">{t('adminShopAssets.loading')}</p> : null}

      <section className="pp-card pp-pad pp-adminShopAssets" style={{ marginTop: 16 }}>
        <h2 className="pp-sectionTitle">{t('adminShopAssets.trackerTitle')}</h2>
        <p className="pp-subtle">{t('adminShopAssets.trackerSub')}</p>
        <div className="pp-adminShopAssets__trackerRow">
          <div className="pp-adminShopAssets__previewFrame">
            <img src={trackerImage} alt="" className="pp-adminShopAssets__trackerPreview" />
          </div>
          <div className="pp-adminShopAssets__trackerMeta">
            <label className="pp-btn pp-btn--primary">
              {busy === 'tracker' ? t('adminShopAssets.uploading') : t('adminShopAssets.uploadImage')}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={Boolean(busy)}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void onUploadTracker(f);
                }}
              />
            </label>
            <p className="pp-subtle" style={{ margin: '8px 0 0', fontSize: 13 }}>
              {t('adminShopAssets.trackerHint')}
            </p>
          </div>
        </div>
      </section>

      <section className="pp-card pp-pad pp-adminShopAssets" style={{ marginTop: 16 }}>
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
            {t('adminShopAssets.nfcTitle')}
          </h2>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={addDesign}>
            {t('adminShopAssets.addDesign')}
          </button>
        </div>
        <p className="pp-subtle">{t('adminShopAssets.nfcSub')}</p>

        <ul className="pp-adminShopAssets__list">
          {nfcDesigns
            .slice()
            .sort((a, b) => Number(a.id) - Number(b.id))
            .map((row) => (
              <li
                key={row.id}
                className={`pp-adminShopAssets__row${row.enabled === false ? ' is-hidden' : ''}`}
              >
                <div className="pp-adminShopAssets__thumbWrap">
                  <img src={row.image} alt="" className="pp-adminShopAssets__thumb" />
                  <label className="pp-btn pp-btn--ghost pp-adminShopAssets__uploadOver">
                    {busy === `nfc-${row.id}` ? t('adminShopAssets.uploading') : t('adminShopAssets.uploadImage')}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={Boolean(busy)}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        void onUploadNfc(row.id, f);
                      }}
                    />
                  </label>
                </div>
                <div className="pp-adminShopAssets__fields">
                  <div className="pp-adminShopAssets__fieldRow">
                    <label className="pp-subtle">
                      ID
                      <input
                        type="number"
                        className="pp-input"
                        min={1}
                        value={row.id}
                        onChange={(e) =>
                          updateDesign(row.id, { id: Math.max(1, Number(e.target.value) || row.id) })
                        }
                      />
                    </label>
                    <label className="pp-subtle pp-adminShopAssets__grow">
                      {t('adminShopAssets.nameLabel')}
                      <input
                        type="text"
                        className="pp-input"
                        value={row.name}
                        onChange={(e) => updateDesign(row.id, { name: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="pp-subtle">
                    {t('adminShopAssets.urlLabel')}
                    <input
                      type="url"
                      className="pp-input"
                      value={row.image}
                      onChange={(e) => updateDesign(row.id, { image: e.target.value })}
                    />
                  </label>
                  <div className="pp-adminShopAssets__rowFooter">
                    <label className="pp-shopSaveRow">
                      <input
                        type="checkbox"
                        checked={row.enabled !== false}
                        onChange={(e) => updateDesign(row.id, { enabled: e.target.checked })}
                      />
                      <span>{t('adminShopAssets.enabledLabel')}</span>
                    </label>
                    <button
                      type="button"
                      className="pp-btn pp-btn--ghost pp-adminShopAssets__removeBtn"
                      disabled={Boolean(busy) || nfcDesigns.length <= 1}
                      title={nfcDesigns.length <= 1 ? t('adminShopAssets.cannotRemoveLast') : undefined}
                      onClick={() => removeDesign(row.id)}
                    >
                      {t('adminShopAssets.removeDesign')}
                    </button>
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
