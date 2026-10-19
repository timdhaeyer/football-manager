import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FixtureError, canStart, createFixture, kickoffFromInputs, kickoffToInputs, splitFixtures, todayFixture, validateFixture,
} from '../js/core/fixture.js';

const local = (y, mo, d, h = 10, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

test('creates a normalised fixture', () => {
  const f = createFixture({ opponent: '  KAA Gent ', venue: 'x', kickoffAt: 5, selection: ['a'], createdAt: 1, id: 'f1' });
  assert.deepEqual(f, { id: 'f1', schemaVersion: 1, createdAt: 1, opponent: 'KAA Gent', venue: 'home', kickoffAt: 5, selection: ['a'] });
  assert.match(createFixture({}).id, /^f_/);
});

test('validates opponent and kick-off', () => {
  assert.throws(() => validateFixture(createFixture({ kickoffAt: 1 })), /Opponent/);
  assert.throws(() => validateFixture(createFixture({ opponent: 'X' })), FixtureError);
  assert.doesNotThrow(() => validateFixture(createFixture({ opponent: 'X', kickoffAt: 1 })));
});

test('converts date/time inputs in local time, both ways', () => {
  const ms = kickoffFromInputs('2026-10-25', '09:30');
  assert.equal(ms, local(2026, 10, 25, 9, 30));
  assert.deepEqual(kickoffToInputs(ms), { date: '2026-10-25', time: '09:30' });
  assert.equal(kickoffFromInputs('', '09:30'), null);
  assert.equal(kickoffFromInputs('2026-10-25', ''), null);
  assert.deepEqual(kickoffToInputs(null), { date: '', time: '' });
});

test('splits upcoming (incl. earlier today) from past days', () => {
  const now = local(2026, 10, 25, 14);
  const fixtures = [
    createFixture({ id: 'next', kickoffAt: local(2026, 11, 1) }),
    createFixture({ id: 'morning', kickoffAt: local(2026, 10, 25, 9) }),
    createFixture({ id: 'old', kickoffAt: local(2026, 10, 18) }),
    createFixture({ id: 'older', kickoffAt: local(2026, 10, 11) }),
  ];
  const { upcoming, past } = splitFixtures(fixtures, now);
  assert.deepEqual(upcoming.map((f) => f.id), ['morning', 'next']);
  assert.deepEqual(past.map((f) => f.id), ['old', 'older']);
});

test('finds today\'s fixture around midnight', () => {
  const fixtures = [createFixture({ id: 'sat', kickoffAt: local(2026, 10, 25, 10) })];
  assert.equal(todayFixture(fixtures, local(2026, 10, 25, 0, 1))?.id, 'sat');
  assert.equal(todayFixture(fixtures, local(2026, 10, 25, 23, 59))?.id, 'sat');
  assert.equal(todayFixture(fixtures, local(2026, 10, 24, 23, 59)), null);
  assert.equal(todayFixture(fixtures, local(2026, 10, 26, 0, 0)), null);
});

test('can be started from 1 hour before kick-off until the end of that day', () => {
  const f = createFixture({ kickoffAt: local(2026, 10, 25, 10) });
  assert.equal(canStart(f, local(2026, 10, 25, 8, 59)), false);
  assert.equal(canStart(f, local(2026, 10, 25, 9, 0)), true);
  assert.equal(canStart(f, local(2026, 10, 25, 12)), true);
  assert.equal(canStart(f, local(2026, 10, 26, 9)), false);
});
