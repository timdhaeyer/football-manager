// Screen Wake Lock: held while a match is live. The browser releases it whenever the
// page is hidden, so it must be re-requested when the page becomes visible again.
import { log } from './log.js';

let sentinel = null;
let wanted = false;
let status = 'off';
const listeners = new Set();

function setStatus(s) {
  status = s;
  listeners.forEach((fn) => fn(s));
}

export function wakeLockStatus() {
  return status;
}

export function onWakeLockChange(fn) {
  listeners.add(fn);
}

async function acquire() {
  if (!('wakeLock' in navigator)) return setStatus('unsupported');
  if (sentinel && !sentinel.released) return setStatus('on');
  if (document.visibilityState !== 'visible') return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    setStatus('on');
    sentinel.addEventListener('release', () => {
      sentinel = null;
      setStatus(wanted ? 'released' : 'off');
    });
  } catch (e) {
    setStatus('failed');
    log('wake lock failed', e.message);
  }
}

export function setWakeLockWanted(want) {
  wanted = want;
  if (want) acquire();
  else if (sentinel) sentinel.release().catch(() => {});
}

// Call on visible and on user taps (some iOS versions only grant it inside a gesture).
export function reacquireWakeLock() {
  if (wanted && (!sentinel || sentinel.released)) acquire();
}
