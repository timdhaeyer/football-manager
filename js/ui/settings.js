// Settings: match format, squad import, alert test, debug speed, diagnostics.
import { formatShort, parseMinSec } from '../core/format.js';
import { sortPlayers } from '../core/squad.js';
import { getLog, onLog } from '../platform/log.js';
import { audioState } from '../platform/alerts.js';
import { wakeLockStatus } from '../platform/wakelock.js';
import { VERSION } from '../version.js';
import { $, playerLabel, toast, twoStep } from './dom.js';

let app;
let diagTimer = null;

export function initSettings(appRef) {
  app = appRef;
  $('set-back').addEventListener('click', () => app.show(app.state.match ? 'live' : 'selection'));
  $('set-save').addEventListener('click', save);
  $('set-squad-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await importSquad(await file.text());
  });
  $('set-squad-paste').addEventListener('click', () => importSquad($('set-squad-text').value));
  $('set-test-alert').addEventListener('click', () => app.testAlert());
  $('set-debug').addEventListener('change', async (e) => {
    const ok = await app.setDebugSpeed(Number(e.target.value));
    if (!ok) e.target.value = String(app.state.settings.debugSpeed);
    renderSettings();
  });
  twoStep($('set-abandon'), {
    confirmLabel: 'Tap again to abandon',
    onConfirm: () => app.abandonMatch(),
  });
  onLog(() => { if (app.state.view === 'settings') renderDiagnostics(); });
}

export function renderSettings() {
  const { settings, match, players, team } = app.state;
  $('set-quarters').value = settings.quarterCount;
  $('set-qmin').value = Math.round(settings.quarterMs / 60000);
  $('set-reminder').value = settings.reminderAtMs ? formatShort(settings.reminderAtMs) : '0';
  $('set-error').hidden = true;

  const active = sortPlayers(players.filter((p) => p.active));
  $('set-squad-summary').textContent = active.length
    ? `${team?.name ? `${team.name}: ` : ''}${active.length} players: ${active.map(playerLabel).join(', ')}`
    : 'No squad imported on this device yet.';

  const live = match?.status === 'live';
  $('set-match-info').textContent = match
    ? `${live ? 'Live' : 'Finished'} ${match.venue === 'away' ? 'away' : 'home'} match${match.opponent ? ` vs ${match.opponent}` : ''}, created ${new Date(match.createdAt).toLocaleString()}.`
    : 'No active match.';
  $('set-abandon').disabled = !match;

  const debug = $('set-debug');
  debug.value = String(settings.debugSpeed);
  debug.disabled = live;
  renderDiagnostics();
  clearInterval(diagTimer);
  diagTimer = setInterval(() => {
    if (app.state.view !== 'settings') return clearInterval(diagTimer);
    renderDiagnostics();
  }, 1000);
}

async function importSquad(text) {
  const err = $('set-squad-error');
  err.hidden = true;
  try {
    const { players } = await app.importSquadText(text);
    $('set-squad-text').value = '';
    toast(`Imported ${players.length} players`);
    renderSettings();
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
  }
}

async function save() {
  const err = $('set-error');
  const quarterCount = Number($('set-quarters').value);
  const qMin = Number($('set-qmin').value);
  const reminderAtMs = parseMinSec($('set-reminder').value);
  const problems = [];
  if (!Number.isInteger(quarterCount) || quarterCount < 1 || quarterCount > 8) problems.push('Quarters must be 1-8.');
  if (!Number.isInteger(qMin) || qMin < 1 || qMin > 60) problems.push('Quarter length must be 1-60 minutes.');
  if (reminderAtMs == null) problems.push('Reminder must look like 7:30 (or 0 for off).');
  else if (reminderAtMs !== 0 && reminderAtMs >= qMin * 60000) problems.push('Reminder must be before the end of the quarter.');
  if (problems.length) {
    err.textContent = problems.join('\n');
    err.hidden = false;
    return;
  }
  err.hidden = true;
  await app.saveSettings({ quarterCount, quarterMs: qMin * 60000, reminderAtMs });
  toast('Saved. Applies to the next match.');
}

function renderDiagnostics() {
  const { clock, persistence, sw, match } = app.state;
  const c = clock.info();
  const lines = [
    `version: ${VERSION}`,
    `standalone: ${navigator.standalone === true || matchMedia('(display-mode: standalone)').matches}`,
    `service worker: ${sw.status}${sw.waiting ? ' (update waiting)' : ''}`,
    `storage persisted: ${persistence}`,
    `wake lock: ${wakeLockStatus()}`,
    `audio: ${audioState()}`,
    `clock: speed ${c.speed}×, last re-anchor drift ${Math.round(c.lastDriftMs)} ms`,
    `timer: ${match ? JSON.stringify(match.timer) : '-'}`,
    `ua: ${navigator.userAgent}`,
    '',
    '— log (newest first) —',
    ...[...getLog()].reverse().map((l) => `${l.at.slice(11, 19)} ${l.message}${l.data !== undefined ? ` ${JSON.stringify(l.data)}` : ''}`),
  ];
  $('set-diag').textContent = lines.join('\n');
}
