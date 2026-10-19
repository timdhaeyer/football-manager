// Planned matches (pure). A fixture becomes a match when it is started on match day.
import { newId } from './match.js';

export const FIXTURE_SCHEMA_VERSION = 1;
export const START_WINDOW_MS = 60 * 60 * 1000;

export class FixtureError extends Error {}

export function createFixture({ opponent = '', venue = 'home', kickoffAt = null, selection = [], createdAt = Date.now(), id = newId('f_') }) {
  return {
    id,
    schemaVersion: FIXTURE_SCHEMA_VERSION,
    createdAt,
    opponent: opponent.trim(),
    venue: venue === 'away' ? 'away' : 'home',
    kickoffAt,
    selection: [...selection],
  };
}

export function validateFixture(f) {
  const errors = [];
  if (!f.opponent) errors.push('Opponent is missing.');
  if (!Number.isFinite(f.kickoffAt)) errors.push('Pick a date and kick-off time.');
  if (errors.length) throw new FixtureError(errors.join('\n'));
  return f;
}

// "2026-10-25" + "10:00" → epoch ms in local time, or null.
export function kickoffFromInputs(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !/^\d{2}:\d{2}$/.test(time ?? '')) return null;
  const ms = new Date(`${date}T${time}`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function kickoffToInputs(kickoffAt) {
  if (!Number.isFinite(kickoffAt)) return { date: '', time: '' };
  const d = new Date(kickoffAt);
  const pad = (n) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

function startOfDay(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Upcoming includes today (soonest first); past = an earlier day and never started (most recent first).
export function splitFixtures(fixtures, now) {
  const today = startOfDay(now);
  const upcoming = fixtures.filter((f) => f.kickoffAt >= today).sort((a, b) => a.kickoffAt - b.kickoffAt);
  const past = fixtures.filter((f) => f.kickoffAt < today).sort((a, b) => b.kickoffAt - a.kickoffAt);
  return { upcoming, past };
}

export function todayFixture(fixtures, now) {
  const today = startOfDay(now);
  return splitFixtures(fixtures, now).upcoming.find((f) => startOfDay(f.kickoffAt) === today) ?? null;
}

// Startable from 1 hour before kick-off until the end of that day.
export function canStart(f, now) {
  return now >= f.kickoffAt - START_WINDOW_MS && startOfDay(now) === startOfDay(f.kickoffAt);
}
