import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useInbox } from '../inbox/InboxContext';
import { markAllInboxMessagesRead, markInboxMessageRead } from '../inbox/inboxFirestore';

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
  const { messages, readIds, unreadCount, loading } = useInbox();
  const [selectedId, setSelectedId] = useState(null);
  const [marking, setMarking] = useState(false);

  const selected = messages.find((m) => m.id === selectedId) || messages[0] || null;

  async function openMessage(message) {
    setSelectedId(message.id);
    if (!user?.uid || readIds.has(message.id)) return;
    try {
      await markInboxMessageRead(user.uid, message.id);
    } catch (_) {}
  }

  async function markAllRead() {
    if (!user?.uid || !unreadCount) return;
    setMarking(true);
    try {
      const unreadIds = messages.filter((m) => !readIds.has(m.id)).map((m) => m.id);
      await markAllInboxMessagesRead(user.uid, unreadIds);
    } finally {
      setMarking(false);
    }
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
            {!loading && !messages.length ? (
              <div className="pp-inboxEmpty">
                <span aria-hidden>📭</span>
                <p>{t('inbox.empty')}</p>
              </div>
            ) : null}
            <ul className="pp-inboxList__items">
              {messages.map((m) => {
                const unread = !readIds.has(m.id);
                const active = selected?.id === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`pp-inboxListItem ${active ? 'is-active' : ''} ${unread ? 'is-unread' : ''}`}
                      onClick={() => void openMessage(m)}
                    >
                      <span className="pp-inboxListItem__iconWrap">
                        <span className="pp-inboxListItem__icon" aria-hidden>
                          📬
                        </span>
                        {unread ? <span className="pp-notifyBadge pp-notifyBadge--dot" aria-hidden /> : null}
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
