// Pure match operations. A match is a plain document persisted as one IndexedDB record.
import { DEFAULT_CONFIG, PHASE, derive, initialTimer, reduce } from './timer.js';
import { matchMinute, quarterClock } from './format.js';

export const SCHEMA_VERSION = 1;

export function newId(prefix = '') {
  const c = globalThis.crypto;
  const id = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return prefix + id;
}

export function createMatch({ createdAt, opponent = '', venue = 'home', selection = [], config = DEFAULT_CONFIG, debug = false, id = newId('m_') }) {
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    createdAt,
    status: 'live',
    debug,
    opponent: opponent.trim(),
    venue: venue === 'away' ? 'away' : 'home',
    selection: [...selection],
    config: { ...config },
    timer: initialTimer(),
    events: [],
  };
}

export function isAway(match) {
  return match.venue === 'away';
}

// Both sides in football order: home team first.
export function scoreboard(match, teamName = '') {
  const s = score(match);
  const us = { side: 'us', name: teamName || 'Us', goals: s.us };
  const them = { side: 'them', name: match.opponent || 'Opponent', goals: s.them };
  return isAway(match) ? [them, us] : [us, them];
}

const TIMER_EVENT = { start: 'quarterStart', startNext: 'quarterStart', pause: 'pause', resume: 'resume', endQuarter: 'quarterEnd' };

// Applies a timer action and logs it as an event. Returns the same object if nothing changed.
export function applyTimerAction(match, action, now) {
  const timer = reduce(match.timer, action, now, match.config);
  if (timer === match.timer) return match;
  const next = { ...match, timer };
  const type = TIMER_EVENT[action.type];
  if (type) {
    const logged = type === 'quarterEnd' ? match.timer : timer;
    const elapsed = derive(logged, match.config, now).elapsedMs;
    next.events = [...match.events, { id: newId('e_'), type, quarter: timer.quarter, elapsedMs: elapsed, at: now }];
  }
  if (timer.phase === PHASE.FINISHED) next.status = 'finished';
  return next;
}

export function canRecordGoal(match) {
  return match.timer.phase !== PHASE.IDLE;
}

// goal: { team: 'us'|'them', kind?: 'player'|'ownGoal'|'unknown', player?: {id,name} }
// at:   { quarter, elapsedMs, at } captured when the + Goal button was tapped.
export function addGoal(match, goal, at, id = newId('e_')) {
  if (!canRecordGoal(match)) return match;
  const team = goal.team === 'them' ? 'them' : 'us';
  const event = { id, type: 'goal', team, quarter: at.quarter, elapsedMs: at.elapsedMs, at: at.at };
  if (team === 'us') {
    const kind = goal.kind ?? (goal.player ? 'player' : 'unknown');
    event.kind = kind;
    event.playerId = kind === 'player' ? goal.player.id : null;
    event.playerName = kind === 'player' ? goal.player.name : null;
  }
  return { ...match, events: [...match.events, event] };
}

export function lastGoal(match) {
  for (let i = match.events.length - 1; i >= 0; i--) {
    if (match.events[i].type === 'goal') return match.events[i];
  }
  return null;
}

export function undoLastGoal(match) {
  const goal = lastGoal(match);
  if (!goal) return { match, removed: null };
  return { match: { ...match, events: match.events.filter((e) => e.id !== goal.id) }, removed: goal };
}

export function score(match) {
  let us = 0;
  let them = 0;
  for (const e of match.events) {
    if (e.type !== 'goal') continue;
    if (e.team === 'us') us++;
    else them++;
  }
  return { us, them };
}

export function goalLabel(e) {
  if (e.team === 'them') return 'Opponent';
  if (e.kind === 'ownGoal') return 'Own goal (opponent)';
  if (e.kind === 'unknown') return 'Unknown scorer';
  return e.playerName;
}

export function goalList(match) {
  return match.events
    .filter((e) => e.type === 'goal')
    .map((e) => ({
      ...e,
      minute: matchMinute(match.config, e.quarter, e.elapsedMs),
      clock: quarterClock(match.config, e.quarter, e.elapsedMs),
      label: goalLabel(e),
    }));
}
