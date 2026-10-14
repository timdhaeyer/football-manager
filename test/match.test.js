import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addGoal, applyTimerAction, createMatch, goalList, isAway, lastGoal, score, scoreboard, undoLastGoal } from '../js/core/match.js';
import { matchMinute, formatMs, formatShort, parseMinSec, quarterClock } from '../js/core/format.js';
import { DEFAULT_CONFIG as C } from '../js/core/timer.js';

const MIN = 60_000;
const lars = { id: 'p07', name: 'Lars' };

function liveMatch() {
  let m = createMatch({ createdAt: 0, opponent: ' KSV ', selection: ['p07'] });
  m = applyTimerAction(m, { type: 'start' }, 0);
  return m;
}

test('createMatch snapshots config and trims opponent', () => {
  const m = createMatch({ createdAt: 1, opponent: ' KSV ' });
  assert.equal(m.opponent, 'KSV');
  assert.deepEqual(m.config, { ...C });
  assert.equal(m.status, 'live');
});

test('venue defaults to home; scoreboard lists the home team first', () => {
  const home = createMatch({ createdAt: 0, opponent: 'KSV' });
  assert.equal(home.venue, 'home');
  assert.equal(createMatch({ createdAt: 0, venue: 'bogus' }).venue, 'home');
  const { venue: _ignored, ...legacy } = home; // matches saved before venue existed
  assert.deepEqual(scoreboard(legacy, 'My Club').map((s) => s.side), ['us', 'them']);

  let away = createMatch({ createdAt: 0, opponent: 'KSV', venue: 'away' });
  away = applyTimerAction(away, { type: 'start' }, 0);
  away = addGoal(away, { team: 'us', player: lars }, { quarter: 1, elapsedMs: 1000, at: 1 });
  assert.equal(isAway(away), true);
  assert.deepEqual(scoreboard(away, 'My Club'), [
    { side: 'them', name: 'KSV', goals: 0 },
    { side: 'us', name: 'My Club', goals: 1 },
  ]);
  assert.deepEqual(scoreboard(createMatch({ createdAt: 0 })).map((s) => s.name), ['Us', 'Opponent']);
});

test('goals cannot be recorded before kick-off', () => {
  const m = createMatch({ createdAt: 0 });
  assert.equal(addGoal(m, { team: 'us', player: lars }, { quarter: 0, elapsedMs: 0, at: 0 }), m);
});

test('score counts our goals (player/own goal/unknown) and opponent goals', () => {
  let m = liveMatch();
  m = addGoal(m, { team: 'us', player: lars }, { quarter: 1, elapsedMs: 30_000, at: 1 });
  m = addGoal(m, { team: 'us', kind: 'ownGoal' }, { quarter: 1, elapsedMs: 2 * MIN, at: 2 });
  m = addGoal(m, { team: 'us', kind: 'unknown' }, { quarter: 2, elapsedMs: 7 * MIN, at: 3 });
  m = addGoal(m, { team: 'them' }, { quarter: 2, elapsedMs: 16 * MIN, at: 4 });
  assert.deepEqual(score(m), { us: 3, them: 1 });
  const list = goalList(m);
  assert.deepEqual(list.map((g) => g.label), ['Lars', 'Own goal (opponent)', 'Unknown scorer', 'Opponent']);
  assert.deepEqual(list.map((g) => g.minute), ['1′', '3′', '23′', '30+2′']);
  assert.deepEqual(list.map((g) => g.clock), ['Q1 00:30', 'Q1 02:00', 'Q2 07:00', 'Q2 15:00+1:00']);
  assert.equal(list[0].elapsedMs, 30_000, 'exact time is stored, not just the minute');
  assert.equal(list[0].playerId, 'p07');
  assert.equal(list[1].playerId, null);
});

test('undo removes only the last goal, not timer events', () => {
  let m = liveMatch();
  m = addGoal(m, { team: 'us', player: lars }, { quarter: 1, elapsedMs: 1000, at: 1 });
  m = addGoal(m, { team: 'them' }, { quarter: 1, elapsedMs: 2000, at: 2 });
  m = applyTimerAction(m, { type: 'pause' }, 3000);
  const { match, removed } = undoLastGoal(m);
  assert.equal(removed.team, 'them');
  assert.deepEqual(score(match), { us: 1, them: 0 });
  assert.equal(match.events.filter((e) => e.type === 'pause').length, 1);
  assert.equal(lastGoal(match).playerName, 'Lars');
  const again = undoLastGoal(undoLastGoal(match).match);
  assert.equal(again.removed, null);
});

test('timer actions are logged and finishing sets status', () => {
  let m = liveMatch();
  m = applyTimerAction(m, { type: 'pause' }, 5000);
  m = applyTimerAction(m, { type: 'pause' }, 6000); // no-op, not logged
  m = applyTimerAction(m, { type: 'endQuarter' }, 7000);
  assert.deepEqual(m.events.map((e) => e.type), ['quarterStart', 'pause', 'quarterEnd']);
  assert.equal(m.events[2].elapsedMs, 5000);
  for (let q = 2; q <= 4; q++) {
    m = applyTimerAction(m, { type: 'startNext' }, q * 1e6);
    m = applyTimerAction(m, { type: 'endQuarter' }, q * 1e6 + 15 * MIN);
  }
  assert.equal(m.status, 'finished');
});

test('format helpers', () => {
  assert.equal(formatMs(0), '00:00');
  assert.equal(formatMs(7 * MIN + 30_999), '07:30');
  assert.equal(formatShort(MIN + 5000), '1:05');
  assert.equal(matchMinute(C, 1, 0), '1′');
  assert.equal(matchMinute(C, 4, 14 * MIN + 59_000), '60′');
  assert.equal(matchMinute(C, 4, 15 * MIN), '60+1′');
  assert.equal(quarterClock(C, 2, 7 * MIN + 12_400), 'Q2 07:12');
  assert.equal(quarterClock(C, 1, 16 * MIN + 20_000), 'Q1 15:00+1:20');
  assert.equal(parseMinSec('7:30'), 450_000);
  assert.equal(parseMinSec('8'), 480_000);
  assert.equal(parseMinSec('7:75'), null);
  assert.equal(parseMinSec('abc'), null);
});
