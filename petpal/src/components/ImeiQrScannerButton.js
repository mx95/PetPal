import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { extractImeiFromQr } from '../pets/extractImeiFromQr';
import { useI18n } from '../i18n/I18nContext';

const VIDEO_CONSTRAINTS = [
  {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  },
  {
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  },
  { video: true, audio: false },
];

function waitForVideoReady(video) {
  if (video.readyState >= 2 && video.videoWidth > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      video.removeEventListener('loadedmetadata', onMeta);
      reject(new Error('video timeout'));
    }, 10000);
    const onMeta = () => {
      if (video.videoWidth > 0) {
        window.clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', onMeta);
        resolve();
      }
    };
    video.addEventListener('loadedmetadata', onMeta);
    onMeta();
  });
}

async function decodeCenterCrop(reader, video, canvas) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const cropH = Math.max(1, Math.floor(vh * 0.42));
  const cropY = Math.floor((vh - cropH) / 2);
  canvas.width = vw;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, cropY, vw, cropH, 0, 0, vw, cropH);
  return await reader.decodeFromCanvas(canvas);
}

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
  const readerRef = useRef(null);
  const scanTimerRef = useRef(0);
  const streamRef = useRef(null);
  const cancelledRef = useRef(false);
  const cropCanvasRef = useRef(null);

  const stopScanner = useCallback(async () => {
    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = 0;
    }
    readerRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
    setStarting(false);
  }, []);

  const handleClose = useCallback(() => {
    void stopScanner().then(() => {
      setOpen(false);
      setErr('');
    });
  }, [stopScanner]);

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
      setErr('');
    },
    [onImei, stopScanner, t]
  );

  const runScanLoop = useCallback(
    async (reader, video) => {
      if (cancelledRef.current || settledRef.current) return;

      try {
        let result = null;
        // Full-frame decode first.
        try {
          if (typeof reader.decodeFromVideoElement === 'function') {
            result = await reader.decodeFromVideoElement(video);
          } else if (typeof reader.decode === 'function') {
            // Fallback for older ZXing builds (sync API).
            result = reader.decode(video);
          }
        } catch {
          // try center crop for 1D barcodes
        }

        if (!result && typeof reader.decodeFromCanvas === 'function') {
          try {
            if (!cropCanvasRef.current) cropCanvasRef.current = document.createElement('canvas');
            result = await decodeCenterCrop(reader, video, cropCanvasRef.current);
          } catch {
            // still scanning
          }
        }

        const decoded = result?.getText?.() ?? result?.text ?? null;
        if (decoded) {
          onDecode(decoded);
          return;
        }
      } catch {
        // keep scanning
      }

      scanTimerRef.current = window.setTimeout(() => {
        runScanLoop(reader, video);
      }, 90);
    },
    [onDecode]
  );

  useEffect(() => {
    if (!open) return undefined;

    settledRef.current = false;
    cancelledRef.current = false;
    setErr('');
    setTorchOn(false);
    setTorchSupported(false);
    setStarting(true);

    const tmr = window.setTimeout(async () => {
      const video = videoRef.current;
      if (!video || cancelledRef.current) return;

      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (cancelledRef.current) return;

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
              BarcodeFormat.UPC_A,
              BarcodeFormat.UPC_E,
            ],
          ],
          [DecodeHintType.TRY_HARDER, true],
          [DecodeHintType.ASSUME_GS1, true],
        ]);

        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        let stream = null;
        let lastError = null;
        for (const constraints of VIDEO_CONSTRAINTS) {
          if (cancelledRef.current) return;
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch (e) {
            lastError = e;
          }
        }
        if (!stream) {
          throw lastError || new Error('camera unavailable');
        }
        if (cancelledRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = stream;
        streamRef.current = stream;
        await waitForVideoReady(video);
        if (cancelledRef.current) return;

        try {
          await video.play();
        } catch {
          // autoplay may already be running
        }

        setStarting(false);
        try {
          const track = stream.getVideoTracks?.()?.[0];
          const caps = track?.getCapabilities?.();
          setTorchSupported(!!caps?.torch);
        } catch {
          setTorchSupported(false);
        }

        runScanLoop(reader, video);
      } catch {
        if (!cancelledRef.current) {
          setErr(t('myPets.scanQrErrorCamera'));
          setStarting(false);
        }
      }
    }, 80);

    return () => {
      cancelledRef.current = true;
      window.clearTimeout(tmr);
      void stopScanner();
    };
  }, [open, runScanLoop, stopScanner, t]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

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

  const overlay = open ? (
    <div
      className="pp-imeiQrOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('myPets.scanQr')}
    >
      <button
        type="button"
        className="pp-imeiQrBackdrop"
        aria-label={t('myPets.scanQrClose')}
        onClick={handleClose}
      />
      <div className="pp-imeiQrPanel pp-card">
        <div className="pp-imeiQrHead">
          <h3 className="pp-imeiQrTitle">{t('myPets.scanQr')}</h3>
          <button
            type="button"
            className="pp-imeiQrClose"
            onClick={handleClose}
            aria-label={t('myPets.scanQrClose')}
            title={t('myPets.scanQrClose')}
          >
            ✕
          </button>
        </div>
        <div className="pp-imeiQrBody">
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
              <button type="button" className="pp-btn" onClick={toggleTorch}>
                {torchOn ? '🔦 Off' : '🔦 On'}
              </button>
            ) : null}
            {starting ? (
              <span className="pp-subtle" style={{ marginRight: 'auto' }}>
                Opening camera…
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  ) : null;

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
      {overlay && typeof document !== 'undefined' ? createPortal(overlay, document.body) : null}
    </>
  );
}
