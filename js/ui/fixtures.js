// Calendar tab: plan matches ahead (opponent, venue, kick-off, selection) and start one on match day.
import { canStart, createFixture, kickoffFromInputs, kickoffToInputs, splitFixtures, validateFixture } from '../core/fixture.js';
import { sortPlayers } from '../core/squad.js';
import { $, el, playerButton, toast, twoStep } from './dom.js';

const WHEN = new Intl.DateTimeFormat('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

let app;
let editing = null;
let deleteButton;

export function initFixtures(appRef) {
  app = appRef;
  $('fix-add').addEventListener('click', () => openEditor(null));
  $('fx-home').addEventListener('click', () => setVenue('home'));
  $('fx-away').addEventListener('click', () => setVenue('away'));
  $('fx-all').addEventListener('click', () => {
    editing.selected = new Set(activePlayers().map((p) => p.id));
    renderPlayers();
  });
  $('fx-none').addEventListener('click', () => {
    editing.selected.clear();
    renderPlayers();
  });
  $('fx-save').addEventListener('click', save);
  $('fx-cancel').addEventListener('click', close);
  $('fixture-sheet').addEventListener('click', (e) => { if (e.target.id === 'fixture-sheet') close(); });
  // Re-render so the Start button appears once the start window opens.
  setInterval(() => { if (app.state.view === 'fixtures' && !editing) renderFixtures(); }, 30_000);
  deleteButton = twoStep($('fx-delete'), {
    confirmLabel: 'Tap again to delete',
    onConfirm: async () => {
      await app.deleteFixture(editing.id);
      close();
      toast('Planned match deleted');
      renderFixtures();
    },
  });
}

function activePlayers() {
  return sortPlayers(app.state.players.filter((p) => p.active));
}

export function renderFixtures() {
  const now = Date.now();
  const { upcoming, past } = splitFixtures(app.state.fixtures, now);
  $('fix-empty').hidden = upcoming.length > 0;
  $('fix-list').replaceChildren(...upcoming.map((f) => row(f, false, canStart(f, now))));
  $('fix-past-title').hidden = past.length === 0;
  $('fix-past').replaceChildren(...past.map((f) => row(f, true, false)));
}

function row(f, past, startable) {
  const active = new Set(activePlayers().map((p) => p.id));
  const count = f.selection.filter((id) => active.has(id)).length;
  return el(
    'li',
    {},
    el(
      'button',
      { class: `btn row-main${past ? ' past' : ''}`, type: 'button', on: { click: () => openEditor(f) } },
      el('span', { class: 'row-text' },
        el('span', { class: 'title', textContent: `vs ${f.opponent}` }),
        el('span', { class: 'sub', textContent: `${WHEN.format(f.kickoffAt)} · ${f.venue === 'away' ? 'AWAY' : 'HOME'} · ${count} players` }),
      ),
    ),
    startable
      ? el('button', { class: 'btn btn-small btn-primary', type: 'button', textContent: 'Start', on: { click: () => start(f) } })
      : null,
  );
}

async function start(f) {
  const active = new Set(activePlayers().map((p) => p.id));
  await app.startMatch({ opponent: f.opponent, venue: f.venue, selection: f.selection.filter((id) => active.has(id)), fixtureId: f.id });
  toast(app.state.match.debug ? `Debug match (${app.state.match.debug.speed}×)` : 'Match ready');
}

function openEditor(f) {
  const active = new Set(activePlayers().map((p) => p.id));
  editing = {
    id: f?.id ?? null,
    createdAt: f?.createdAt,
    venue: f?.venue ?? 'home',
    selected: new Set((f?.selection ?? []).filter((id) => active.has(id))),
  };
  const { date, time } = kickoffToInputs(f?.kickoffAt);
  $('fx-title').textContent = f ? 'Edit planned match' : 'Plan match';
  $('fx-opponent').value = f?.opponent ?? '';
  $('fx-date').value = date;
  $('fx-time').value = time;
  $('fx-error').hidden = true;
  deleteButton.disarm();
  $('fx-delete').hidden = !f;
  setVenue(editing.venue);
  renderPlayers();
  $('fixture-sheet').hidden = false;
}

function close() {
  $('fixture-sheet').hidden = true;
  editing = null;
}

function setVenue(v) {
  editing.venue = v;
  $('fx-home').setAttribute('aria-pressed', String(v === 'home'));
  $('fx-away').setAttribute('aria-pressed', String(v === 'away'));
}

function renderPlayers() {
  const players = activePlayers();
  $('fx-count').textContent = players.length ? `${editing.selected.size} of ${players.length} selected` : 'No squad yet';
  $('fx-players').replaceChildren(
    ...players.map((p) =>
      el('li', {}, playerButton(p, {
        pressed: editing.selected.has(p.id),
        onClick: () => {
          if (editing.selected.has(p.id)) editing.selected.delete(p.id);
          else editing.selected.add(p.id);
          renderPlayers();
        },
      })),
    ),
  );
}

async function save() {
  const err = $('fx-error');
  const fixture = createFixture({
    id: editing.id ?? undefined,
    createdAt: editing.createdAt ?? Date.now(),
    opponent: $('fx-opponent').value,
    venue: editing.venue,
    kickoffAt: kickoffFromInputs($('fx-date').value, $('fx-time').value),
    selection: activePlayers().map((p) => p.id).filter((id) => editing.selected.has(id)),
  });
  try {
    validateFixture(fixture);
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
    return;
  }
  await app.saveFixture(fixture);
  close();
  toast('Match planned');
  renderFixtures();
}
