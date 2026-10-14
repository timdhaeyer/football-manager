// Football Manager: bootstrap and orchestration.
import { createClock } from './core/clock.js';
import { DEFAULT_CONFIG, PHASE, derive, isMissed } from './core/timer.js';
import { addGoal, applyTimerAction, canRecordGoal, createMatch, goalLabel, lastGoal, undoLastGoal } from './core/match.js';
import { formatMs, formatShort, matchMinute, quarterClock } from './core/format.js';
import { parseSquad } from './core/squad.js';
import * as store from './platform/store.js';
import { installErrorHandlers, loadLog, log } from './platform/log.js';
import { alert as fireAlert, installAudioUnlock, resumeAudio } from './platform/alerts.js';
import { reacquireWakeLock, setWakeLockWanted } from './platform/wakelock.js';
import { installLifecycle } from './platform/lifecycle.js';
import { VERSION } from './version.js';
import { $, confirmDialog, toast } from './ui/dom.js';
import { initSelection, renderSelection, resetSelection } from './ui/selection.js';
import { initLive, invalidateLive, renderLive } from './ui/live.js';
import { initGoalPicker, openGoalPicker } from './ui/goal-picker.js';
import { initSettings, renderSettings } from './ui/settings.js';
import { initShare, openShare } from './ui/share.js';

const RENDER_INTERVAL_MS = 200;
const DEFAULT_SETTINGS = { ...DEFAULT_CONFIG, debugSpeed: 1, debugEpochWall: null };
const VIEWS = ['loading', 'selection', 'live', 'settings'];

const state = {
  view: 'loading',
  settings: { ...DEFAULT_SETTINGS },
  team: null,
  players: [],
  match: null,
  lastSelection: [],
  clock: createClock(),
  persistence: 'unknown',
  sw: { status: 'not registered', reg: null, waiting: null },
};

function debugFromSettings() {
  const { debugSpeed, debugEpochWall } = state.settings;
  return debugSpeed > 1 ? { speed: debugSpeed, epochWall: debugEpochWall ?? Date.now() } : false;
}

function makeClock(debug) {
  return debug ? createClock({ speed: debug.speed, epochWall: debug.epochWall }) : createClock();
}

function show(view) {
  state.view = view;
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== view;
  $('picker').hidden = true;
  $('share').hidden = true;
  if (view === 'selection') renderSelection();
  if (view === 'settings') renderSettings();
  if (view === 'live') {
    invalidateLive();
    tick();
  }
  renderUpdateBanner();
}

function commit(match) {
  state.match = match;
  store.saveMatch(match).catch((e) => log('save failed', e.message));
  setWakeLockWanted(match.status === 'live');
  renderUpdateBanner();
}

async function startMatch({ opponent, venue, selection }) {
  const debug = debugFromSettings();
  state.clock = makeClock(debug);
  const { quarterCount, quarterMs, reminderAtMs } = state.settings;
  const match = createMatch({
    createdAt: Date.now(),
    opponent,
    venue,
    selection,
    config: { quarterCount, quarterMs, reminderAtMs },
    debug,
  });
  commit(match);
  state.lastSelection = selection;
  await Promise.all([store.setMeta('activeMatchId', match.id), store.setMeta('lastSelection', selection)]);
  store.requestPersistence().then((p) => (state.persistence = p));
  log('match created', { debug: debug ? debug.speed : 1, venue: match.venue });
  show('live');
}

function timerAction(type) {
  if (!state.match) return;
  const next = applyTimerAction(state.match, { type }, state.clock.now());
  if (next === state.match) return;
  commit(next);
  log(type, { q: next.timer.quarter });
  tick();
  if (next.timer.phase === PHASE.FINISHED) openShare();
}

function mainAction() {
  reacquireWakeLock();
  const phase = state.match?.timer.phase;
  if (phase === PHASE.IDLE) timerAction('start');
  else if (phase === PHASE.RUNNING) timerAction('pause');
  else if (phase === PHASE.PAUSED) timerAction('resume');
  else if (phase === PHASE.BREAK) timerAction('startNext');
  else if (phase === PHASE.FINISHED) newMatch();
}

function captureTime() {
  const now = state.clock.now();
  const d = derive(state.match.timer, state.match.config, now);
  return { quarter: d.quarter, elapsedMs: d.elapsedMs, at: now };
}

