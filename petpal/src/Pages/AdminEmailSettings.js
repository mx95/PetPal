import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { fetchSupportEmailStatus, saveSupportSmtpConfig } from '../admin/supportEmailApi';

export default function AdminEmailSettings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, adminReady, firebaseReady } = useCompany();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState({
    user: 'sotiris9515@gmail.com',
    pass: '',
    host: 'smtp.gmail.com',
    port: '587',
    to: 'info@petpal.com.cy, sotiris9515@gmail.com',
    fromName: 'PetPal',
    sendTest: true,
  });

  useEffect(() => {
    if (!firebaseReady || !adminReady || !isAdmin) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    fetchSupportEmailStatus()
      .then((data) => {
        if (!alive) return;
        setStatus(data);
        setForm((prev) => ({
          ...prev,
          host: data.host || prev.host,
          port: String(data.port || prev.port),
          to: data.to || prev.to,
          user: data.user?.includes('…') ? prev.user : data.user || prev.user,
        }));
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || t('admin.email.errLoad'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
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

  async function onSave(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    setBusy(true);
    try {
      const res = await saveSupportSmtpConfig({
        user: form.user,
        pass: form.pass,
        host: form.host,
        port: Number(form.port) || 587,
        to: form.to,
        fromName: form.fromName,
        sendTest: Boolean(form.sendTest),
      });
      setOk(
        res?.testSent
          ? t('admin.email.savedAndTested', { to: res.to || form.to })
          : t('admin.email.saved')
      );
      const next = await fetchSupportEmailStatus();
      setStatus(next);
      setForm((prev) => ({ ...prev, pass: '' }));
    } catch (ex) {
      setErr(ex?.message || t('admin.email.errSave'));
    } finally {
      setBusy(false);
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
              {t('admin.email.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 720 }}>
              {t('admin.email.sub')}
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
            <p className="pp-subtle" style={{ marginTop: 0 }}>
              {status.configured
                ? t('admin.email.statusConfigured', { source: status.source, to: status.to })
                : t('admin.email.statusMissing')}
            </p>
          ) : null}

          <form className="pp-form" onSubmit={(e) => void onSave(e)}>
            <label className="pp-field">
              <span className="pp-field__label">{t('admin.email.smtpUser')}</span>
              <input
                className="pp-input"
                type="email"
                required
                value={form.user}
                onChange={(e) => setForm((p) => ({ ...p, user: e.target.value }))}
                placeholder="your@gmail.com"
                autoComplete="username"
              />
            </label>
            <label className="pp-field">
              <span className="pp-field__label">{t('admin.email.smtpPass')}</span>
              <input
                className="pp-input"
                type="password"
                required
                value={form.pass}
                onChange={(e) => setForm((p) => ({ ...p, pass: e.target.value }))}
                placeholder={t('admin.email.smtpPassPh')}
                autoComplete="new-password"
              />
            </label>
            <div className="pp-contactPage__grid">
              <label className="pp-field">
                <span className="pp-field__label">{t('admin.email.smtpHost')}</span>
                <input
                  className="pp-input"
                  value={form.host}
                  onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                />
              </label>
              <label className="pp-field">
                <span className="pp-field__label">{t('admin.email.smtpPort')}</span>
                <input
                  className="pp-input"
                  value={form.port}
                  onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))}
                />
              </label>
            </div>
            <label className="pp-field">
              <span className="pp-field__label">{t('admin.email.to')}</span>
              <input
                className="pp-input"
                value={form.to}
                onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))}
                placeholder="info@petpal.com.cy, you@gmail.com"
              />
            </label>
            <label className="pp-field pp-field--checkbox">
              <input
                type="checkbox"
                checked={form.sendTest}
                onChange={(e) => setForm((p) => ({ ...p, sendTest: e.target.checked }))}
              />
              <span>{t('admin.email.sendTest')}</span>
            </label>

            {err ? <p className="pp-error">{err}</p> : null}
            {ok ? <p className="pp-subtle" style={{ color: '#15803d', fontWeight: 700 }}>{ok}</p> : null}

            <p className="pp-subtle">{t('admin.email.gmailHint')}</p>

            <button type="submit" className="pp-btn pp-btnPrimary" disabled={busy}>
              {busy ? t('admin.saving') : t('admin.email.save')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
