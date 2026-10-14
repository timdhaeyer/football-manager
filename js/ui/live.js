// Live match screen: clock, score, goals, controls. Rendering only reads derived state.
import { PHASE } from '../core/timer.js';
import { formatMs, formatShort } from '../core/format.js';
import { goalList, isAway, lastGoal, scoreboard } from '../core/match.js';
import { wakeLockStatus } from '../platform/wakelock.js';
import { $, el, twoStep } from './dom.js';

let app;
let endButton;
let renderedEvents = null;

export function initLive(appRef) {
  app = appRef;
  $('live-settings').addEventListener('click', () => app.show('settings'));
  $('btn-main').addEventListener('click', () => app.mainAction());
  $('btn-goal').addEventListener('click', () => app.openGoal());
  $('btn-opp-goal').addEventListener('click', () => app.recordGoal({ team: 'them' }, app.captureTime()));
  $('btn-undo').addEventListener('click', () => app.undoGoal());
  endButton = twoStep($('btn-end'), {
    confirmLabel: 'Tap again',
    onConfirm: () => app.timerAction('endQuarter'),
  });
}

const MAIN_LABEL = {
  [PHASE.IDLE]: () => 'Start Q1',
  [PHASE.RUNNING]: () => 'Pause',
  [PHASE.PAUSED]: () => 'Resume',
  [PHASE.BREAK]: (q) => `Start Q${q + 1}`,
  [PHASE.FINISHED]: () => 'New match',
};

function setText(id, text) {
  const node = $(id);
  if (node.textContent !== text) node.textContent = text;
}

function badge(text, cls = '') {
  return el('span', { class: `badge ${cls}`.trim(), textContent: text });
}

export function renderLive(d) {
  const { match, team } = app.state;
  if (!match) return;
  const { config, timer } = match;
  const q = Math.max(1, timer.quarter);
  const inPlay = d.phase === PHASE.RUNNING || d.phase === PHASE.PAUSED;

  setText('live-quarter', `Q${q}/${config.quarterCount}`);

  // Clock: capped at the quarter length, overtime shown separately as "+m:ss".
  const clock = $('live-clock');
  setText('live-clock', formatMs(Math.min(d.elapsedMs, config.quarterMs)));
  clock.classList.toggle('paused', d.phase !== PHASE.RUNNING);
  clock.classList.toggle('overtime-on', d.isOvertime);
  const ot = $('live-overtime');
  ot.hidden = !(d.overtimeMs > 0 && d.phase !== PHASE.IDLE);
  if (!ot.hidden) setText('live-overtime', `+${formatShort(d.overtimeMs)} overtime`);

  const status = $('live-status');
  let statusText = '';
  if (d.phase === PHASE.IDLE) statusText = `Ready · ${config.quarterCount} × ${formatMs(config.quarterMs)}`;
  else if (d.phase === PHASE.PAUSED) statusText = 'PAUSED';
  else if (d.phase === PHASE.BREAK) statusText = `Break · Q${q} played ${formatMs(timer.quarterDurationsMs.at(-1) ?? 0)}`;
  else if (d.phase === PHASE.FINISHED) statusText = 'Full time';
  else if (d.isOvertime) statusText = `End Q${q} when the referee blows the whistle`;
  setText('live-status', statusText);
  status.classList.toggle('paused', d.phase === PHASE.PAUSED);

  // Badges
  const badges = [badge(isAway(match) ? 'AWAY' : 'HOME')];
  if (match.debug) badges.push(badge(`DEBUG ${match.debug.speed}×`, 'debug'));
  if (inPlay && d.reminderEnabled) {
    badges.push(timer.reminderFired
      ? badge(`Sub ✓ ${formatShort(config.reminderAtMs)}`, 'ok')
      : badge(`Sub at ${formatShort(config.reminderAtMs)}`));
  }
  if (d.phase === PHASE.FINISHED) badges.push(badge('FULL TIME', 'ok'));
  const wl = wakeLockStatus();
  if (match.status === 'live' && wl !== 'on' && wl !== 'off') badges.push(badge('⚠ Screen may sleep', 'bad'));
  const badgeKey = badges.map((b) => b.className + b.textContent).join('|');
  const box = $('live-badges');
  if (box.dataset.key !== badgeKey) {
    box.dataset.key = badgeKey;
    box.replaceChildren(...badges);
  }

  // Controls
  const main = $('btn-main');
  setText('btn-main', MAIN_LABEL[d.phase](q));
  main.classList.toggle('pause', d.phase === PHASE.RUNNING);
  const end = $('btn-end');
  const finished = d.phase === PHASE.FINISHED;
  end.hidden = finished;
  $('btn-share').hidden = !finished;
  end.classList.toggle('btn-end-hidden', !inPlay);
  end.disabled = !inPlay;
  if (!endButton.isArmed()) setText('btn-end', d.isLastQuarter ? 'End match' : `End Q${q}`);
  const canGoal = d.phase !== PHASE.IDLE;
  $('btn-goal').disabled = !canGoal;
  $('btn-opp-goal').disabled = !canGoal;
  $('btn-undo').disabled = !lastGoal(match);

  // Score + goal list only when the events changed.
  if (renderedEvents !== match.events) {
    renderedEvents = match.events;
    const [left, right] = scoreboard(match, team?.name);
    setText('score-left', String(left.goals));
    setText('score-right', String(right.goals));
    setText('score-left-name', left.name);
    setText('score-right-name', right.name);
    $('score-left-side').classList.toggle('mine', left.side === 'us');
    $('score-right-side').classList.toggle('mine', right.side === 'us');
    const goals = goalList(match).reverse();
    $('goal-list').replaceChildren(
      ...goals.map((g) =>
        el('li', { class: g.team === 'them' ? 'them' : '' },
          el('span', { class: 'min', textContent: g.minute }),
          el('span', { class: 'who', textContent: g.team === 'them' ? `${match.opponent || 'Opponent'}` : `⚽ ${g.label}` }),
          el('span', { class: 'at', textContent: g.clock }),
        ),
      ),
    );
  }
}

export function invalidateLive() {
  renderedEvents = null;
}
