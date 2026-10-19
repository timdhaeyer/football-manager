// Match history list (pure): finished matches only, newest first.
import { isAway, score } from './match.js';

const NL_DATE = new Intl.DateTimeFormat('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function historyRows(matches) {
  return matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((m) => {
      const { us, them } = score(m);
      return {
        id: m.id,
        createdAt: m.createdAt,
        dateNl: NL_DATE.format(new Date(m.createdAt)),
        opponent: m.opponent || 'Opponent',
        venue: isAway(m) ? 'away' : 'home',
        us,
        them,
        result: us > them ? 'W' : us < them ? 'L' : 'D',
        debug: Boolean(m.debug),
      };
    });
}
