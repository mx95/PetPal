import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useInbox } from '../inbox/InboxContext';
import { markAllInboxMessagesRead, markInboxMessageRead } from '../inbox/inboxFirestore';
import {
  ensureBrowserNotificationPermission,
  loadBrowserNotifyEnabled,
  saveBrowserNotifyEnabled,
} from '../inbox/notificationPrefs';
import { NOTIFICATION_TYPE_ICONS } from '../inbox/notificationTypes';
import { markAllUserNotificationsRead, markUserNotificationRead } from '../inbox/userNotificationsFirestore';

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
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const { messages, unreadCount, loading } = useInbox();
  const [selectedKey, setSelectedKey] = useState(null);
  const [marking, setMarking] = useState(false);
  const [browserNotify, setBrowserNotify] = useState(() => loadBrowserNotifyEnabled());
  const [notifyBusy, setNotifyBusy] = useState(false);

  const selected = messages.find((m) => m.inboxKey === selectedKey) || messages[0] || null;

  async function openMessage(message) {
    setSelectedKey(message.inboxKey);
    if (!user?.uid || message.read) return;
    try {
      if (message.source === 'broadcast') {
        await markInboxMessageRead(user.uid, message.id);
      } else {
        await markUserNotificationRead(user.uid, message.id);
      }
    } catch (_) {}
  }

  async function markAllRead() {
    if (!user?.uid || !unreadCount) return;
    setMarking(true);
    try {
      const unreadBroadcastIds = messages.filter((m) => m.source === 'broadcast' && !m.read).map((m) => m.id);
      const unreadPersonalIds = messages.filter((m) => m.source === 'personal' && !m.read).map((m) => m.id);
      await Promise.all([
        unreadBroadcastIds.length ? markAllInboxMessagesRead(user.uid, unreadBroadcastIds) : Promise.resolve(),
        unreadPersonalIds.length ? markAllUserNotificationsRead(user.uid, unreadPersonalIds) : Promise.resolve(),
      ]);
    } finally {
      setMarking(false);
    }
  }

  async function toggleBrowserNotify() {
    if (notifyBusy) return;
    setNotifyBusy(true);
    try {
      if (!browserNotify) {
        const permission = await ensureBrowserNotificationPermission();
        if (permission !== 'granted') {
          saveBrowserNotifyEnabled(false);
          setBrowserNotify(false);
          return;
        }
        saveBrowserNotifyEnabled(true);
        setBrowserNotify(true);
        return;
      }
      saveBrowserNotifyEnabled(false);
      setBrowserNotify(false);
    } finally {
      setNotifyBusy(false);
    }
  }

  function typeLabel(type) {
    const key = `inbox.type.${type}`;
    const translated = t(key);
    return translated === key ? t('inbox.type.system') : translated;
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
        <div className="pp-card pp-pad pp-inboxNotifyPrefs">
          <label className="pp-inboxNotifyToggle">
            <input
              type="checkbox"
              checked={browserNotify}
              disabled={notifyBusy}
              onChange={() => void toggleBrowserNotify()}
            />
            <span>
              <strong>{t('inbox.browserNotifyTitle')}</strong>
              <span className="pp-subtle">{t('inbox.browserNotifyHint')}</span>
            </span>
          </label>
        </div>
      </div>

      <div className="pp-col-12">
        <div className="pp-inboxLayout">
          <aside className="pp-card pp-pad pp-inboxList" aria-label={t('inbox.listAria')}>
            {loading ? <p className="pp-subtle">{t('inbox.loading')}</p> : null}
            {!loading && !messages.length ? (
              <div className="pp-inboxEmpty">
                <span aria-hidden>📭</span>
                <p>{t('inbox.empty')}</p>
              </div>
            ) : null}
            <ul className="pp-inboxList__items">
              {messages.map((m) => {
                const unread = !m.read;
                const active = selected?.inboxKey === m.inboxKey;
                const icon = NOTIFICATION_TYPE_ICONS[m.type] || NOTIFICATION_TYPE_ICONS.system;
                return (
                  <li key={m.inboxKey}>
                    <button
                      type="button"
                      className={`pp-inboxListItem ${active ? 'is-active' : ''} ${unread ? 'is-unread' : ''}`}
                      onClick={() => void openMessage(m)}
                    >
                      <span className="pp-inboxListItem__iconWrap">
                        <span className="pp-inboxListItem__icon" aria-hidden>
                          {icon}
                        </span>
                        {unread ? <span className="pp-notifyBadge pp-notifyBadge--dot" aria-hidden /> : null}
                      </span>
                      <span className="pp-inboxListItem__copy">
                        <strong>{m.title}</strong>
                        <span className="pp-inboxListItem__meta">
                          <span className={`pp-inboxTypeBadge pp-inboxTypeBadge--${m.type}`}>{typeLabel(m.type)}</span>
                          {formatWhen(m.createdAt, language)}
                        </span>
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
                  <div className="pp-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`pp-inboxTypeBadge pp-inboxTypeBadge--${selected.type}`}>{typeLabel(selected.type)}</span>
                    {!selected.read ? <span className="pp-inboxUnreadPill">{t('inbox.unread')}</span> : null}
                  </div>
                  <h2 className="pp-sectionTitle" style={{ margin: '8px 0 0' }}>
                    {selected.title}
                  </h2>
                  <p className="pp-subtle" style={{ marginTop: 6, marginBottom: 0 }}>
                    {formatWhen(selected.createdAt, language)}
                    {selected.createdByEmail ? ` · ${selected.createdByEmail}` : ''}
                  </p>
                </header>
                <div className="pp-inboxDetail__body">{selected.body}</div>
                {selected.link ? (
                  <div className="pp-inboxDetail__actions">
                    <button
                      type="button"
                      className="pp-btn pp-btnPrimary"
                      onClick={() => {
                        if (selected.link.startsWith('http')) {
                          window.location.href = selected.link;
                        } else {
                          navigate(selected.link);
                        }
                      }}
                    >
                      {t('inbox.openLink')}
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
    </div>
  );
}
