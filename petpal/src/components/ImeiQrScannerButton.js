import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { extractImeiFromQr } from '../pets/extractImeiFromQr';
import { useI18n } from '../i18n/I18nContext';

const SCAN_FORMATS = [
  'QR_CODE',
  'CODE_128',
  'CODE_39',
  'CODE_93',
  'ITF',
  'CODABAR',
  'DATA_MATRIX',
  'EAN_13',
  'EAN_8',
];

/** Full viewfinder scan — 1D barcodes need width; cropping often misses them. */
const SCAN_CONFIG = {
  fps: 12,
  disableFlip: false,
};

/**
 * Opens camera scanner for QR codes and 1D barcodes; extracts a 15-digit IMEI.
 * @param {{ onImei: (imei: string) => void, disabled?: boolean }} props
 */
export default function ImeiQrScannerButton({ onImei, disabled }) {
  const { t } = useI18n();
  const reactId = useId();
  const scannerElementId = `imei-qr-${reactId.replace(/:/g, '')}`;
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [starting, setStarting] = useState(false);
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
    setTorchOn(false);
    setTorchSupported(false);
    setStarting(false);
  }, []);

  const onDecode = useCallback(
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
    [onImei, stopScanner, t]
  );

  useEffect(() => {
    if (!open) return undefined;

    settledRef.current = false;
    setErr('');
    setTorchOn(false);
    setTorchSupported(false);
    setStarting(true);

    let cancelled = false;
    const tmr = window.setTimeout(async () => {
      const startWithConstraints = async (videoConstraints) => {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;
        const formatsToSupport = SCAN_FORMATS.map((name) => Html5QrcodeSupportedFormats[name]);
        const qr = new Html5Qrcode(scannerElementId, {
          formatsToSupport,
          // ZXing is more reliable for CODE_128 / ITF than native BarcodeDetector in a cropped region.
          useBarCodeDetectorIfSupported: false,
          verbose: false,
        });
        scannerRef.current = qr;
        await qr.start(videoConstraints, SCAN_CONFIG, onDecode, () => {});
        setStarting(false);
        try {
          const caps = qr.getRunningTrackCapabilities?.();
          setTorchSupported(!!caps?.torch);
        } catch {
          setTorchSupported(false);
        }
      };

      try {
        await startWithConstraints({ facingMode: { exact: 'environment' } });
      } catch {
        try {
          await startWithConstraints({ facingMode: 'environment' });
        } catch {
          if (!cancelled) {
            setErr(t('myPets.scanQrErrorCamera'));
            setStarting(false);
          }
        }
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(tmr);
      void stopScanner();
    };
  }, [open, onDecode, scannerElementId, stopScanner, t]);

  const toggleTorch = useCallback(async () => {
    const qr = scannerRef.current;
    if (!qr) return;
    try {
      await qr.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((prev) => !prev);
    } catch {
      // ignore devices/browsers without torch support
    }
  }, [torchOn]);

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
            {err ? (
              <p className="pp-error" style={{ marginBottom: 8 }}>
                {err}
              </p>
            ) : null}
            <p className="pp-subtle" style={{ marginBottom: 8, fontSize: 13 }}>
              {t('myPets.scanQrHint')}
            </p>
            <div
              id={scannerElementId}
              className="pp-imeiQrViewport"
            />
            <div className="pp-row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
              {torchSupported ? (
                <button
                  type="button"
                  className="pp-btn"
                  onClick={toggleTorch}
                >
                  {torchOn ? '🔦 Off' : '🔦 On'}
                </button>
              ) : null}
              {starting ? <span className="pp-subtle" style={{ marginRight: 'auto' }}>Opening camera…</span> : null}
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
