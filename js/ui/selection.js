// Pre-match screen: choose which players are in the squad for this match.
import { todayFixture } from '../core/fixture.js';
import { sortPlayers } from '../core/squad.js';
import { $, confirmDialog, el, playerButton, toast } from './dom.js';

const TIME = new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit' });
const DATE_TIME = new Intl.DateTimeFormat('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

let app;
let selected = new Set();
let venue = 'home';
let fixtureId = null;

export function initSelection(appRef) {
  app = appRef;
  $('sel-home').addEventListener('click', () => setVenue('home'));
  $('sel-away').addEventListener('click', () => setVenue('away'));
  $('sel-settings').addEventListener('click', () => app.show('settings'));
  $('sel-import').addEventListener('click', () => app.show('settings'));
  $('sel-plan-btn').addEventListener('click', () => {
    const today = todayFixture(app.state.fixtures, Date.now());
    if (today) loadFixture(today);
    renderSelection();
  });
  $('sel-all').addEventListener('click', () => {
    selected = new Set(activePlayers().map((p) => p.id));
    renderSelection();
  });
  $('sel-none').addEventListener('click', () => {
    selected.clear();
    renderSelection();
  });
  $('sel-start').addEventListener('click', start);
}

function activePlayers() {
  return sortPlayers(app.state.players.filter((p) => p.active));
}

export function resetSelection(ids) {
  const active = new Set(activePlayers().map((p) => p.id));
  selected = new Set((ids ?? []).filter((id) => active.has(id)));
  venue = 'home';
  fixtureId = null;
}

export function loadFixture(f) {
  resetSelection(f.selection);
  venue = f.venue;
  fixtureId = f.id;
  $('sel-opponent').value = f.opponent;
}

function setVenue(v) {
  venue = v;
  renderSelection();
}

export function renderSelection() {
  const players = activePlayers();
  $('sel-home').setAttribute('aria-pressed', String(venue === 'home'));
  $('sel-away').setAttribute('aria-pressed', String(venue === 'away'));
  $('sel-team').textContent = app.state.team?.name || '';
  renderPlanBanner();
  $('sel-empty').hidden = players.length > 0;
  $('sel-count').textContent = players.length ? `${selected.size} of ${players.length} selected` : '';
  const list = $('sel-players');
  list.replaceChildren(
    ...players.map((p) =>
      el('li', {}, playerButton(p, {
        pressed: selected.has(p.id),
        onClick: () => {
          if (selected.has(p.id)) selected.delete(p.id);
          else selected.add(p.id);
          renderSelection();
        },
      })),
    ),
  );
}

function renderPlanBanner() {
  const loaded = fixtureId && app.state.fixtures.find((f) => f.id === fixtureId);
  const today = loaded ? null : todayFixture(app.state.fixtures, Date.now());
  const f = loaded || today;
  $('sel-plan').hidden = !f;
  if (!f) return;
  $('sel-plan-text').textContent = loaded
    ? `Planned: vs ${f.opponent}, ${DATE_TIME.format(f.kickoffAt)}`
    : `Today: vs ${f.opponent}, ${TIME.format(f.kickoffAt)}`;
  $('sel-plan-btn').hidden = Boolean(loaded);
}

async function start() {
  if (selected.size === 0) {
    const ok = await confirmDialog({
      title: 'No players selected',
      message: 'Goals can then only be recorded as "unknown scorer". Start anyway?',
      ok: 'Start',
    });
    if (!ok) return;
  }
  const opponent = $('sel-opponent').value;
  const order = activePlayers().map((p) => p.id).filter((id) => selected.has(id));
  await app.startMatch({ opponent, venue, selection: order, fixtureId });
  toast(app.state.match.debug ? `Debug match (${app.state.match.debug.speed}×)` : 'Match ready');
}
