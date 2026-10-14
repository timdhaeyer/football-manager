import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addGoal, applyTimerAction, createMatch } from '../js/core/match.js';
import { initials, matchSummaryNl, summaryModel } from '../js/core/summary.js';

const MIN = 60_000;
const haaland = { id: 'p09', name: 'Erling Haaland' };
const pedri = { id: 'p08', name: 'Pedri' };
const CREATED = Date.UTC(2026, 9, 17, 9, 0); // Saturday 17 October 2026

function playedMatch(venue) {
  let m = createMatch({ createdAt: CREATED, opponent: 'KSV Test', venue });
  let t = 0;
  m = applyTimerAction(m, { type: 'start' }, t);
  m = addGoal(m, { team: 'us', player: haaland }, { quarter: 1, elapsedMs: 2 * MIN + 21_000, at: 1 });
  m = addGoal(m, { team: 'them' }, { quarter: 1, elapsedMs: 16 * MIN, at: 2 });
  for (let q = 1; q <= 4; q++) {
    t += 16 * MIN;
    m = applyTimerAction(m, { type: 'endQuarter' }, t);
    if (q === 2) m = addGoal(m, { team: 'us', player: pedri }, { quarter: 2, elapsedMs: 7 * MIN, at: 3 });
    if (q < 4) m = applyTimerAction(m, { type: 'startNext' }, t);
  }
  m = addGoal(m, { team: 'us', kind: 'ownGoal' }, { quarter: 4, elapsedMs: 10 * MIN, at: 4 });
  m = addGoal(m, { team: 'us', player: haaland }, { quarter: 4, elapsedMs: 14 * MIN, at: 5 });
  return m;
}

test('home match summary in Dutch, home team first', () => {
  const text = matchSummaryNl(playedMatch('home'), 'SV Sottegem');
  assert.equal(text, [
    '⚽ SV Sottegem 4-1 KSV Test',
    'Eindstand · thuiswedstrijd · zaterdag 17 oktober 2026',
    '',
    'Doelpunten:',
    '3′ Erling Haaland (1-0)',
    '15+2′ KSV Test (1-1)',
    '23′ Pedri (2-1)',
    '56′ Own goal (3-1)',
    '60′ Erling Haaland (4-1)',
    '',
    'Doelpuntenmakers: Erling Haaland 2, Pedri 1',
  ].join('\n'));
});

test('away match lists the opponent first everywhere', () => {
  const text = matchSummaryNl(playedMatch('away'), 'SV Sottegem');
  assert.match(text, /^⚽ KSV Test 1-4 SV Sottegem\n/);
  assert.match(text, /uitwedstrijd/);
  assert.match(text, /3′ Erling Haaland \(0-1\)/);
  assert.doesNotMatch(text, /kwart/);
});

test('card model puts goals in home/away columns with running score', () => {
  const m = summaryModel(playedMatch('away'), 'SV Sottegem');
  assert.equal(m.home.name, 'KSV Test');
  assert.equal(m.away_.name, 'SV Sottegem');
  assert.equal(m.away_.mine, true);
  assert.deepEqual([m.home.score, m.away_.score], [1, 4]);
  assert.deepEqual(m.home.goals.map((g) => g.minute), ['15+2′']);
  assert.deepEqual(m.away_.goals.map((g) => [g.minute, g.kind, g.playerName]), [
    ['3′', 'player', 'Erling Haaland'],
    ['23′', 'player', 'Pedri'],
    ['56′', 'ownGoal', null],
    ['60′', 'player', 'Erling Haaland'],
  ]);
  assert.deepEqual(m.timeline.at(-1), { minute: '60′', team: 'us', kind: 'player', playerName: 'Erling Haaland', home: 1, away: 4 });
  assert.equal(m.statusNl, 'Eindstand');
});

test('opponent initials for the card', () => {
  assert.equal(initials('Olsa Brakel B'), 'OB');
  assert.equal(initials('KSV Test'), 'KT');
  assert.equal(initials('Eendracht'), 'E');
  assert.equal(initials('K. Olsa Brakel'), 'OB');
  assert.equal(initials(''), '?');
});

test('unfinished match without goals or names', () => {
  let m = createMatch({ createdAt: CREATED });
  m = applyTimerAction(m, { type: 'start' }, 0);
  m = addGoal(m, { team: 'us', kind: 'unknown' }, { quarter: 1, elapsedMs: MIN, at: 1 });
  const text = matchSummaryNl(m);
  assert.match(text, /^⚽ Wij 1-0 Tegenstander\nTussenstand/);
  assert.match(text, /2′ Wij \(doelpuntenmaker onbekend\) \(1-0\)/);
  assert.doesNotMatch(text, /Stand na elk kwart|Doelpuntenmakers/);
  const empty = matchSummaryNl(createMatch({ createdAt: CREATED, opponent: 'X' }), 'Y');
  assert.match(empty, /Geen doelpunten\./);
});
