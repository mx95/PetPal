import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useI18n } from '../../i18n/I18nContext';
import {
  DEFAULT_NOTIFICATION_PREFS,
  saveNotificationPrefs,
  subscribeNotificationPrefs,
} from '../../notifications/notificationsFirestore';
import {
  disablePush,
  enablePush,
  getPushPermission,
  hasLocalPushToken,
  isIosNeedingInstall,
  isPushSupported,
} from '../../notifications/pushMessaging';

const CATEGORIES = ['zone', 'battery', 'sos', 'offline'];

export default function NotificationSettings() {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const uid = user?.uid || '';
  const [prefs, setPrefs] = useState({ ...DEFAULT_NOTIFICATION_PREFS });
  const [supported, setSupported] = useState(null);
  const [permission, setPermission] = useState(getPushPermission());
  const [pushOn, setPushOn] = useState(hasLocalPushToken());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void isPushSupported().then((ok) => {
      if (!cancelled) setSupported(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeNotificationPrefs(uid, setPrefs);
  }, [uid]);

  async function togglePush() {
    if (!uid || busy) return;
    setBusy(true);
    setError('');
    try {
      if (pushOn) {
        await disablePush(uid);
        setPushOn(false);
      } else {
        const result = await enablePush(uid, language);
        setPermission(getPushPermission());
        if (result.ok) setPushOn(true);
        else if (result.reason === 'denied') setError(t('alerts.settings.denied'));
        else if (result.reason === 'unsupported') setError(t('alerts.settings.unsupported'));
        else setError(t('alerts.settings.failed'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await saveNotificationPrefs(uid, { [key]: next[key] });
    } catch {
      setError(t('alerts.settings.saveFailed'));
    }
  }

  const needsInstall = supported === false && isIosNeedingInstall();
  const active = pushOn && permission === 'granted';

  return (
    <section className="pp-card pp-pad pp-notifySettings" aria-labelledby="pp-notify-settings-title">
      <h3 id="pp-notify-settings-title" className="pp-sectionTitle" style={{ marginTop: 0 }}>
        {t('alerts.settings.title')}
      </h3>
      <p className="pp-subtle">{t('alerts.settings.lead')}</p>

      <div className="pp-notifySettings__push">
        <div>
          <strong>{t('alerts.settings.pushTitle')}</strong>
          <p className="pp-subtle" style={{ margin: '2px 0 0' }}>
            {active ? t('alerts.settings.pushOn') : t('alerts.settings.pushOff')}
          </p>
        </div>
        {supported === false ? null : (
          <button
            type="button"
            className={`pp-btn ${active ? 'pp-btn--ghost' : 'pp-btnPrimary'}`}
            disabled={busy || supported === null || permission === 'denied'}
            onClick={() => void togglePush()}
          >
            {active ? t('alerts.settings.disable') : t('alerts.settings.enable')}
          </button>
        )}
      </div>
      {supported === false ? (
        <p className="pp-subtle" role="note">
          {needsInstall ? t('alerts.settings.iosInstall') : t('alerts.settings.unsupported')}
        </p>
      ) : null}
      {permission === 'denied' ? (
        <p className="pp-subtle" role="note">
          {t('alerts.settings.denied')}
        </p>
      ) : null}
      {error ? (
        <p className="pp-notifySettings__err" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="pp-notifySettings__list">
        {CATEGORIES.map((key) => (
          <li key={key}>
            <label className="pp-notifySettings__row">
              <input type="checkbox" checked={prefs[key] !== false} onChange={() => void toggleCategory(key)} />
              <span>
                <strong>{t(`alerts.settings.cat.${key}`)}</strong>
                <span className="pp-subtle"> — {t(`alerts.settings.catDesc.${key}`)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
