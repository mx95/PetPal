import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { useI18n } from '../i18n/I18nContext';
import { PrettySelect } from '../components/PrettySelect';
import { formatDateTime24 } from '../formatTime24';
import { adminUpdateContactMessage, subscribeContactMessages } from '../admin/contactMessagesFirestore';
import { contactMailtoHref } from '../contact/contactFormUtils';

const STATUSES = ['new', 'in_progress', 'done'];

function statusLabel(status, t) {
  if (status === 'in_progress') return t('admin.support.statusInProgress');
  if (status === 'done') return t('admin.support.statusDone');
  return t('admin.support.statusNew');
}

function statusStyle(status) {
  if (status === 'done') return { background: 'rgba(18, 183, 106, 0.12)', color: '#039855' };
  if (status === 'in_progress') return { background: 'rgba(46, 144, 250, 0.12)', color: '#1570ef' };
  return { background: 'rgba(245, 158, 11, 0.16)', color: '#b54708' };
}

export default function AdminSupport() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    if (!firebaseReady || !isAdmin) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return subscribeContactMessages(
      (list) => {
        setRows(list);
        setLoading(false);
      },
      (e) => {
        setErr(e?.message || t('admin.support.errLoad'));
        setLoading(false);
      }
    );
  }, [firebaseReady, isAdmin, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [row.name, row.email, row.subject, row.message, row.id, row.uid].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter]);

  async function setStatus(row, status) {
    setBusyId(row.id);
    setErr('');
    try {
      await adminUpdateContactMessage(row.id, { status });
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusyId('');
    }
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!firebaseReady) return <p className="pp-error">{t('admin.firebaseNotConfigured')}</p>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="pp-badge" style={{ background: 'rgba(180, 35, 24, 0.1)', color: '#b42318' }}>
              {t('admin.badge')}
            </div>
            <h1 className="pp-h1" style={{ marginTop: 10 }}>
              {t('admin.support.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 720 }}>
              {t('admin.support.sub')}
            </p>
          </div>
          <Link className="pp-link" to="/admin">
            {t('admin.backAdminTools')}
          </Link>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-adminBookings">
          <div className="pp-adminBookingsFilters">
            <input
              className="pp-input"
              placeholder={t('admin.support.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <PrettySelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('admin.support.filterAll')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s, t)}
                </option>
              ))}
            </PrettySelect>
          </div>

          {err ? <div className="pp-error">{err}</div> : null}
          {loading ? <div className="pp-muted">{t('admin.support.loading')}</div> : null}
          {!loading && filtered.length === 0 ? (
            <div className="pp-muted">
              {rows.length === 0 ? t('admin.support.empty') : t('admin.support.emptyFiltered')}
            </div>
          ) : null}

          {filtered.length ? (
            <div className="pp-adminBookingsTableWrap">
              <table className="pp-adminBookingsTable">
                <thead>
                  <tr>
                    <th>{t('admin.support.colWhen')}</th>
                    <th>{t('admin.support.colFrom')}</th>
                    <th>{t('admin.support.colSubject')}</th>
                    <th>{t('admin.support.colEmailStatus')}</th>
                    <th>{t('admin.support.colStatus')}</th>
                    <th className="pp-adminBookingsTable__actionsHead">
                      <span className="pp-srOnly">{t('admin.bookings.details')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const expanded = expandedId === row.id;
                    const when = row.createdAt ? formatDateTime24(row.createdAt, language) : '—';
                    const replyHref = contactMailtoHref(row, row.email);
                    return (
                      <React.Fragment key={row.id}>
                        <tr>
                          <td data-label={t('admin.support.colWhen')} className="pp-adminBookingsTable__when">
                            {when}
                          </td>
                          <td data-label={t('admin.support.colFrom')}>
                            <strong>{row.name || '—'}</strong>
                            <div className="pp-subtle">{row.email || '—'}</div>
                          </td>
                          <td data-label={t('admin.support.colSubject')}>{row.subject || '—'}</td>
                          <td data-label={t('admin.support.colEmailStatus')}>
                            {row.emailed ? t('admin.support.emailedYes') : t('admin.support.emailedNo')}
                          </td>
                          <td data-label={t('admin.support.colStatus')}>
                            <span className="pp-badge" style={statusStyle(row.status)}>
                              {statusLabel(row.status, t)}
                            </span>
                          </td>
                          <td className="pp-adminBookingsTable__actions">
                            <button
                              type="button"
                              className="pp-btn pp-btn--ghost"
                              onClick={() => setExpandedId(expanded ? '' : row.id)}
                            >
                              {expanded ? t('admin.bookings.hideDetails') : t('admin.bookings.details')}
                            </button>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="pp-adminBookingsTable__details">
                            <td colSpan={6}>
                              <p className="pp-adminSupportMessage">{row.message}</p>
                              <div className="pp-adminSupportActions">
                                {replyHref ? (
                                  <a className="pp-btn pp-btn--ghost" href={replyHref}>
                                    {t('admin.support.reply')}
                                  </a>
                                ) : null}
                                {STATUSES.map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    className="pp-btn pp-btn--ghost"
                                    disabled={busyId === row.id || row.status === s}
                                    onClick={() => void setStatus(row, s)}
                                  >
                                    {statusLabel(s, t)}
                                  </button>
                                ))}
                              </div>
                              {row.emailSkipReason && !row.emailed ? (
                                <p className="pp-subtle" style={{ marginTop: 8 }}>
                                  {t('admin.support.emailSkip')}: {row.emailSkipReason}
                                </p>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