function openGoal() {
  if (!state.match || !canRecordGoal(state.match)) return toast('Start the match first');
  openGoalPicker(captureTime());
}

function recordGoal(goal, at) {
  if (!state.match || !canRecordGoal(state.match)) return toast('Start the match first');
  const next = addGoal(state.match, goal, at);
  if (next === state.match) return;
  commit(next);
  const e = next.events.at(-1);
  const when = `${matchMinute(next.config, e.quarter, e.elapsedMs)} (${quarterClock(next.config, e.quarter, e.elapsedMs)})`;
  toast(e.team === 'them' ? `Opponent goal ${when}` : `GOAL! ${goalLabel(e)} ${when}`);
  log('goal', { team: e.team, kind: e.kind });
  tick();
}

async function undoGoal() {
  const g = state.match && lastGoal(state.match);
  if (!g) return toast('No goals to undo');
  const who = g.team === 'them' ? state.match.opponent || 'Opponent' : goalLabel(g);
  const ok = await confirmDialog({
    title: 'Undo last goal?',
    message: `${matchMinute(state.match.config, g.quarter, g.elapsedMs)} (${quarterClock(state.match.config, g.quarter, g.elapsedMs)}) ${who}`,
    ok: 'Remove goal',
  });
  if (!ok) return;
  commit(undoLastGoal(state.match).match);
  log('undo goal');
  toast('Goal removed');
  tick();
}

async function closeMatch() {
  state.match = null;
  setWakeLockWanted(false);
  await store.setMeta('activeMatchId', null);
  state.clock = makeClock(debugFromSettings());
  resetSelection(state.lastSelection);
  $('sel-opponent').value = '';
  show('selection');
}

async function newMatch() {
  const ok = await confirmDialog({ title: 'New match?', message: 'This match stays saved on this device.', ok: 'New match' });
  if (ok) await closeMatch();
}

async function abandonMatch() {
  if (!state.match) return;
  commit({ ...state.match, status: 'abandoned' });
  log('match abandoned');
  await closeMatch();
  toast('Match abandoned');
}

async function importSquadText(text) {
  const parsed = parseSquad(text);
  await store.importSquad(parsed);
  state.players = await store.getPlayers();
  state.team = await store.getMeta('team', null);
  resetSelection(state.lastSelection);
  log('squad imported', { players: parsed.players.length });
  return parsed;
}

async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await store.setMeta('settings', state.settings);
}

async function setDebugSpeed(speed) {
  if (state.match?.status === 'live') {
    toast('Finish or abandon the current match first');
    return false;
  }
  await saveSettings({ debugSpeed: speed, debugEpochWall: speed > 1 ? Date.now() : null });
  state.clock = makeClock(debugFromSettings());
  log('debug speed', speed);
  return true;
}

function testAlert() {
  fireAlert({ title: 'SUBSTITUTION', detail: 'Test alert' });
}

// ── Render loop: reads the clock, derives state, fires due alerts. Holds no time. ──
function tick() {
  if (!state.match || state.match.status !== 'live') {
    if (state.view === 'live' && state.match) renderLive(derive(state.match.timer, state.match.config, 0));
    return;
  }
  const now = state.clock.now();
  let d = derive(state.match.timer, state.match.config, now);
  if (d.reminderDue || d.endDue) {
    handleAlerts(d, now);
    d = derive(state.match.timer, state.match.config, now);
  }
  if (state.view === 'live') renderLive(d);
}

function handleAlerts(d, now) {
  const { config } = state.match;
  let next = state.match;
  if (d.reminderDue) next = applyTimerAction(next, { type: 'ackReminder' }, now);
  if (d.endDue) next = applyTimerAction(next, { type: 'ackEnd' }, now);
  commit(next);

  const q = d.quarter;
  // "Missed" is judged in real time, so debug speed-ups don't flag on-time alerts as late.
  const speed = state.match.debug?.speed || 1;
  const missed = (lateMs) => isMissed(lateMs / speed);
  let title;
  let detail;
  if (d.endDue) {
    title = `END OF Q${q}`;
    if (d.reminderDue) detail = `Sub reminder (${formatShort(config.reminderAtMs)}) was missed`;
    else if (missed(d.endLateMs)) detail = `${formatMs(config.quarterMs)} passed ${formatShort(d.endLateMs)} ago`;
    else detail = `${formatMs(config.quarterMs)} · overtime running`;
  } else {
    title = 'SUBSTITUTION';
    detail = `Q${q} · ${formatShort(config.reminderAtMs)}`;
    if (missed(d.reminderLateMs)) detail += ` · missed by ${formatShort(d.reminderLateMs)}`;
  }
  fireAlert({ title, detail });
}

