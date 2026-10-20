import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useInbox } from '../inbox/InboxContext';
import { markAllInboxMessagesRead, markInboxMessageRead } from '../inbox/inboxFirestore';
import NotificationSettings from '../components/notifications/NotificationSettings';
import { ALERT_ICONS, alertText } from '../notifications/alertText';
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from '../notifications/notificationsFirestore';

function formatWhen(iso, lang) {
  if (!iso) return '—';
  try {
    const tag = lang === 'el' ? 'el' : lang === 'ru' ? 'ru' : 'en-GB';
    return new Date(iso).toLocaleString(tag, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return String(iso);
  }
}

export default function Inbox() {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { messages, readIds, alerts, unreadCount, loading } = useInbox();
  const [selectedKey, setSelectedKey] = useState(null);
  const [marking, setMarking] = useState(false);

  const items = useMemo(() => {
    const rows = [
      ...messages.map((m) => ({
        key: `b:${m.id}`,
        kind: 'broadcast',
        id: m.id,
        title: m.title,
        body: m.body,
        createdAt: m.createdAt,
        unread: !readIds.has(m.id),
        icon: '📬',
        createdByEmail: m.createdByEmail,
      })),
      ...alerts.map((a) => {
        const text = alertText(t, a);
        return {
          key: `a:${a.id}`,
          kind: 'alert',
          id: a.id,
          title: text.title,
          body: text.body,
          createdAt: a.createdAt,
          unread: !a.read,
          icon: ALERT_ICONS[a.type] || '🔔',
          lat: a.lat,
          lng: a.lng,
        };
      }),
    ];
    return rows.sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')));
  }, [messages, alerts, readIds, t]);

  const selected = items.find((m) => m.key === selectedKey) || items[0] || null;

  async function markItemRead(item) {
    if (!user?.uid || !item.unread) return;
    try {
      if (item.kind === 'alert') await markNotificationRead(user.uid, item.id);
      else await markInboxMessageRead(user.uid, item.id);
    } catch (_) {}
  }

  async function openItem(item) {
    setSelectedKey(item.key);
    await markItemRead(item);
  }

  async function markAllRead() {
    if (!user?.uid || !unreadCount) return;
    setMarking(true);
    try {
      await markAllInboxMessagesRead(
        user.uid,
        messages.filter((m) => !readIds.has(m.id)).map((m) => m.id)
      );
      await markAllNotificationsRead(
        user.uid,
        alerts.filter((a) => !a.read).map((a) => a.id)
      );
    } finally {
      setMarking(false);
    }
  }

  async function removeAlert(item) {
    if (!user?.uid) return;
    try {
      await deleteNotification(user.uid, item.id);
      setSelectedKey(null);
    } catch (_) {}
  }

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="pp-publicHero__eyebrow">{t('inbox.eyebrow')}</span>
            <h1 className="pp-h1" style={{ marginTop: 8 }}>
              {t('inbox.title')}
            </h1>
            <p className="pp-subtle" style={{ maxWidth: 560, marginBottom: 0 }}>
              {t('inbox.subtitle')}
            </p>
          </div>
          <div className="pp-row" style={{ gap: 8 }}>
            {unreadCount > 0 ? (
              <button type="button" className="pp-btn pp-btn--ghost" disabled={marking} onClick={() => void markAllRead()}>
                {marking ? t('inbox.markingRead') : t('inbox.markAllRead')}
              </button>
            ) : null}
            <Link className="pp-link" to="/dashboard">
              {t('common.backDashboard')}
            </Link>
          </div>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-inboxLayout">
          <aside className="pp-card pp-pad pp-inboxList" aria-label={t('inbox.listAria')}>
            {loading ? <p className="pp-subtle">{t('inbox.loading')}</p> : null}
            {!loading && !items.length ? (
              <div className="pp-inboxEmpty">
                <span aria-hidden>📭</span>
                <p>{t('inbox.empty')}</p>
              </div>
            ) : null}
            <ul className="pp-inboxList__items">
              {items.map((m) => {
                const active = selected?.key === m.key;
                return (
                  <li key={m.key}>
                    <button
                      type="button"
                      className={`pp-inboxListItem ${active ? 'is-active' : ''} ${m.unread ? 'is-unread' : ''}`}
                      onClick={() => void openItem(m)}
                    >
                      <span className="pp-inboxListItem__iconWrap">
                        <span className="pp-inboxListItem__icon" aria-hidden>
                          {m.icon}
                        </span>
                        {m.unread ? <span className="pp-notifyBadge pp-notifyBadge--dot" aria-hidden /> : null}
                      </span>
                      <span className="pp-inboxListItem__copy">
                        <strong>{m.title}</strong>
                        <span>{formatWhen(m.createdAt, language)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <article className="pp-card pp-pad pp-inboxDetail">
            {selected ? (
              <>
                <header className="pp-inboxDetail__head">
                  <h2 className="pp-sectionTitle" style={{ margin: 0 }}>
                    {selected.title}
                  </h2>
                  <p className="pp-subtle" style={{ marginTop: 6, marginBottom: 0 }}>
                    {formatWhen(selected.createdAt, language)}
                    {selected.createdByEmail ? ` · ${selected.createdByEmail}` : ''}
                  </p>
                </header>
                <div className="pp-inboxDetail__body">{selected.body}</div>
                {selected.kind === 'alert' ? (
                  <div className="pp-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <Link className="pp-btn pp-btnPrimary" to="/tracking" onClick={() => void markItemRead(selected)}>
                      {t('alerts.openMap')}
                    </Link>
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => void removeAlert(selected)}>
                      {t('alerts.delete')}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="pp-subtle">{loading ? t('inbox.loading') : t('inbox.selectMessage')}</p>
            )}
          </article>
        </div>
      </div>

      <div className="pp-col-12">
        <NotificationSettings />
      </div>
    </div>
  );
}
