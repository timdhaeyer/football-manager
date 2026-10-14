// Beep (Web Audio) + full-screen flash overlay.
// iOS: audio must be unlocked by a user gesture; the AudioContext can be interrupted
// after backgrounding, so we retry resume() on every tap and on visibility.
import { log } from './log.js';

let ctx = null;

function ensureContext() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  // Safari 16.4+: play through the ring/silent switch.
  if (navigator.audioSession) {
    try { navigator.audioSession.type = 'playback'; } catch { /* ignore */ }
  }
  ctx = new AC();
  return ctx;
}

function unlock() {
  const c = ensureContext();
  if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  // A silent buffer played inside the gesture fully unlocks output on older iOS.
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
}

export function installAudioUnlock() {
  addEventListener('pointerdown', unlock, { capture: true, passive: true });
  addEventListener('touchend', unlock, { capture: true, passive: true });
}

export function resumeAudio() {
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
}

export function audioState() {
  return ctx ? ctx.state : 'locked (tap once)';
}

export function beep({ freq = 1046, durationMs = 700 } = {}) {
  const c = ensureContext();
  if (!c) return false;
  if (c.state !== 'running') {
    c.resume().catch(() => {});
    log('beep while audio not running', c.state);
  }
  const t0 = c.currentTime + 0.02;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.9, t0 + 0.02);
  gain.gain.setValueAtTime(0.9, t0 + durationMs / 1000 - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.05);
  return true;
}

let hideTimer = null;

// Full-screen flash for a few seconds; tap to dismiss early.
// Alternates at 2 Hz (below the 3 Hz photosensitivity guideline).
export function flash({ title, detail = '', durationMs = 4000 }) {
  const el = document.getElementById('flash');
  el.querySelector('.flash-title').textContent = title;
  el.querySelector('.flash-detail').textContent = detail;
  el.hidden = false;
  el.classList.remove('flashing');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('flashing');
  clearTimeout(hideTimer);
  const hide = () => {
    el.hidden = true;
    el.classList.remove('flashing');
  };
  hideTimer = setTimeout(hide, durationMs);
  el.onclick = () => {
    clearTimeout(hideTimer);
    hide();
  };
}

export function alert({ title, detail }) {
  beep();
  flash({ title, detail });
  log('alert', `${title} ${detail}`.trim());
}
