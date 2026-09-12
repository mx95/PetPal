import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { formatEur } from '../shop/catalog';
import {
  deleteDiscountCode,
  saveDiscountCode,
  setDiscountCodeActive,
  subscribeDiscountCodes,
} from '../shop/discountCodesFirestore';

const EMPTY_FORM = {
  code: '',
  type: 'percentage',
  amount: '',
  note: '',
  active: true,
};

function formatDiscountValue(row) {
  if (row.type === 'fixed') return formatEur(row.amount);
  return `${row.amount}%`;
}

export default function AdminDiscountCodes() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, adminReady, firebaseReady } = useCompany();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!firebaseReady || !adminReady || !isAdmin) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return subscribeDiscountCodes(
      (list) => {
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || t('adminDiscountCodes.errLoad'));
        setLoading(false);
      }
    );
  }, [firebaseReady, adminReady, isAdmin, t]);

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) return <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>;
  if (!adminReady) return <p className="pp-subtle">{t('admin.loading')}</p>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onCreate(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    setBusy('save');
    try {
      let amount = Number(form.amount);
      if (form.type === 'fixed') {
        amount = Math.round(Number(form.amount) * 100);
      }
      const code = await saveDiscountCode({
        code: form.code,
        type: form.type,
        amount,
        active: form.active,
        note: form.note,
        createdBy: user.uid,
      });
      setForm(EMPTY_FORM);
      setOk(t('adminDiscountCodes.saved', { code }));
    } catch (ex) {
      setErr(ex?.message || t('adminDiscountCodes.errSave'));
    } finally {
      setBusy('');
    }
  }

  async function onToggle(row) {
    setErr('');
    setOk('');
    setBusy(`toggle-${row.code}`);
    try {
      await setDiscountCodeActive(row.code, !row.active);
      setOk(
        row.active
          ? t('adminDiscountCodes.deactivated', { code: row.code })
          : t('adminDiscountCodes.activated', { code: row.code })
      );
    } catch (ex) {
      setErr(ex?.message || t('adminDiscountCodes.errSave'));
    } finally {
      setBusy('');
    }
  }

  async function onDelete(row) {
    if (!window.confirm(t('adminDiscountCodes.deleteConfirm', { code: row.code }))) return;
    setErr('');
    setOk('');
    setBusy(`delete-${row.code}`);
    try {
      await deleteDiscountCode(row.code);
      setOk(t('adminDiscountCodes.deleted', { code: row.code }));
    } catch (ex) {
      setErr(ex?.message || t('adminDiscountCodes.errDelete'));
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <Link className="pp-link" to="/admin">
          {t('admin.backAdminHub')}
        </Link>
        <h1 className="pp-h1" style={{ marginTop: 10 }}>
          {t('adminDiscountCodes.title')}
        </h1>
        <p className="pp-subtle" style={{ maxWidth: 640 }}>
          {t('adminDiscountCodes.intro')}
        </p>
      </div>

      <div className="pp-col-12">
        <form className="pp-card" onSubmit={(e) => void onCreate(e)} style={{ padding: 16, maxWidth: 640 }}>
          <h2 className="pp-h2" style={{ marginTop: 0 }}>
            {t('adminDiscountCodes.createTitle')}
          </h2>
          <label className="pp-field">
            <span className="pp-label">{t('adminDiscountCodes.code')}</span>
            <input
              type="text"
              value={form.code}
              disabled={Boolean(busy)}
              onChange={(e) => updateForm('code', e.target.value.toUpperCase())}
              placeholder={t('adminDiscountCodes.codePlaceholder')}
              autoComplete="off"
              required
            />
          </label>
          <div className="pp-row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <label className="pp-field" style={{ flex: '1 1 160px' }}>
              <span className="pp-label">{t('adminDiscountCodes.type')}</span>
              <select
                value={form.type}
                disabled={Boolean(busy)}
                onChange={(e) => updateForm('type', e.target.value)}
              >
                <option value="percentage">{t('adminDiscountCodes.typePercentage')}</option>
                <option value="fixed">{t('adminDiscountCodes.typeFixed')}</option>
              </select>
            </label>
            <label className="pp-field" style={{ flex: '1 1 160px' }}>
              <span className="pp-label">
                {form.type === 'fixed'
                  ? t('adminDiscountCodes.amountFixed')
                  : t('adminDiscountCodes.amountPercent')}
              </span>
              <input
                type="number"
                min={form.type === 'fixed' ? '0.01' : '1'}
                max={form.type === 'percentage' ? '100' : undefined}
                step={form.type === 'fixed' ? '0.01' : '1'}
                value={form.amount}
                disabled={Boolean(busy)}
                onChange={(e) => updateForm('amount', e.target.value)}
                required
              />
            </label>
          </div>
          <label className="pp-field">
            <span className="pp-label">{t('adminDiscountCodes.note')}</span>
            <input
              type="text"
              value={form.note}
              disabled={Boolean(busy)}
              onChange={(e) => updateForm('note', e.target.value)}
              placeholder={t('adminDiscountCodes.notePlaceholder')}
            />
          </label>
          <label className="pp-legalCheck" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={form.active}
              disabled={Boolean(busy)}
              onChange={(e) => updateForm('active', e.target.checked)}
            />
            <span>{t('adminDiscountCodes.activeOnCreate')}</span>
          </label>
          <button type="submit" className="pp-btn pp-btn--primary" disabled={busy === 'save'}>
            {busy === 'save' ? t('adminDiscountCodes.saving') : t('adminDiscountCodes.create')}
          </button>
        </form>
      </div>

      <div className="pp-col-12">
        {err ? <div className="pp-error">{err}</div> : null}
        {ok ? <div className="pp-ok">{ok}</div> : null}
        {loading ? <p className="pp-subtle">{t('adminDiscountCodes.loading')}</p> : null}
        {!loading && !rows.length ? (
          <p className="pp-subtle">{t('adminDiscountCodes.empty')}</p>
        ) : null}
        {!loading && rows.length ? (
          <div className="pp-card" style={{ padding: 0, overflow: 'auto' }}>
            <table className="pp-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t('adminDiscountCodes.colCode')}</th>
                  <th>{t('adminDiscountCodes.colType')}</th>
                  <th>{t('adminDiscountCodes.colValue')}</th>
                  <th>{t('adminDiscountCodes.colStatus')}</th>
                  <th>{t('adminDiscountCodes.colNote')}</th>
                  <th>{t('adminDiscountCodes.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.code}>
                    <td>
                      <code>{row.code}</code>
                    </td>
                    <td>
                      {row.type === 'fixed'
                        ? t('adminDiscountCodes.typeFixed')
                        : t('adminDiscountCodes.typePercentage')}
                    </td>
                    <td>{formatDiscountValue(row)}</td>
                    <td>
                      <span
                        className="pp-badge"
                        style={{
                          background: row.active ? 'rgba(18, 120, 70, 0.12)' : 'rgba(100,100,100,0.12)',
                          color: row.active ? '#127846' : '#555',
                        }}
                      >
                        {row.active
                          ? t('adminDiscountCodes.statusActive')
                          : t('adminDiscountCodes.statusInactive')}
                      </span>
                    </td>
                    <td>{row.note || '—'}</td>
                    <td>
                      <div className="pp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="pp-btn pp-btn--ghost"
                          disabled={Boolean(busy)}
                          onClick={() => void onToggle(row)}
                        >
                          {row.active
                            ? t('adminDiscountCodes.deactivate')
                            : t('adminDiscountCodes.activate')}
                        </button>
                        <button
                          type="button"
                          className="pp-btn pp-btn--ghost"
                          disabled={Boolean(busy)}
                          onClick={() => void onDelete(row)}
                        >
                          {t('adminDiscountCodes.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
