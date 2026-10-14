import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../js/core/clock.js';

function fakeTime(wall0 = 1_700_000_000_000, perf0 = 5000) {
  const t = { wall: wall0, perf: perf0 };
  return {
    t,
    wall: () => t.wall,
    perf: () => t.perf,
    advance(ms) { t.wall += ms; t.perf += ms; },
    sleep(ms) { t.wall += ms; }, // iOS: perf frozen while device sleeps
  };
}

test('now() follows the perf clock in the foreground', () => {
  const f = fakeTime();
  const clock = createClock(f);
  const start = clock.now();
  f.advance(1234);
  assert.equal(clock.now() - start, 1234);
});

test('reanchor corrects a frozen perf clock after sleep', () => {
  const f = fakeTime();
  const clock = createClock(f);
  const start = clock.now();
  f.sleep(4 * 60_000);
  assert.equal(clock.now() - start, 0, 'perf frozen: not yet corrected');
  const drift = clock.reanchor();
  assert.equal(drift, 4 * 60_000);
  assert.equal(clock.now() - start, 4 * 60_000);
});

test('never goes backwards when the wall clock is set back', () => {
  const f = fakeTime();
  const clock = createClock(f);
  f.advance(10_000);
  const before = clock.now();
  f.t.wall -= 60_000;
  clock.reanchor();
  assert.ok(clock.now() >= before);
  f.advance(500);
  assert.ok(clock.now() >= before);
});

test('debug speed scales both perf and wall, reproducibly across restarts', () => {
  const f = fakeTime();
  const epochWall = f.t.wall;
  const clock = createClock({ ...f, speed: 60, epochWall });
  const start = clock.now();
  f.advance(1000);
  assert.equal(clock.now() - start, 60_000);

  // "Restart": new perf origin, same epoch → same scaled timeline.
  f.advance(1000);
  f.t.perf = 0;
  const restarted = createClock({ ...f, speed: 60, epochWall });
  assert.equal(restarted.now() - start, 120_000);
});
