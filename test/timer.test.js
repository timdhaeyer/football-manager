import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../js/core/clock.js';
import { DEFAULT_CONFIG as C, PHASE, derive, initialTimer, isMissed, reduce } from '../js/core/timer.js';

const MIN = 60_000;
const SEC = 1000;

function harness({ speed = 1 } = {}) {
  const t = { wall: 1_700_000_000_000, perf: 1000 };
  const opts = { wall: () => t.wall, perf: () => t.perf, speed, epochWall: t.wall };
  let clock = createClock(opts);
  let timer = initialTimer();
  return {
    t,
    get timer() { return timer; },
    set timer(v) { timer = v; },
    get clock() { return clock; },
    act(type) { timer = reduce(timer, { type }, clock.now(), C); return timer; },
    view() { return derive(timer, C, clock.now()); },
    advance(ms) { t.wall += ms; t.perf += ms; },
    sleep(ms) { t.wall += ms; },
    resumeFromBackground() { clock.reanchor(); },
    restart() {
      timer = JSON.parse(JSON.stringify(timer));
      t.perf = 42; // new page load: performance.now() restarts
      clock = createClock(opts);
    },
  };
}

test('start → elapsed grows from timestamps', () => {
  const h = harness();
  h.act('start');
  assert.equal(h.timer.phase, PHASE.RUNNING);
  assert.equal(h.timer.quarter, 1);
  h.advance(90 * SEC);
  assert.equal(h.view().elapsedMs, 90 * SEC);
});

test('pause/resume over several cycles is exact', () => {
  const h = harness();
  h.act('start');
  let played = 0;
  for (let i = 0; i < 5; i++) {
    h.advance(37 * SEC); played += 37 * SEC;
    h.act('pause');
    assert.equal(h.timer.startedAtWall, null);
    assert.equal(h.timer.accumulatedMs, played);
    h.advance(20 * SEC); // paused time must not count
    assert.equal(h.view().elapsedMs, played);
    h.act('resume');
  }
  h.advance(3 * SEC); played += 3 * SEC;
  assert.equal(h.view().elapsedMs, played);
});

test('background gap with frozen perf clock is recovered on visibility', () => {
  const h = harness();
  h.act('start');
  h.advance(2 * MIN);
  h.sleep(4 * MIN); // screen locked
  h.resumeFromBackground();
  assert.equal(h.view().elapsedMs, 6 * MIN);
});

test('restart recovery: killed app resumes with correct elapsed (running)', () => {
  const h = harness();
  h.act('start');
  h.advance(9 * MIN);
  h.sleep(60 * SEC); // app killed for a minute
  h.restart();
  assert.equal(h.view().elapsedMs, 10 * MIN);
  h.advance(SEC);
  assert.equal(h.view().elapsedMs, 10 * MIN + SEC);
});

test('restart recovery while paused keeps the frozen value', () => {
  const h = harness();
  h.act('start');
  h.advance(5 * MIN);
  h.act('pause');
  h.sleep(10 * MIN);
  h.restart();
  assert.equal(h.view().elapsedMs, 5 * MIN);
  h.act('resume');
  h.advance(SEC);
  assert.equal(h.view().elapsedMs, 5 * MIN + SEC);
});

test('reminder fires once at 7:30', () => {
  const h = harness();
  h.act('start');
  h.advance(7 * MIN + 29 * SEC);
  assert.equal(h.view().reminderDue, false);
  h.advance(SEC);
  const v = h.view();
  assert.equal(v.reminderDue, true);
  assert.equal(isMissed(v.reminderLateMs), false);
  h.act('ackReminder');
  h.advance(SEC);
  assert.equal(h.view().reminderDue, false);
});

test('missed reminder after background is due immediately with lateness', () => {
  const h = harness();
  h.act('start');
  h.advance(6 * MIN);
  h.sleep(3 * MIN + 10 * SEC); // locked across 7:30
  h.resumeFromBackground();
  const v = h.view();
  assert.equal(v.elapsedMs, 9 * MIN + 10 * SEC);
  assert.equal(v.reminderDue, true);
  assert.equal(v.reminderLateMs, MIN + 40 * SEC);
  assert.equal(isMissed(v.reminderLateMs), true);
  assert.equal(v.endDue, false);
});

