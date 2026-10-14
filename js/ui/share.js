// Share sheet: Dutch match summary to copy or share (e.g. to the parents' WhatsApp group).
import { matchSummaryNl } from '../core/summary.js';
import { log } from '../platform/log.js';
import { $, toast } from './dom.js';

let app;

export function initShare(appRef) {
  app = appRef;
  $('btn-share').addEventListener('click', openShare);
  $('share-close').addEventListener('click', close);
  $('share').addEventListener('click', (e) => { if (e.target.id === 'share') close(); });
  $('share-copy').addEventListener('click', copy);
  $('share-native').addEventListener('click', shareNative);
}

export function openShare() {
  const { match, team } = app.state;
  if (!match) return;
  $('share-text').value = matchSummaryNl(match, team?.name);
  $('share-native').hidden = typeof navigator.share !== 'function';
  $('toast').hidden = true;
  $('share').hidden = false;
}

function close() {
  $('share').hidden = true;
}

async function copy() {
  const text = $('share-text').value;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers without async clipboard access.
    const area = $('share-text');
    area.focus();
    area.select();
    if (!document.execCommand('copy')) return toast('Select the text and copy it manually');
  }
  toast('Copied. Paste it in WhatsApp');
}

async function shareNative() {
  try {
    await navigator.share({ text: $('share-text').value });
  } catch (e) {
    if (e.name !== 'AbortError') {
      log('share failed', e.message);
      toast('Sharing failed. Use Copy instead');
    }
  }
}
