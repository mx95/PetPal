import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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

/** iOS Safari Share (square with upward arrow). */
function IconIosShare({ label }) {
  return (
    <span className="pp-installIcon" title={label} aria-label={label} role="img">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <path
          d="M12 3v11"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M8 6.5 12 3l4 3.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 10.5H5.2A2.2 2.2 0 0 0 3 12.7v6.1A2.2 2.2 0 0 0 5.2 21h13.6a2.2 2.2 0 0 0 2.2-2.2v-6.1a2.2 2.2 0 0 0-2.2-2.2h-1.3"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** iOS “Add to Home Screen” (square with plus). */
function IconIosAddHome({ label }) {
  return (
    <span className="pp-installIcon" title={label} aria-label={label} role="img">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="3.5"
          stroke="currentColor"
          strokeWidth="2.1"
        />
        <path d="M12 8.2v7.6M8.2 12h7.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Android Chrome overflow menu (⋮). */
function IconAndroidMenu({ label }) {
  return (
    <span className="pp-installIcon pp-installIcon--menu" title={label} aria-label={label} role="img">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
        <circle cx="12" cy="5.5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="18.5" r="2" />
      </svg>
    </span>
  );
}

/** Android “Install app” / Add to Home screen (phone + plus). */
function IconAndroidInstall({ label }) {
  return (
    <span className="pp-installIcon" title={label} aria-label={label} role="img">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <rect
          x="7"
          y="2.5"
          width="10"
          height="19"
          rx="2.2"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M10.5 5.2h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="18.2" r="1" fill="currentColor" />
        <path
          d="M17.2 9.2v4.4M15 11.4h4.4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function InstallStep({ n, children }) {
  return (
    <li className="pp-installStep">
      <span className="pp-installStep__num" aria-hidden>
        {n}
      </span>
      <div className="pp-installStep__body">{children}</div>
    </li>
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

          <div className="pp-installPage__steps">
            <section
              className={`pp-installPage__card${platform === 'ios' ? ' pp-installPage__card--focus' : ''}`}
              aria-labelledby="install-ios-title"
            >
              <h2 id="install-ios-title" className="pp-h2">
                {t('installPage.iosTitle')}
              </h2>
              <ol className="pp-installPage__stepList">
                <InstallStep n={1}>
                  <span>{t('installPage.iosStep1')}</span>
                </InstallStep>
                <InstallStep n={2}>
                  <span>{t('installPage.iosStep2Before')}</span>
                  <IconIosShare label={t('installPage.iconShare')} />
                  <span>{t('installPage.iosStep2After')}</span>
                </InstallStep>
                <InstallStep n={3}>
                  <span>{t('installPage.iosStep3Before')}</span>
                  <IconIosAddHome label={t('installPage.iconAddHome')} />
                  <strong>{t('installPage.iosStep3Action')}</strong>
                </InstallStep>
                <InstallStep n={4}>
                  <span>{t('installPage.iosStep4')}</span>
                </InstallStep>
              </ol>
              <p className="pp-subtle pp-installPage__note">{t('installPage.iosNote')}</p>
            </section>

            <section
              className={`pp-installPage__card${platform === 'android' ? ' pp-installPage__card--focus' : ''}`}
              aria-labelledby="install-android-title"
            >
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
              <ol className="pp-installPage__stepList">
                <InstallStep n={1}>
                  <span>{t('installPage.androidStep1')}</span>
                </InstallStep>
                <InstallStep n={2}>
                  <span>{t('installPage.androidStep2Before')}</span>
                  <IconAndroidMenu label={t('installPage.iconMenu')} />
                  <span>{t('installPage.androidStep2After')}</span>
                </InstallStep>
                <InstallStep n={3}>
                  <span>{t('installPage.androidStep3Before')}</span>
                  <IconAndroidInstall label={t('installPage.iconInstall')} />
                  <strong>{t('installPage.androidStep3Action')}</strong>
                </InstallStep>
                <InstallStep n={4}>
                  <span>{t('installPage.androidStep4')}</span>
                </InstallStep>
              </ol>
              {installHint ? (
                <p className="pp-subtle" role="status">
                  {installHint}
                </p>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
