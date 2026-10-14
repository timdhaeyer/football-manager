// Dutch, WhatsApp-friendly match summary for the parents (pure).
import { matchMinute } from './format.js';
import { isAway, score } from './match.js';

const NL_DATE = new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function matchSummaryNl(match, teamName = '') {
  const us = teamName || 'Wij';
  const them = match.opponent || 'Tegenstander';
  const away = isAway(match);
  const homeFirst = (u, t) => (away ? `${t}-${u}` : `${u}-${t}`);
  const finished = match.status === 'finished' || match.timer.phase === 'finished';
  const goals = match.events.filter((e) => e.type === 'goal');
  const s = score(match);

  const lines = [
    `⚽ ${away ? `${them} – ${us}` : `${us} – ${them}`}: ${homeFirst(s.us, s.them)}`,
    `${finished ? 'Eindstand' : 'Tussenstand'} · ${away ? 'uitwedstrijd' : 'thuiswedstrijd'} · ${NL_DATE.format(new Date(match.createdAt))}`,
    '',
  ];

  if (goals.length === 0) {
    lines.push('Geen doelpunten.');
  } else {
    lines.push('Doelpunten:');
    let u = 0;
    let t = 0;
    for (const g of goals) {
      if (g.team === 'us') u++;
      else t++;
      let who;
      if (g.team === 'them') who = them;
      else if (g.kind === 'ownGoal') who = `eigen doelpunt ${them}`;
      else if (g.kind === 'unknown') who = `${us} (doelpuntenmaker onbekend)`;
      else who = g.playerName;
      lines.push(`${matchMinute(match.config, g.quarter, g.elapsedMs)} ${who} (${homeFirst(u, t)})`);
    }
  }

  const played = match.timer.quarterDurationsMs.length;
  if (played > 0) {
    const perQuarter = [];
    for (let q = 1; q <= played; q++) {
      const upTo = goals.filter((g) => g.quarter <= q);
      const qu = upTo.filter((g) => g.team === 'us').length;
      perQuarter.push(`K${q} ${homeFirst(qu, upTo.length - qu)}`);
    }
    lines.push('', `Stand na elk kwart: ${perQuarter.join(' · ')}`);
  }

  const tally = new Map();
  for (const g of goals) {
    if (g.team !== 'us' || g.kind !== 'player') continue;
    tally.set(g.playerName, (tally.get(g.playerName) ?? 0) + 1);
  }
  if (tally.size > 0) {
    const ranked = [...tally].sort((a, b) => b[1] - a[1]); // stable: ties keep first-goal order
    lines.push(`Doelpuntenmakers: ${ranked.map(([name, n]) => `${name} ${n}`).join(', ')}`);
  }

  return lines.join('\n');
}
