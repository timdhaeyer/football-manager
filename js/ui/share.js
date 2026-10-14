// Share sheet: result card image + Dutch text summary for the parents (e.g. WhatsApp group).
import { matchSummaryNl, summaryModel } from '../core/summary.js';
import { log } from '../platform/log.js';
import { $, toast } from './dom.js';
import { canvasToBlob, renderResultCard } from './result-card.js';

let app;
let cardFile = null;
let cardUrl = null;
let renderSeq = 0;

export function initShare(appRef) {
  app = appRef;
  $('btn-share').addEventListener('click', openShare);
  $('share-close').addEventListener('click', close);
  $('share').addEventListener('click', (e) => { if (e.target.id === 'share') close(); });
  $('share-copy').addEventListener('click', copy);
  $('share-native').addEventListener('click', shareText);
  $('share-image').addEventListener('click', shareImage);
}

export function openShare() {
  const { match, team } = app.state;
  if (!match) return;
  $('share-text').value = matchSummaryNl(match, team?.name);
  $('share-native').hidden = typeof navigator.share !== 'function';
  $('toast').hidden = true;
  $('share').hidden = false;
  renderCard(match, team?.name);
}

async function renderCard(match, teamName) {
  const seq = ++renderSeq;
  const img = $('share-card');
  const button = $('share-image');
  button.disabled = true;
  try {
    const blob = await canvasToBlob(await renderResultCard(summaryModel(match, teamName)));
    if (seq !== renderSeq || !blob) return;
    if (cardUrl) URL.revokeObjectURL(cardUrl);
    cardUrl = URL.createObjectURL(blob);
    const day = new Date(match.createdAt).toISOString().slice(0, 10);
    cardFile = new File([blob], `uitslag-${day}.png`, { type: 'image/png' });
    img.src = cardUrl;
    img.hidden = false;
    button.disabled = false;
  } catch (e) {
    log('card render failed', e.message);
    img.hidden = true;
  }
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

async function shareText() {
  await share({ text: $('share-text').value });
}

async function shareImage() {
  if (!cardFile) return;
  const data = { files: [cardFile], text: $('share-text').value };
  if (navigator.canShare?.(data)) return share(data);
  if (navigator.canShare?.({ files: [cardFile] })) return share({ files: [cardFile] });
  // No file sharing (e.g. desktop browser): download the image instead.
  const a = document.createElement('a');
  a.href = cardUrl;
  a.download = cardFile.name;
  a.click();
  toast('Image saved');
}

async function share(data) {
  try {
    await navigator.share(data);
  } catch (e) {
    if (e.name !== 'AbortError') {
      log('share failed', e.message);
      toast('Sharing failed. Use Copy text instead');
    }
  }
}
