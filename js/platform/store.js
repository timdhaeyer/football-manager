// IndexedDB persistence. Stores: players, matches, fixtures (keyPath id), meta (key → value).
import { openDB } from '../vendor/idb.js';

const DB_NAME = 'football-manager';
const DB_VERSION = 2;

let dbPromise;

function db() {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('players', { keyPath: 'id' });
        const matches = d.createObjectStore('matches', { keyPath: 'id' });
        matches.createIndex('createdAt', 'createdAt');
        matches.createIndex('status', 'status');
        d.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        d.createObjectStore('fixtures', { keyPath: 'id' }).createIndex('kickoffAt', 'kickoffAt');
      }
    },
  });
  return dbPromise;
}

export async function getMeta(key, fallback = undefined) {
  const v = await (await db()).get('meta', key);
  return v === undefined ? fallback : v;
}

export async function setMeta(key, value) {
  await (await db()).put('meta', value, key);
}

export async function getPlayers() {
  return (await db()).getAll('players');
}

// Replaces the squad: imported players become active, players missing from the
// import are kept but marked inactive (their ids may be referenced by match history).
export async function importSquad({ team, players }) {
  const d = await db();
  const tx = d.transaction(['players', 'meta'], 'readwrite');
  const store = tx.objectStore('players');
  const incoming = new Set(players.map((p) => p.id));
  for (const existing of await store.getAll()) {
    if (!incoming.has(existing.id) && existing.active) await store.put({ ...existing, active: false });
  }
  for (const p of players) await store.put({ ...p, active: true });
  if (team) await tx.objectStore('meta').put({ name: team }, 'team');
  await tx.done;
}

export async function savePlayer(player) {
  await (await db()).put('players', player);
}

export async function saveTeam(name) {
  await (await db()).put('meta', { name }, 'team');
}

export async function listMatches() {
  return (await db()).getAllFromIndex('matches', 'createdAt');
}

export async function getMatch(id) {
  return (await db()).get('matches', id);
}

export async function saveMatch(match) {
  await (await db()).put('matches', match);
}

export async function deleteMatch(id) {
  await (await db()).delete('matches', id);
}

export async function getFixtures() {
  return (await db()).getAll('fixtures');
}

export async function saveFixture(fixture) {
  await (await db()).put('fixtures', fixture);
}

export async function deleteFixture(id) {
  await (await db()).delete('fixtures', id);
}

export async function requestPersistence() {
  if (!navigator.storage?.persist) return 'unsupported';
  try {
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'error';
  }
}
