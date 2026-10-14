// Goal picker sheet: shows the match selection; captures the match time at the moment
// "+ Goal" was tapped, not when the scorer is chosen.
import { sortPlayers } from '../core/squad.js';
import { matchMinute, quarterClock } from '../core/format.js';
import { $, el, playerButton } from './dom.js';

let app;
let captured = null;

export function initGoalPicker(appRef) {
  app = appRef;
  $('picker-own').addEventListener('click', () => choose({ team: 'us', kind: 'ownGoal' }));
  $('picker-unknown').addEventListener('click', () => choose({ team: 'us', kind: 'unknown' }));
  $('picker-cancel').addEventListener('click', close);
  $('picker').addEventListener('click', (e) => { if (e.target.id === 'picker') close(); });
}

export function openGoalPicker(at) {
  captured = at;
  const { match, players } = app.state;
  const byId = new Map(players.map((p) => [p.id, p]));
  const squad = sortPlayers(match.selection.map((id) => byId.get(id)).filter(Boolean));
  $('picker-title').textContent = `Goal · ${matchMinute(match.config, at.quarter, at.elapsedMs)} (${quarterClock(match.config, at.quarter, at.elapsedMs)})`;
  $('picker-players').replaceChildren(
    ...squad.map((p) => el('li', {}, playerButton(p, { onClick: () => choose({ team: 'us', kind: 'player', player: p }) }))),
  );
  $('picker').hidden = false;
}

function choose(goal) {
  const at = captured;
  close();
  if (at) app.recordGoal(goal, at);
}

function close() {
  $('picker').hidden = true;
  captured = null;
}
