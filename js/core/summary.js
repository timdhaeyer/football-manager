// Dutch match summary for the parents (pure). One model drives both the WhatsApp text
// and the shareable result card image, so they can never disagree.
import { matchMinute } from './format.js';
import { isAway, score } from './match.js';

const NL_DATE = new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function initials(name) {
  const words = String(name).trim().split(/\s+/).filter((w) => (w.match(/\p{L}/gu) ?? []).length > 1);
  const letters = words.slice(0, 2).map((w) => w.match(/\p{L}/u)[0].toUpperCase());
  return letters.join('') || '?';
}

export function summaryModel(match, teamName = '') {
  const usName = teamName || 'Wij';
  const themName = match.opponent || 'Tegenstander';
  const away = isAway(match);
  const s = score(match);
  const us = { name: usName, score: s.us, mine: true, goals: [] };
  const them = { name: themName, score: s.them, mine: false, goals: [] };
  const [home, awaySide] = away ? [them, us] : [us, them];
  const toHomeAway = (u, t) => (away ? { home: t, away: u } : { home: u, away: t });

  const timeline = [];
  let u = 0;
  let t = 0;
  for (const g of match.events) {
    if (g.type !== 'goal') continue;
    if (g.team === 'us') u++;
    else t++;
    const item = {
      minute: matchMinute(match.config, g.quarter, g.elapsedMs),
      team: g.team,
      kind: g.team === 'us' ? g.kind : 'opponent',
      playerName: g.playerName ?? null,
      ...toHomeAway(u, t),
    };
    timeline.push(item);
    (g.team === 'us' ? us : them).goals.push(item);
  }

  const tally = new Map();
  for (const g of match.events) {
    if (g.type === 'goal' && g.team === 'us' && g.kind === 'player') tally.set(g.playerName, (tally.get(g.playerName) ?? 0) + 1);
  }
  const scorers = [...tally].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

  return {
    finished: match.status === 'finished' || match.timer.phase === 'finished',
    away,
    statusNl: match.status === 'finished' || match.timer.phase === 'finished' ? 'Eindstand' : 'Tussenstand',
    venueNl: away ? 'uitwedstrijd' : 'thuiswedstrijd',
    dateNl: NL_DATE.format(new Date(match.createdAt)),
    home,
    away_: awaySide,
    us,
    them,
    timeline,
    scorers,
  };
}

// Label for a goal line in the text summary.
function textLabel(item, m) {
  if (item.team === 'them') return m.them.name;
  if (item.kind === 'ownGoal') return `eigen doelpunt ${m.them.name}`;
  if (item.kind === 'unknown') return `${m.us.name} (doelpuntenmaker onbekend)`;
  return item.playerName;
}

export function matchSummaryNl(match, teamName = '') {
  const m = summaryModel(match, teamName);
  const lines = [
    `⚽ ${m.home.name} ${m.home.score}-${m.away_.score} ${m.away_.name}`,
    `${m.statusNl} · ${m.venueNl} · ${m.dateNl}`,
    '',
  ];
  if (m.timeline.length === 0) {
    lines.push('Geen doelpunten.');
  } else {
    lines.push('Doelpunten:');
    for (const item of m.timeline) lines.push(`${item.minute} ${textLabel(item, m)} (${item.home}-${item.away})`);
  }
  if (m.scorers.length) {
    lines.push('', `Doelpuntenmakers: ${m.scorers.map((s) => `${s.name} ${s.count}`).join(', ')}`);
  }
  return lines.join('\n');
}
