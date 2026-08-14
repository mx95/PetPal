import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import {
  fetchSitePaymentModeStatus,
  saveSiteJccCredentials,
  setSitePaymentMode,
} from '../admin/sitePaymentModeApi';

const DEFAULT_REST = {
  test: 'https://gateway-test.jcc.com.cy/payment/rest',
  live: 'https://gateway.jcc.com.cy/payment/rest',
};

function emptyForm(mode) {
  return {
    user: '',
    pass: '',
    restBase: DEFAULT_REST[mode] || DEFAULT_REST.test,
  };
}

export default function AdminSiteMode() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, adminReady, firebaseReady } = useCompany();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyMode, setBusyMode] = useState(false);
  const [busySave, setBusySave] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [forms, setForms] = useState({
    test: emptyForm('test'),
    live: emptyForm('live'),
  });

  async function reload() {
    const data = await fetchSitePaymentModeStatus();
    setStatus(data);
    setForms((prev) => ({
      test: {
        user: '',
        pass: '',
        restBase: data?.test?.restBase || DEFAULT_REST.test,
      },
      live: {
        user: '',
        pass: '',
        restBase: data?.live?.restBase || DEFAULT_REST.live,
      },
    }));
    return data;
  }

  useEffect(() => {
    if (!firebaseReady || !adminReady || !isAdmin) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    reload()
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || t('admin.siteMode.errLoad'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when admin ready
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

  async function onSwitchMode(mode) {
    setErr('');
    setOk('');
    setBusyMode(true);
    try {
      await setSitePaymentMode(mode);
      await reload();
      setOk(mode === 'live' ? t('admin.siteMode.switchedLive') : t('admin.siteMode.switchedTest'));
    } catch (e) {
      setErr(e?.message || t('admin.siteMode.errSwitch'));
    } finally {
      setBusyMode(false);
    }
  }

  async function onSaveCredentials(mode, e) {
    e.preventDefault();
    setErr('');
    setOk('');
    setBusySave(mode);
    try {
      const form = forms[mode];
      await saveSiteJccCredentials({
        mode,
        user: form.user,
        pass: form.pass,
        restBase: form.restBase,
      });
      await reload();
      setOk(t('admin.siteMode.savedCreds', { mode: t(`admin.siteMode.mode.${mode}`) }));
    } catch (ex) {
      setErr(ex?.message || t('admin.siteMode.errSave'));
    } finally {
      setBusySave(null);
    }
  }

  const activeMode = status?.mode || 'test';

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge" style={{ background: 'rgba(180, 35, 24, 0.1)', color: '#b42318' }}>
              {t('admin.badge')}
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('admin.siteMode.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 720 }}>
              {t('admin.siteMode.sub')}
            </p>
          </div>
          <Link className="pp-link" to="/admin">
            {t('admin.backAdminTools')}
          </Link>
        </div>
      </div>

      <div className="pp-col-12 pp-col-md-8">
        <div className="pp-card pp-pad">
          {loading ? <p className="pp-subtle">{t('admin.loading')}</p> : null}

          {!loading && status ? (
            <>
              <p style={{ marginTop: 0, fontWeight: 700 }}>
                {t('admin.siteMode.activeLabel')}:{' '}
                <span
                  style={{
                    color: activeMode === 'live' ? '#15803d' : '#b45309',
                  }}
                >
                  {t(`admin.siteMode.mode.${activeMode}`)}
                </span>
              </p>
              <p className="pp-subtle">
                {t('admin.siteMode.activeHost', {
                  host: status.active?.restHost || '—',
                  user: status.active?.userMasked || t('admin.siteMode.notConfigured'),
                })}
              </p>

              <div className="pp-row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                <button
                  type="button"
                  className={`pp-btn ${activeMode === 'test' ? 'pp-btn--primary' : ''}`}
                  disabled={busyMode || activeMode === 'test'}
                  onClick={() => void onSwitchMode('test')}
                >
                  {busyMode && activeMode !== 'test'
                    ? t('admin.siteMode.switching')
                    : t('admin.siteMode.useTest')}
                </button>
                <button
                  type="button"
                  className={`pp-btn ${activeMode === 'live' ? 'pp-btn--primary' : ''}`}
                  disabled={busyMode || activeMode === 'live'}
                  onClick={() => void onSwitchMode('live')}
                >
                  {busyMode && activeMode !== 'live'
                    ? t('admin.siteMode.switching')
                    : t('admin.siteMode.useLive')}
                </button>
              </div>
              <p className="pp-subtle" style={{ marginTop: 12 }}>
                {t('admin.siteMode.liveWarning')}
              </p>
            </>
          ) : null}

          {err ? <p className="pp-error">{err}</p> : null}
          {ok ? (
            <p className="pp-subtle" style={{ color: '#15803d', fontWeight: 700 }}>
              {ok}
            </p>
          ) : null}
        </div>
      </div>

      {['test', 'live'].map((mode) => (
        <div className="pp-col-12 pp-col-md-8" key={mode}>
          <div className="pp-card pp-pad">
            <h2 className="pp-h2" style={{ marginTop: 0 }}>
              {t('admin.siteMode.credsTitle', { mode: t(`admin.siteMode.mode.${mode}`) })}
            </h2>
            <p className="pp-subtle">
              {status?.[mode]?.configured
                ? t('admin.siteMode.credsConfigured', {
                    user: status[mode].userMasked,
                    host: status[mode].restHost,
                  })
                : t('admin.siteMode.credsMissing')}
            </p>
            <form className="pp-form" onSubmit={(e) => void onSaveCredentials(mode, e)}>
              <label className="pp-field">
                <span className="pp-field__label">{t('admin.siteMode.apiUser')}</span>
                <input
                  className="pp-input"
                  value={forms[mode].user}
                  onChange={(e) =>
                    setForms((p) => ({ ...p, [mode]: { ...p[mode], user: e.target.value } }))
                  }
                  placeholder={
                    status?.[mode]?.configured
                      ? t('admin.siteMode.apiUserKeep', { user: status[mode].userMasked })
                      : 'PetPal-api'
                  }
                  autoComplete="username"
                  required={!status?.[mode]?.configured}
                />
              </label>
              <label className="pp-field">
                <span className="pp-field__label">{t('admin.siteMode.apiPass')}</span>
                <input
                  className="pp-input"
                  type="password"
                  value={forms[mode].pass}
                  onChange={(e) =>
                    setForms((p) => ({ ...p, [mode]: { ...p[mode], pass: e.target.value } }))
                  }
                  placeholder={
                    status?.[mode]?.configured
                      ? t('admin.siteMode.apiPassKeep')
                      : t('admin.siteMode.apiPassPh')
                  }
                  autoComplete="new-password"
                  required={!status?.[mode]?.configured}
                />
              </label>
              <label className="pp-field">
                <span className="pp-field__label">{t('admin.siteMode.restBase')}</span>
                <input
                  className="pp-input"
                  value={forms[mode].restBase}
                  onChange={(e) =>
                    setForms((p) => ({ ...p, [mode]: { ...p[mode], restBase: e.target.value } }))
                  }
                  placeholder={DEFAULT_REST[mode]}
                />
              </label>
              <button type="submit" className="pp-btn pp-btnPrimary" disabled={busySave === mode}>
                {busySave === mode ? t('admin.saving') : t('admin.siteMode.saveCreds')}
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
