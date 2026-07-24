import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';

function xexunBase() {
  const raw = process.env.REACT_APP_XEXUN_HTTP_BASE_URL;
  if (raw == null || raw === '') return null;
  if (raw === 'same') return '';
  return String(raw).replace(/\/$/, '');
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function AdminTrackerSetup() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();

  const [imei, setImei] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5001');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const baseHint = useMemo(() => xexunBase(), []);

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

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setOk('');

    const imeiTrim = String(imei || '').trim();
    const hostTrim = String(host || '').trim();
    const portNum = Number(String(port || '').trim());

    if (!imeiTrim) {
      setErr(t('admin.trackerSetup.errImeiRequired'));
      return;
    }
    if (!hostTrim) {
      setErr(t('admin.trackerSetup.errHostRequired'));
      return;
    }
    if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) {
      setErr(t('admin.trackerSetup.errPortInvalid'));
      return;
    }

    const base = xexunBase();
    if (base == null) {
      setErr(t('admin.trackerSetup.errMissingBase'));
      return;
    }

    const path = '/api/tracker/commands/ip-transfer';
    const url = base === '' ? path : `${base}${path}`;

    setBusy(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ imei: imeiTrim, host: hostTrim, port: portNum }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        const code = data?.error ? String(data.error) : '';
        throw new Error(
          code
            ? t('admin.trackerSetup.commandApiErrorWithCode', { status: res.status, code })
            : t('admin.trackerSetup.commandApiError', { status: res.status })
        );
      }
      setOk(t('admin.trackerSetup.queued'));
      setImei('');
    } catch (e2) {
      setErr(e2?.message || t('admin.trackerSetup.errQueue'));
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
              {t('admin.trackerSetup.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 760 }}>
              {t('admin.trackerSetup.subPrefix')} <code>ip-transfer</code>{' '}
              {t('admin.trackerSetup.subMiddle')} <code>5001</code>{t('admin.trackerSetup.subSuffix')}
            </p>
            {baseHint != null ? (
              <p className="pp-subtle" style={{ marginTop: 6 }}>
                {t('admin.trackerSetup.commandApiBase')}: <code>{baseHint === '' ? t('admin.trackerSetup.sameOrigin') : baseHint}</code>
              </p>
            ) : null}
          </div>
          <Link className="pp-link" to="/admin">
            {t('admin.backAdmin')}
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <form className="pp-card pp-pad" onSubmit={submit} style={{ maxWidth: 720 }}>
          {err ? (
            <p className="pp-error" style={{ marginTop: 0 }}>
              {err}
            </p>
          ) : null}
          {ok ? (
            <p className="pp-subtle" style={{ marginTop: 0, color: '#0f766e' }}>
              {ok}
            </p>
          ) : null}

          <div className="pp-label">{t('admin.trackerSetup.imeiLabel')}</div>
          <input
            className="pp-input"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder={t('admin.trackerSetup.imeiPlaceholder')}
            style={{ marginTop: 6 }}
          />

          <div className="pp-label" style={{ marginTop: 12 }}>
            {t('admin.trackerSetup.hostLabel')}
          </div>
          <input
            className="pp-input"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder={t('admin.trackerSetup.hostPlaceholder')}
            style={{ marginTop: 6 }}
          />

          <div className="pp-label" style={{ marginTop: 12 }}>
            {t('admin.trackerSetup.portLabel')}
          </div>
          <input
            className="pp-input"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="5001"
            style={{ marginTop: 6, maxWidth: 160 }}
          />

          <div className="pp-row" style={{ marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="pp-btn pp-btnPrimary" disabled={busy}>
              {busy ? t('admin.busyShort') : t('admin.trackerSetup.queue')}
            </button>
            <Link className="pp-link" to="/admin">
              {t('admin.cancel')}
            </Link>
          </div>

          <p className="pp-subtle" style={{ marginTop: 10, marginBottom: 0 }}>
            {t('admin.trackerSetup.note')}
          </p>
        </form>
      </div>
    </div>
  );
}

