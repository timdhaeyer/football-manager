// Renders the shareable result card (PNG) from the summary model, in the app's style:
// home team left, away team right, big score in the middle, goals under each team.
import { initials } from '../core/summary.js';

const W = 1080;
const PAD = 60;
const COLOR = {
  bg: '#0b0b0b',
  fg: '#ffffff',
  muted: '#a8a8a8',
  faint: '#5a5a5a',
  line: '#2a2a2a',
  tile: '#2a2a2a',
  yellow: '#f6db2d',
  blue: '#306ab5',
};
const FONT = 'Outfit, -apple-system, "Segoe UI", system-ui, sans-serif';
const TILE = 190;
const COL_X = [210, W - 210];
const NAME_LINE = 46;
const ROW = 58;

let crestPromise;
function loadCrest() {
  crestPromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'icons/icon-192.png';
  });
  return crestPromise;
}

async function ensureFonts() {
  if (!document.fonts?.load) return;
  await Promise.all(['800 100px Outfit', '600 32px Outfit', '500 30px Outfit'].map((f) => document.fonts.load(f))).catch(() => {});
}

const font = (weight, size) => `${weight} ${size}px ${FONT}`;

function fit(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function wrapTwoLines(ctx, text, maxW) {
  const lines = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (!cur || ctx.measureText(candidate).width <= maxW) cur = candidate;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) lines.splice(1, lines.length - 1, lines.slice(1).join(' '));
  return lines.map((l) => fit(ctx, l, maxW));
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function goalLabel(item) {
  if (item.team === 'them') return '';
  if (item.kind === 'ownGoal') return 'Eigen doelpunt';
  if (item.kind === 'unknown') return 'Onbekend';
  return item.playerName;
}

function drawTile(ctx, side, cx, top, crest) {
  const x = cx - TILE / 2;
  ctx.save();
  roundedRect(ctx, x, top, TILE, TILE, 28);
  if (side.mine && crest) {
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(crest, x, top, TILE, TILE);
  } else {
    ctx.fillStyle = COLOR.tile;
    ctx.fill();
    ctx.fillStyle = side.mine ? COLOR.yellow : COLOR.fg;
    ctx.font = font(800, 84);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(side.name), cx, top + TILE / 2 + 4);
  }
  ctx.restore();
}

// One goal row: "⚽ 23′ Name" on the left column, mirrored ("Name 23′ ⚽") on the right.
function drawGoalRow(ctx, item, y, right) {
  const maxW = W / 2 - PAD - 30;
  const label = goalLabel(item);
  ctx.textBaseline = 'middle';
  const parts = [
    { text: '⚽', style: font(500, 30), color: COLOR.fg },
    { text: item.minute, style: font(600, 32), color: COLOR.muted },
  ];
  if (label) {
    ctx.font = font(600, 32);
    const used = 40 + ctx.measureText(item.minute).width + 40;
    parts.push({ text: fit(ctx, label, maxW - used), style: font(600, 32), color: item.kind === 'player' ? COLOR.fg : COLOR.muted });
  }
  if (right) parts.reverse();
  let x = right ? W - PAD : PAD;
  for (const p of parts) {
    ctx.font = p.style;
    ctx.fillStyle = p.color;
    const w = ctx.measureText(p.text).width;
    ctx.textAlign = 'left';
    ctx.fillText(p.text, right ? x - w : x, y);
    x += right ? -(w + 16) : w + 16;
  }
}

export async function renderResultCard(model) {
  await ensureFonts();
  const crest = await loadCrest();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const sides = [model.home, model.away_];

  // Measure first, then size the canvas (resizing resets the context).
  ctx.font = font(800, 36);
  const names = sides.map((s) => wrapTwoLines(ctx, s.name, 330));
  const nameTop = 170 + TILE + 50;
  const goalsTop = nameTop + Math.max(...names.map((n) => n.length)) * NAME_LINE + 30;
  const rows = Math.max(1, model.home.goals.length, model.away_.goals.length);
  const height = goalsTop + 40 + rows * ROW + 40;
  canvas.width = W;
  canvas.height = height;

  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = COLOR.yellow;
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = COLOR.blue;
  ctx.fillRect(0, height - 14, W, 14);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLOR.muted;
  ctx.font = font(700, 30);
  ctx.fillText(`${model.statusNl} · ${model.venueNl}`.toUpperCase(), W / 2, 84);
  ctx.font = font(500, 30);
  ctx.fillText(model.dateNl, W / 2, 128);

  sides.forEach((side, i) => drawTile(ctx, side, COL_X[i], 170, crest));

  // Score
  const scoreY = 170 + TILE / 2 + 8;
  ctx.textBaseline = 'middle';
  ctx.font = font(800, 180);
  ctx.textAlign = 'right';
  ctx.fillStyle = model.home.mine ? COLOR.yellow : COLOR.fg;
  ctx.fillText(String(model.home.score), W / 2 - 42, scoreY);
  ctx.textAlign = 'left';
  ctx.fillStyle = model.away_.mine ? COLOR.yellow : COLOR.fg;
  ctx.fillText(String(model.away_.score), W / 2 + 42, scoreY);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.faint;
  ctx.font = font(800, 110);
  ctx.fillText('–', W / 2, scoreY - 8);

  // Team names
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(800, 36);
  names.forEach((lines, i) => {
    ctx.fillStyle = sides[i].mine ? COLOR.yellow : COLOR.fg;
    lines.forEach((line, j) => ctx.fillText(line, COL_X[i], nameTop + 36 + j * NAME_LINE));
  });

  // Goals per team
  ctx.fillStyle = COLOR.line;
  ctx.fillRect(PAD, goalsTop, W - 2 * PAD, 2);
  const firstRow = goalsTop + 40 + ROW / 2 - 10;
  if (model.timeline.length === 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(600, 32);
    ctx.fillStyle = COLOR.muted;
    ctx.fillText('Geen doelpunten', W / 2, firstRow);
  } else {
    model.home.goals.forEach((g, i) => drawGoalRow(ctx, g, firstRow + i * ROW, false));
    model.away_.goals.forEach((g, i) => drawGoalRow(ctx, g, firstRow + i * ROW, true));
  }
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
