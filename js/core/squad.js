// Squad parsing/validation (pure). Accepts:
//  - JSON object: { "team": "...", "players": [ { "id": "p01", "name": "Lars", "number": 7 } ] }
//  - JSON array of players
//  - plain text: one player per line, optionally prefixed with a shirt number ("7 Lars" or "7. Lars")

export class SquadError extends Error {}

function slug(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'player';
}

// existingIds should include inactive players: their ids stay referenced by match history.
export function newPlayerId(name, existingIds) {
  const base = `p-${slug(name)}`;
  let id = base;
  for (let n = 2; existingIds.has(id); n++) id = `${base}-${n}`;
  return id;
}

// Validates a single player edit; others = the other active players. Returns { name, number }.
export function validatePlayer({ name, number }, others = []) {
  const errors = [];
  const trimmed = String(name ?? '').trim();
  if (!trimmed) errors.push('Name is missing.');
  let num = number == null || String(number).trim() === '' ? null : Number(number);
  if (num != null && !(Number.isInteger(num) && num >= 0 && num <= 99)) {
    errors.push('Shirt number must be 0-99.');
    num = null;
  }
  const lower = trimmed.toLowerCase();
  if (trimmed && others.some((p) => p.name.trim().toLowerCase() === lower)) errors.push(`There is already a player called "${trimmed}".`);
  if (errors.length) throw new SquadError(errors.join('\n'));
  return { name: trimmed, number: num };
}

function parseText(text) {
  const players = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = /^(\d{1,2})[.)]?\s+(.+)$/.exec(trimmed);
    players.push(m ? { number: Number(m[1]), name: m[2].trim() } : { name: trimmed });
  }
  return { players };
}

export function parseSquad(input) {
  const text = String(input ?? '').trim();
  if (!text) throw new SquadError('Squad is empty.');

  let data;
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new SquadError(`Invalid JSON: ${e.message}`);
    }
    if (Array.isArray(data)) data = { players: data };
  } else {
    data = parseText(text);
  }

  if (!data || !Array.isArray(data.players)) throw new SquadError('Expected a "players" list.');

  const errors = [];
  const ids = new Set();
  const players = data.players.map((p, i) => {
    const name = typeof p === 'string' ? p.trim() : String(p?.name ?? '').trim();
    if (!name) errors.push(`Player ${i + 1}: name is missing.`);
    let number = typeof p === 'object' && p.number != null && p.number !== '' ? Number(p.number) : null;
    if (number != null && !(Number.isInteger(number) && number >= 0 && number <= 99)) {
      errors.push(`${name || `Player ${i + 1}`}: shirt number must be 0-99.`);
      number = null;
    }
    let id = typeof p === 'object' && p.id != null ? String(p.id).trim() : '';
    if (id) {
      if (ids.has(id)) errors.push(`Duplicate id "${id}".`);
    } else {
      id = newPlayerId(name, ids);
    }
    ids.add(id);
    return { id, name, number, active: true };
  });

  if (!players.length) throw new SquadError('No players found.');
  if (errors.length) throw new SquadError(errors.join('\n'));

  const team = typeof data.team === 'string' ? data.team.trim() : '';
  return { team, players };
}

export function sortPlayers(players) {
  return [...players].sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name));
}
