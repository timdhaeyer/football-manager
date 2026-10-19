import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyRows } from '../js/core/history.js';
import { addGoal, createMatch } from '../js/core/match.js';

const at = { quarter: 1, elapsedMs: 60_000, at: 0 };

function finished(createdAt, { venue = 'home', us = 0, them = 0, status = 'finished', debug = false } = {}) {
  let m = { ...createMatch({ createdAt, opponent: 'Opp', venue, debug }), status };
  m.timer = { ...m.timer, phase: 'running' };
  for (let i = 0; i < us; i++) m = addGoal(m, { team: 'us' }, at);
  for (let i = 0; i < them; i++) m = addGoal(m, { team: 'them' }, at);
  return m;
}

test('lists only finished matches, newest first', () => {
  const rows = historyRows([
    finished(1000),
    finished(3000),
    finished(2000, { status: 'abandoned' }),
    finished(4000, { status: 'live' }),
  ]);
  assert.deepEqual(rows.map((r) => r.createdAt), [3000, 1000]);
});

test('result is from our point of view, also away', () => {
  const [win, draw, loss] = historyRows([
    finished(3000, { venue: 'away', us: 2, them: 1 }),
    finished(2000, { us: 1, them: 1 }),
    finished(1000, { venue: 'away', us: 0, them: 3 }),
  ]);
  assert.deepEqual([win.result, win.venue, win.us, win.them], ['W', 'away', 2, 1]);
  assert.equal(draw.result, 'D');
  assert.equal(loss.result, 'L');
});

test('flags debug matches and defaults the opponent name', () => {
  const m = { ...finished(1000, { debug: { speed: 60, epochWall: 0 } }), opponent: '' };
  const [row] = historyRows([m]);
  assert.equal(row.debug, true);
  assert.equal(row.opponent, 'Opponent');
});
