/** @type {AudioContext | null} */
let sharedCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  return sharedCtx;
}

function playTone(ctx, frequency, startAt, durationSec, peakGain = 0.07) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.04);
}

/** Short success chime when a daily mission is completed (requires user gesture). */
export function playMissionCompleteSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const run = () => {
    const now = ctx.currentTime;
    playTone(ctx, 523.25, now, 0.14);
    playTone(ctx, 659.25, now + 0.1, 0.16, 0.06);
    playTone(ctx, 783.99, now + 0.2, 0.22, 0.05);
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(run).catch(() => {});
    return;
  }
  run();
}