test('missed reminder and quarter end are both due together', () => {
  const h = harness();
  h.act('start');
  h.advance(5 * MIN);
  h.sleep(11 * MIN);
  h.restart();
  const v = h.view();
  assert.equal(v.reminderDue, true);
  assert.equal(v.endDue, true);
  assert.equal(v.overtimeMs, MIN);
});

test('quarter end shows overtime and the clock keeps running', () => {
  const h = harness();
  h.act('start');
  h.advance(15 * MIN);
  let v = h.view();
  assert.equal(v.endDue, true);
  assert.equal(v.isOvertime, true);
  h.act('ackReminder');
  h.act('ackEnd');
  h.advance(90 * SEC);
  v = h.view();
  assert.equal(h.timer.phase, PHASE.RUNNING);
  assert.equal(v.overtimeMs, 90 * SEC);
  assert.equal(v.endDue, false);
});

test('end quarter → break → next quarter resets clock and alert flags', () => {
  const h = harness();
  h.act('start');
  h.advance(15 * MIN + 42 * SEC);
  h.act('ackReminder');
  h.act('ackEnd');
  h.act('endQuarter');
  assert.equal(h.timer.phase, PHASE.BREAK);
  assert.deepEqual(h.timer.quarterDurationsMs, [15 * MIN + 42 * SEC]);
  h.advance(5 * MIN); // break time does not count
  assert.equal(h.view().elapsedMs, 15 * MIN + 42 * SEC);
  assert.equal(h.view().endDue, false);
  h.act('startNext');
  assert.equal(h.timer.quarter, 2);
  assert.equal(h.timer.reminderFired, false);
  assert.equal(h.timer.endAlertFired, false);
  assert.equal(h.view().elapsedMs, 0);
});

test('end quarter while paused uses the paused value', () => {
  const h = harness();
  h.act('start');
  h.advance(14 * MIN);
  h.act('pause');
  h.advance(2 * MIN);
  h.act('endQuarter');
  assert.deepEqual(h.timer.quarterDurationsMs, [14 * MIN]);
});

test('last quarter end finishes the match', () => {
  const h = harness();
  h.act('start');
  for (let q = 1; q <= 4; q++) {
    h.advance(15 * MIN);
    h.act('endQuarter');
    if (q < 4) h.act('startNext');
  }
  assert.equal(h.timer.phase, PHASE.FINISHED);
  assert.equal(h.timer.quarterDurationsMs.length, 4);
});

test('invalid transitions are no-ops (same object)', () => {
  const h = harness();
  for (const type of ['pause', 'resume', 'endQuarter', 'startNext', 'ackReminder', 'ackEnd', 'bogus']) {
    const before = h.timer;
    assert.equal(h.act(type), before, type);
  }
  h.act('start');
  for (const type of ['start', 'resume', 'startNext']) {
    const before = h.timer;
    assert.equal(h.act(type), before, type);
  }
});

test('no alerts during break or before start', () => {
  const h = harness();
  assert.equal(h.view().reminderDue, false);
  h.act('start');
  h.advance(16 * MIN);
  h.act('endQuarter');
  const v = h.view();
  assert.equal(v.reminderDue, false);
  assert.equal(v.endDue, false);
});

test('reminder can be disabled with reminderAtMs = 0', () => {
  const cfg = { ...C, reminderAtMs: 0 };
  let timer = reduce(initialTimer(), { type: 'start' }, 0, cfg);
  assert.equal(derive(timer, cfg, 10 * MIN).reminderDue, false);
});

test('debug 60x: a 15-minute quarter takes 15 real seconds, also after restart', () => {
  const h = harness({ speed: 60 });
  h.act('start');
  h.advance(7 * SEC);
  h.restart();
  h.advance(8 * SEC);
  const v = h.view();
  assert.equal(v.elapsedMs, 15 * MIN);
  assert.equal(v.endDue, true);
});
