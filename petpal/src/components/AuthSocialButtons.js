import React from 'react';
import { useI18n } from '../i18n/I18nContext';

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l.1.1 6.3 5.2C39.1 36.5 44 32 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

/**
 * @param {{
 *   busy?: boolean,
 *   disabled?: boolean,
 *   onGoogle: () => void,
 * }} props
 */
export default function AuthSocialButtons({ busy = false, disabled = false, onGoogle }) {
  const { t } = useI18n();
  const locked = busy || disabled;

  return (
    <div className="pp-authSocial">
      <div className="pp-authSocial__divider" role="presentation">
        <span>{t('auth.continueWith')}</span>
      </div>
      <div className="pp-authSocial__row">
        <button
          type="button"
          className="pp-btn pp-authSocial__btn"
          disabled={locked}
          onClick={onGoogle}
        >
          <GoogleGlyph />
          <span>{t('auth.continueGoogle')}</span>
        </button>
      </div>
    </div>
  );
}
