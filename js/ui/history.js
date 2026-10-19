// History tab: finished matches, newest first. Tap to reopen the result card; swipe left to delete.
import { historyRows } from '../core/history.js';
import { $, el, toast } from './dom.js';
import { openShare } from './share.js';

const REVEAL_PX = 96;

let app;
let renderSeq = 0;
let openRow = null;

export function initHistory(appRef) {
  app = appRef;
  $('view-history').addEventListener('pointerdown', (e) => {
    if (openRow && !openRow.contains(e.target)) closeRow();
  });
}

export async function renderHistory() {
  const seq = ++renderSeq;
  const rows = historyRows(await app.listMatches());
  if (seq !== renderSeq) return;
  openRow = null;
  $('hist-empty').hidden = rows.length > 0;
  $('hist-list').replaceChildren(...rows.map(row));
}

function row(r) {
  const badges = [r.venue === 'away' ? 'AWAY' : 'HOME', r.debug ? 'DEBUG' : null].filter(Boolean).join(' · ');
  const main = el(
    'button',
    { class: 'btn row-main', type: 'button' },
    el('span', { class: 'row-text' },
      el('span', { class: 'title', textContent: `vs ${r.opponent}` }),
      el('span', { class: 'sub', textContent: `${r.dateNl} · ${badges}` }),
    ),
    el('span', { class: `row-score ${r.result}`, textContent: `${r.us}–${r.them}` }),
  );
  const del = el('button', {
    class: 'swipe-delete',
    type: 'button',
    textContent: 'Delete',
    tabIndex: -1,
    on: { click: () => remove(r.id) },
  });
  const li = el('li', { class: 'swipe' }, del, main);
  swipeable(li, main, () => open(r.id));
  return li;
}

function setOffset(li, px, animate) {
  const main = li.querySelector('.row-main');
  main.style.transition = animate ? 'transform 0.2s ease' : 'none';
  main.style.transform = px ? `translateX(${px}px)` : '';
  li.classList.toggle('revealed', px !== 0);
}

function closeRow() {
  if (openRow) setOffset(openRow, 0, true);
  openRow = null;
}

// Horizontal drags reveal the Delete button; vertical drags are left to the browser for scrolling.
function swipeable(li, main, onTap) {
  let start = null;
  let dx = 0;
  let dragging = false;
  let suppressClick = false;

  main.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, base: openRow === li ? -REVEAL_PX : 0 };
    dx = 0;
    dragging = false;
    suppressClick = false;
  });
  main.addEventListener('pointermove', (e) => {
    if (!start) return;
    const mx = e.clientX - start.x;
    const my = e.clientY - start.y;
    if (!dragging) {
      if (Math.abs(mx) < 10 || Math.abs(mx) < Math.abs(my)) return;
      dragging = true;
      main.setPointerCapture(e.pointerId);
      if (openRow && openRow !== li) closeRow();
    }
    dx = mx;
    setOffset(li, Math.min(0, Math.max(-REVEAL_PX * 1.4, start.base + dx)), false);
  });
  const end = () => {
    if (!start) return;
    if (dragging) {
      suppressClick = true;
      const reveal = start.base + dx < -REVEAL_PX / 2;
      setOffset(li, reveal ? -REVEAL_PX : 0, true);
      openRow = reveal ? li : openRow === li ? null : openRow;
    }
    start = null;
  };
  main.addEventListener('pointerup', end);
  main.addEventListener('pointercancel', () => {
    if (dragging) end();
    start = null;
  });
  main.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (openRow === li) return closeRow();
    onTap();
  });
}

async function remove(id) {
  openRow = null;
  await app.deleteMatch(id);
  toast('Match deleted');
  renderHistory();
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