// ── Service worker: cache-first app shell; updates are applied only between matches. ──
async function registerServiceWorker() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!('serviceWorker' in navigator)) return (state.sw.status = 'unsupported');
  if (local && !new URLSearchParams(location.search).has('sw')) return (state.sw.status = 'disabled on localhost (add ?sw=1)');
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    state.sw.reg = reg;
    state.sw.status = navigator.serviceWorker.controller ? 'active' : 'installed (first visit)';
    const onWaiting = () => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        state.sw.waiting = reg.waiting;
        renderUpdateBanner();
      }
    };
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => w.state === 'installed' && onWaiting());
    });
    onWaiting();
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  } catch (e) {
    state.sw.status = `error: ${e.message}`;
    log('sw register failed', e.message);
  }
}

let lastUpdateCheck = 0;
function checkForUpdate() {
  if (!state.sw.reg || Date.now() - lastUpdateCheck < 60_000) return;
  lastUpdateCheck = Date.now();
  state.sw.reg.update().catch(() => {});
}

function renderUpdateBanner() {
  const inMatch = state.match?.status === 'live';
  $('update-banner').hidden = !(state.sw.waiting && !inMatch);
}

// Local development convenience: squad.json is gitignored, so it only exists locally.
async function tryLoadLocalSquad() {
  try {
    const res = await fetch('squad.json', { cache: 'no-store' });
    if (!res.ok) return;
    await importSquadText(await res.text());
    log('loaded local squad.json');
  } catch {
    /* not available: import via Settings */
  }
}

const app = {
  state,
  show,
  startMatch,
  timerAction,
  mainAction,
  captureTime,
  openGoal,
  recordGoal,
  undoGoal,
  abandonMatch,
  importSquadText,
  saveSettings,
  setDebugSpeed,
  testAlert,
};

async function boot() {
  installErrorHandlers();
  installAudioUnlock();
  initSelection(app);
  initLive(app);
  initGoalPicker(app);
  initSettings(app);
  initShare(app);
  await loadLog();
  log('boot', { version: VERSION });

  state.settings = { ...DEFAULT_SETTINGS, ...(await store.getMeta('settings', {})) };
  state.team = await store.getMeta('team', null);
  state.players = await store.getPlayers();
  state.lastSelection = await store.getMeta('lastSelection', []);
  if (!state.players.length) await tryLoadLocalSquad();

  const activeId = await store.getMeta('activeMatchId', null);
  const match = activeId ? await store.getMatch(activeId) : null;
  if (match && (match.status === 'live' || match.status === 'finished')) {
    state.match = match;
    state.clock = makeClock(match.debug);
    setWakeLockWanted(match.status === 'live');
    log('match restored', { phase: match.timer.phase, q: match.timer.quarter });
  } else {
    state.clock = makeClock(debugFromSettings());
  }
  resetSelection(state.lastSelection);

  $('update-reload').addEventListener('click', () => state.sw.waiting?.postMessage({ type: 'SKIP_WAITING' }));
  addEventListener('pointerdown', reacquireWakeLock, { passive: true });

  installLifecycle({
    onVisible(source) {
      const drift = state.clock.reanchor();
      if (Math.abs(drift) > 1000) log('re-anchored', { source, driftMs: Math.round(drift) });
      resumeAudio();
      reacquireWakeLock();
      tick();
      checkForUpdate();
    },
    onHidden() {
      if (state.match) store.saveMatch(state.match).catch(() => {});
    },
  });

  show(state.match ? 'live' : 'selection');
  setInterval(tick, RENDER_INTERVAL_MS);

  store.requestPersistence().then((p) => (state.persistence = p));
  registerServiceWorker();
}

boot().catch((e) => {
  log('boot failed', e.message);
  const v = $('view-loading');
  v.hidden = false;
  v.textContent = `Could not start: ${e.message}`;
});
