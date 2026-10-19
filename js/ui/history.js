// History tab: finished matches, newest first. Tap to reopen the result card and share or delete.
import { historyRows } from '../core/history.js';
import { $, el, toast } from './dom.js';
import { openShare } from './share.js';

let app;
let renderSeq = 0;

export function initHistory(appRef) {
  app = appRef;
}

export async function renderHistory() {
  const seq = ++renderSeq;
  const rows = historyRows(await app.listMatches());
  if (seq !== renderSeq) return;
  $('hist-empty').hidden = rows.length > 0;
  $('hist-list').replaceChildren(...rows.map(row));
}

function row(r) {
  const badges = [r.venue === 'away' ? 'AWAY' : 'HOME', r.debug ? 'DEBUG' : null].filter(Boolean).join(' · ');
  return el(
    'li',
    {},
    el(
      'button',
      { class: 'btn row-main', type: 'button', on: { click: () => open(r.id) } },
      el('span', { class: 'row-text' },
        el('span', { class: 'title', textContent: `vs ${r.opponent}` }),
        el('span', { class: 'sub', textContent: `${r.dateNl} · ${badges}` }),
      ),
      el('span', { class: `row-score ${r.result}`, textContent: `${r.us}–${r.them}` }),
    ),
  );
}

async function open(id) {
  const match = await app.getMatch(id);
  if (!match) return renderHistory();
  openShare(match, {
    onDelete: async () => {
      await app.deleteMatch(id);
      toast('Match deleted');
      renderHistory();
    },
  });
}
