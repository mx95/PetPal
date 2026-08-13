import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { formatDateTime24 } from '../formatTime24';
import { subscribeContactMessages } from './contactMessagesFirestore';

const HUB_LIMIT = 8;

export default function AdminRecentSupportPanel({ enabled }) {
  const { t, language } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!enabled) {
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
  }, [enabled, t]);

  const preview = rows.slice(0, HUB_LIMIT);
  const openCount = rows.filter((r) => r.status !== 'done').length;

  return (
    <section className="pp-adminHubSection" id="admin-support">
      <div className="pp-adminHubSection__head">
        <div>
          <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
            {t('admin.hub.supportTitle')}
          </h2>
          <p className="pp-subtle" style={{ marginTop: 6, maxWidth: 720 }}>
            {t('admin.hub.supportIntro')}
          </p>
        </div>
        <Link className="pp-link" to="/admin/support">
          {t('admin.hub.supportViewAll')}
        </Link>
      </div>

      {err ? <div className="pp-error" style={{ marginTop: 12 }}>{err}</div> : null}
      {loading ? <p className="pp-subtle">{t('admin.support.loading')}</p> : null}
      {!loading && !preview.length ? <p className="pp-subtle">{t('admin.support.empty')}</p> : null}
      {!loading && preview.length ? (
        <p className="pp-subtle" style={{ marginTop: 10 }}>
          {t('admin.hub.supportOpenCount', { n: openCount })}
        </p>
      ) : null}

      <ul className="pp-adminHubOrders">
        {preview.map((row) => (
          <li key={row.id} className="pp-card pp-adminHubOrder">
            <div>
              <strong>{row.subject || t('admin.support.noSubject')}</strong>
              <div className="pp-subtle">
                {row.createdAt ? formatDateTime24(row.createdAt, language) : '—'} · {row.name || row.email || '—'}
              </div>
            </div>
            <span className="pp-badge">
              {row.status === 'done'
                ? t('admin.support.statusDone')
                : row.status === 'in_progress'
                  ? t('admin.support.statusInProgress')
                  : t('admin.support.statusNew')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
