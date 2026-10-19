// Squad tab: team name, add / rename / renumber players, mark them inactive. Ids never change.
import { newPlayerId, sortPlayers, validatePlayer } from '../core/squad.js';
import { $, el, playerButton, toast } from './dom.js';

let app;
let editing = null;

export function initTeam(appRef) {
  app = appRef;
  $('squad-team').addEventListener('change', async (e) => {
    await app.saveTeamName(e.target.value.trim());
    toast('Team name saved');
  });
  $('squad-add').addEventListener('click', () => openEditor(null));
  $('pl-active').addEventListener('click', () => setActive(true));
  $('pl-inactive').addEventListener('click', () => setActive(false));
  $('pl-save').addEventListener('click', save);
  $('pl-cancel').addEventListener('click', close);
  $('player-sheet').addEventListener('click', (e) => { if (e.target.id === 'player-sheet') close(); });
}

export function renderTeam() {
  const { players, team } = app.state;
  $('squad-team').value = team?.name ?? '';
  const active = sortPlayers(players.filter((p) => p.active));
  const inactive = sortPlayers(players.filter((p) => !p.active));
  $('squad-count').textContent = active.length ? `${active.length} active players. Tap a player to edit.` : 'No players yet.';
  const item = (p) => el('li', {}, playerButton(p, { onClick: () => openEditor(p) }));
  $('squad-active').replaceChildren(...active.map(item));
  $('squad-inactive-wrap').hidden = inactive.length === 0;
  $('squad-inactive-title').textContent = `Inactive (${inactive.length})`;
  $('squad-inactive').replaceChildren(...inactive.map(item));
}

function openEditor(p) {
  editing = { player: p, active: p?.active ?? true };
  $('pl-title').textContent = p ? 'Edit player' : 'Add player';
  $('pl-name').value = p?.name ?? '';
  $('pl-number').value = p?.number ?? '';
  $('pl-error').hidden = true;
  setActive(editing.active);
  $('player-sheet').hidden = false;
}

function close() {
  $('player-sheet').hidden = true;
  editing = null;
}

function setActive(active) {
  editing.active = active;
  $('pl-active').setAttribute('aria-pressed', String(active));
  $('pl-inactive').setAttribute('aria-pressed', String(!active));
}

async function save() {
  const { players } = app.state;
  const self = editing.player;
  const others = editing.active ? players.filter((p) => p.active && p.id !== self?.id) : [];
  let fields;
  try {
    fields = validatePlayer({ name: $('pl-name').value, number: $('pl-number').value }, others);
  } catch (e) {
    $('pl-error').textContent = e.message;
    $('pl-error').hidden = false;
    return;
  }
  const id = self?.id ?? newPlayerId(fields.name, new Set(players.map((p) => p.id)));
  await app.savePlayer({ ...self, id, ...fields, active: editing.active });
  close();
  toast(self ? 'Player saved' : 'Player added');
  renderTeam();
}
