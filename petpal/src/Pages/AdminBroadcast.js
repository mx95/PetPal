import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCompany } from '../company/CompanyContext';
import { clearAllBroadcastMessages, createBroadcastMessage } from '../inbox/inboxFirestore';
import { clearBroadcastInboxRemote } from '../inbox/clearBroadcastInboxClient';
import { useI18n } from '../i18n/I18nContext';

export default function AdminBroadcast() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isAdmin, firebaseReady } = useCompany();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

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

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    setSending(true);
    try {
      await createBroadcastMessage({
        title,
        body,
        createdBy: user.uid,
        createdByEmail: user.email || null,
      });
      setTitle('');
      setBody('');
      setOk(t('admin.broadcast.sent'));
    } catch (ex) {
      setErr(ex?.message || t('admin.broadcast.errSend'));
    } finally {
      setSending(false);
    }
  }

  async function handleClearAll() {
    const okConfirm = window.confirm(t('admin.broadcast.clearConfirm'));
    if (!okConfirm) return;
    setErr('');
    setOk('');
    setClearing(true);
    try {
      let n = 0;
      try {
        const remote = await clearBroadcastInboxRemote();
        n = Number(remote?.deleted) || 0;
      } catch {
        n = await clearAllBroadcastMessages();
      }
      setOk(t('admin.broadcast.cleared', { count: n }));
    } catch (ex) {
      setErr(ex?.message || t('admin.broadcast.errClear'));
    } finally {
      setClearing(false);
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
              {t('admin.broadcast.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 640 }}>
              {t('admin.broadcast.sub')}
            </p>
          </div>
          <Link className="pp-link" to="/admin">
            {t('admin.backAdminTools')}
          </Link>
        </div>
      </div>

      <div className="pp-col-12 pp-col-md-8">
        <form className="pp-card pp-pad pp-inboxBroadcastForm" onSubmit={(e) => void handleSubmit(e)}>
          <label className="pp-field">
            <span className="pp-field__label">{t('admin.broadcast.subject')}</span>
            <input
              className="pp-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
              placeholder={t('admin.broadcast.subjectPlaceholder')}
            />
          </label>
          <label className="pp-field">
            <span className="pp-field__label">{t('admin.broadcast.message')}</span>
            <textarea
              className="pp-input"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              required
              placeholder={t('admin.broadcast.messagePlaceholder')}
            />
          </label>
          {err ? <p className="pp-error">{err}</p> : null}
          {ok ? <p className="pp-subtle" style={{ color: '#15803d', fontWeight: 700 }}>{ok}</p> : null}
          <div className="pp-row" style={{ gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="pp-btn pp-btnPrimary" disabled={sending || clearing}>
              {sending ? t('admin.broadcast.sending') : t('admin.broadcast.send')}
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--ghost"
              disabled={sending || clearing}
              onClick={() => void handleClearAll()}
            >
              {clearing ? t('admin.broadcast.clearing') : t('admin.broadcast.clearAll')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
