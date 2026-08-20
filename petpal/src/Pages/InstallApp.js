import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export default function InstallApp() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [platform, setPlatform] = useState('other');
  const [standalone, setStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installBusy, setInstallBusy] = useState(false);
  const [installHint, setInstallHint] = useState('');

  const installUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://petpal.com.cy/install';
    return `${window.location.origin}/install`;
  }, []);

  const qrSrc = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(installUrl)}`,
    [installUrl]
  );

  useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandaloneDisplay());
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function handleAndroidInstall() {
    if (!deferredPrompt) {
      setInstallHint(t('installPage.androidManualHint'));
      return;
    }
    setInstallBusy(true);
    setInstallHint('');
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } catch {
      setInstallHint(t('installPage.androidManualHint'));
    } finally {
      setInstallBusy(false);
    }
  }

  const back = user
    ? { to: '/', label: t('legal.backHome') }
    : { to: '/login', label: t('legal.backLogin') };

  return (
    <div className="pp-grid">
      <div className="pp-col-12">
        <div className="pp-card pp-pad pp-installPage">
          <Link className="pp-link pp-legalBack" to={back.to}>
            {back.label}
          </Link>
          <h1 className="pp-h1 pp-legalTitle">{t('installPage.title')}</h1>
          <p className="pp-subtle">{t('installPage.lead')}</p>

          {standalone ? (
            <p className="pp-installPage__banner" role="status">
              {t('installPage.alreadyInstalled')}
            </p>
          ) : null}

          <div className="pp-installPage__layout">
            <section className="pp-installPage__qrBlock" aria-labelledby="install-qr-title">
              <h2 id="install-qr-title" className="pp-h2">
                {t('installPage.qrTitle')}
              </h2>
              <p className="pp-subtle">{t('installPage.qrSub')}</p>
              <img
                className="pp-installPage__qr"
                src={qrSrc}
                width={240}
                height={240}
                alt={t('installPage.qrAlt')}
              />
              <p className="pp-installPage__url">
                <a href={installUrl}>{installUrl.replace(/^https?:\/\//, '')}</a>
              </p>
            </section>

            <div className="pp-installPage__steps">
              {(platform === 'ios' || platform === 'other') && (
                <section className="pp-installPage__card" aria-labelledby="install-ios-title">
                  <h2 id="install-ios-title" className="pp-h2">
                    {t('installPage.iosTitle')}
                  </h2>
                  <ol className="pp-installPage__list">
                    <li>{t('installPage.iosStep1')}</li>
                    <li>{t('installPage.iosStep2')}</li>
                    <li>{t('installPage.iosStep3')}</li>
                    <li>{t('installPage.iosStep4')}</li>
                  </ol>
                  <p className="pp-subtle">{t('installPage.iosNote')}</p>
                </section>
              )}

              {(platform === 'android' || platform === 'other') && (
                <section className="pp-installPage__card" aria-labelledby="install-android-title">
                  <h2 id="install-android-title" className="pp-h2">
                    {t('installPage.androidTitle')}
                  </h2>
                  {deferredPrompt ? (
                    <button
                      type="button"
                      className="pp-btn pp-btnPrimary"
                      disabled={installBusy}
                      onClick={handleAndroidInstall}
                    >
                      {installBusy ? t('installPage.installing') : t('installPage.androidInstallBtn')}
                    </button>
                  ) : null}
                  <ol className="pp-installPage__list">
                    <li>{t('installPage.androidStep1')}</li>
                    <li>{t('installPage.androidStep2')}</li>
                    <li>{t('installPage.androidStep3')}</li>
                  </ol>
                  {installHint ? (
                    <p className="pp-subtle" role="status">
                      {installHint}
                    </p>
                  ) : null}
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
