import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { extractImeiFromQr } from '../pets/extractImeiFromQr';
import { useI18n } from '../i18n/I18nContext';

/**
 * Opens camera QR scanner; decodes payload and extracts a 15-digit IMEI.
 * @param {{ onImei: (imei: string) => void, disabled?: boolean }} props
 */
export default function ImeiQrScannerButton({ onImei, disabled }) {
  const { t } = useI18n();
  const reactId = useId();
  const scannerElementId = `imei-qr-${reactId.replace(/:/g, '')}`;
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const settledRef = useRef(false);
  const scannerRef = useRef(null);

  const stopScanner = useCallback(async () => {
    const qr = scannerRef.current;
    scannerRef.current = null;
    if (!qr) return;
    try {
      await qr.stop();
      qr.clear();
    } catch {
      // already stopped or DOM cleared
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    settledRef.current = false;
    setErr('');

    let cancelled = false;
    const tmr = window.setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const qr = new Html5Qrcode(scannerElementId, false);
        scannerRef.current = qr;
        await qr.start(
          { facingMode: 'environment' },
          {
            fps: 8,
            qrbox: (vw, vh) => {
              const w = Math.min(280, Math.floor(vw * 0.85));
              const h = Math.min(260, Math.floor(vh * 0.45));
              return { width: w, height: Math.max(120, h) };
            },
          },
          (decodedText) => {
            if (settledRef.current) return;
            const imei = extractImeiFromQr(decodedText);
            if (!imei) {
              setErr(t('myPets.scanQrErrorNoImei'));
              return;
            }
            settledRef.current = true;
            void stopScanner();
            onImei(imei);
            setOpen(false);
          },
          () => {}
        );
      } catch {
        if (!cancelled) setErr(t('myPets.scanQrErrorCamera'));
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(tmr);
      void stopScanner();
    };
  }, [open, onImei, scannerElementId, stopScanner, t]);

  return (
    <>
      <button
        type="button"
        className="pp-btn"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {t('myPets.scanQr')}
      </button>
      {open ? (
        <div
          className="pp-imeiQrOverlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('myPets.scanQr')}
        >
          <div className="pp-imeiQrPanel pp-card pp-pad">
            <p className="pp-subtle" style={{ marginTop: 0 }}>
              {t('myPets.scanQrHint')}
            </p>
            {err ? (
              <p className="pp-error" style={{ marginBottom: 8 }}>
                {err}
              </p>
            ) : null}
            <div
              id={scannerElementId}
              className="pp-imeiQrViewport"
            />
            <div className="pp-row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="pp-btn"
                onClick={() => {
                  setOpen(false);
                }}
              >
                {t('myPets.scanQrClose')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
