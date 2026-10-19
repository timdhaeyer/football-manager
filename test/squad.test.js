import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newPlayerId, parseSquad, sortPlayers, SquadError, validatePlayer } from '../js/core/squad.js';

test('parses the example squad file', () => {
  const text = readFileSync(new URL('../squad.example.json', import.meta.url), 'utf8');
  const { team, players } = parseSquad(text);
  assert.ok(team.length > 0);
  assert.ok(players.length >= 8);
  assert.ok(players.every((p) => p.id && p.name && p.active));
});

test('parses a JSON array and generates stable ids', () => {
  const { players } = parseSquad('[{"name":"Lars","number":7},{"name":"Noé"},{"name":"Noé"}]');
  assert.deepEqual(players.map((p) => p.id), ['p-lars', 'p-noe', 'p-noe-2']);
  assert.equal(players[0].number, 7);
  assert.equal(players[1].number, null);
});

test('parses pasted plain text with optional shirt numbers', () => {
  const { team, players } = parseSquad('7 Lars\n# comment\n\n10. Mila\nJef');
  assert.equal(team, '');
  assert.deepEqual(players.map((p) => [p.name, p.number]), [['Lars', 7], ['Mila', 10], ['Jef', null]]);
});

test('rejects duplicates, missing names, bad numbers and bad JSON', () => {
  assert.throws(() => parseSquad('{"players":[{"id":"a","name":"X"},{"id":"a","name":"Y"}]}'), /Duplicate id/);
  assert.throws(() => parseSquad('{"players":[{"name":""}]}'), /name is missing/);
  assert.throws(() => parseSquad('{"players":[{"name":"X","number":123}]}'), /0-99/);
  assert.throws(() => parseSquad('{"players":'), SquadError);
  assert.throws(() => parseSquad(''), /empty/);
  assert.throws(() => parseSquad('{"team":"x"}'), /players/);
});

test('sorts by shirt number then name', () => {
  const sorted = sortPlayers([{ name: 'B' }, { name: 'A', number: 9 }, { name: 'C', number: 2 }, { name: 'A' }]);
  assert.deepEqual(sorted.map((p) => p.name), ['C', 'A', 'A', 'B']);
});

test('new player ids never collide, also with inactive players', () => {
  assert.equal(newPlayerId('Noé', new Set()), 'p-noe');
  assert.equal(newPlayerId('Noé', new Set(['p-noe', 'p-noe-2'])), 'p-noe-3');
});

test('validates a single player edit', () => {
  assert.deepEqual(validatePlayer({ name: ' Lars ', number: '7' }), { name: 'Lars', number: 7 });
  assert.deepEqual(validatePlayer({ name: 'Lars', number: '' }), { name: 'Lars', number: null });
  assert.throws(() => validatePlayer({ name: ' ', number: null }), /Name is missing/);
  assert.throws(() => validatePlayer({ name: 'X', number: '100' }), /0-99/);
  assert.throws(() => validatePlayer({ name: 'lars' }, [{ name: 'Lars' }]), /already/);
});
