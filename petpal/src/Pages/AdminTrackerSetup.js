import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';

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
          <p className="pp-error">Firebase is not configured.</p>
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
      setErr('IMEI is required.');
      return;
    }
    if (!hostTrim) {
      setErr('Host is required (your public domain or IPv4).');
      return;
    }
    if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) {
      setErr('Port must be a number between 1 and 65535.');
      return;
    }

    const base = xexunBase();
    if (base == null) {
      setErr('Missing REACT_APP_XEXUN_HTTP_BASE_URL. Set it to your tracker HTTP API base (or "same").');
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
        throw new Error(code ? `Command API ${res.status} (${code})` : `Command API ${res.status}`);
      }
      setOk('Queued ip-transfer. The device will switch on its next uplink/check-in.');
      setImei('');
    } catch (e2) {
      setErr(e2?.message || 'Failed to queue ip-transfer.');
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
              Admin
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              Tracker setup (ip-transfer)
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 760 }}>
              This queues an <code>ip-transfer</code> command on your tracker backend so the collar will reconnect to your
              TCP ingest. Use your public hostname/IP and the TCP port you expose for the tracker (usually <code>5001</code>).
            </p>
            {baseHint != null ? (
              <p className="pp-subtle" style={{ marginTop: 6 }}>
                Command API base: <code>{baseHint === '' ? '(same origin)' : baseHint}</code>
              </p>
            ) : null}
          </div>
          <Link className="pp-link" to="/admin">
            ← Admin
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

          <div className="pp-label">IMEI</div>
          <input
            className="pp-input"
            value={imei}
            onChange={(e) => setImei(e.target.value)}
            placeholder="15-digit IMEI"
            style={{ marginTop: 6 }}
          />

          <div className="pp-label" style={{ marginTop: 12 }}>
            Host
          </div>
          <input
            className="pp-input"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="e.g. tracker.petpal.com.cy or 116.203.209.68"
            style={{ marginTop: 6 }}
          />

          <div className="pp-label" style={{ marginTop: 12 }}>
            TCP Port
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
              {busy ? '…' : 'Queue ip-transfer'}
            </button>
            <Link className="pp-link" to="/admin">
              Cancel
            </Link>
          </div>

          <p className="pp-subtle" style={{ marginTop: 10, marginBottom: 0 }}>
            Note: this UI does not “register” an IMEI in your DB. The IMEI appears automatically after the device connects
            and sends uplinks to your TCP server.
          </p>
        </form>
      </div>
    </div>
  );
}

