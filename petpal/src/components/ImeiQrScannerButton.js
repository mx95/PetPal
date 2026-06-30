import React, { useCallback, useEffect, useRef, useState } from 'react';
import { extractImeiFromQr } from '../pets/extractImeiFromQr';
import { useI18n } from '../i18n/I18nContext';

const VIDEO_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

/**
 * Opens camera scanner for QR codes and 1D barcodes; extracts a 15-digit IMEI.
 * @param {{ onImei: (imei: string) => void, disabled?: boolean }} props
 */
export default function ImeiQrScannerButton({ onImei, disabled }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [starting, setStarting] = useState(false);
  const settledRef = useRef(false);
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const streamRef = useRef(null);

  const stopScanner = useCallback(async () => {
    try {
      controlsRef.current?.stop();
    } catch {
      // already stopped
    }
    controlsRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
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
      const video = videoRef.current;
      if (!video || cancelled) return;

      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (cancelled) return;

        const hints = new Map([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [
              BarcodeFormat.QR_CODE,
              BarcodeFormat.CODE_128,
              BarcodeFormat.CODE_39,
              BarcodeFormat.CODE_93,
              BarcodeFormat.ITF,
              BarcodeFormat.CODABAR,
              BarcodeFormat.DATA_MATRIX,
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
            ],
          ],
          [DecodeHintType.TRY_HARDER, true],
        ]);

        const reader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 120,
          delayBetweenScanSuccess: 400,
        });

        const onResult = (result) => {
          if (result && !cancelled) {
            onDecode(result.getText());
          }
        };

        try {
          const controls = await reader.decodeFromConstraints(VIDEO_CONSTRAINTS, video, onResult);
          if (cancelled) {
            controls.stop();
            return;
          }
          controlsRef.current = controls;
        } catch {
          const controls = await reader.decodeFromVideoDevice(undefined, video, onResult);
          if (cancelled) {
            controls.stop();
            return;
          }
          controlsRef.current = controls;
        }

        streamRef.current = video.srcObject;
        setStarting(false);
        try {
          const track = streamRef.current?.getVideoTracks?.()?.[0];
          const caps = track?.getCapabilities?.();
          setTorchSupported(!!caps?.torch);
        } catch {
          setTorchSupported(false);
        }
      } catch {
        if (!cancelled) {
          setErr(t('myPets.scanQrErrorCamera'));
          setStarting(false);
        }
      }
    }, 80);

    return () => {
      cancelled = true;
      window.clearTimeout(tmr);
      void stopScanner();
    };
  }, [open, onDecode, stopScanner, t]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()?.[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
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
            <div className="pp-imeiQrViewport">
              <video
                ref={videoRef}
                className="pp-imeiQrVideo"
                autoPlay
                muted
                playsInline
              />
              <div className="pp-imeiQrGuide" aria-hidden />
            </div>
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
