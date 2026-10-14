// Display formatting helpers (pure).

export function formatMs(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Short form for overtime/missed amounts: "1:05".
export function formatShort(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Football-style match minute: goal at 0:30 of Q1 is 1', at 7:10 of Q2 (15' quarters) is 23'.
// Goals in quarter overtime are shown as "15+2'".
export function matchMinute(config, quarter, elapsedMs) {
  const qMin = Math.round(config.quarterMs / 60000);
  const base = (quarter - 1) * qMin;
  if (elapsedMs < config.quarterMs) return `${base + Math.floor(elapsedMs / 60000) + 1}′`;
  return `${base + qMin}+${Math.floor((elapsedMs - config.quarterMs) / 60000) + 1}′`;
}

// Exact quarter clock with seconds: "Q2 07:12", or "Q1 15:00+1:20" in overtime.
export function quarterClock(config, quarter, elapsedMs) {
  if (elapsedMs < config.quarterMs) return `Q${quarter} ${formatMs(elapsedMs)}`;
  return `Q${quarter} ${formatMs(config.quarterMs)}+${formatShort(elapsedMs - config.quarterMs)}`;
}

export function parseMinSec(text) {
  const m = /^\s*(\d{1,3})(?::(\d{1,2}))?\s*$/.exec(String(text));
  if (!m) return null;
  const sec = m[2] === undefined ? 0 : Number(m[2]);
  if (sec > 59) return null;
  return (Number(m[1]) * 60 + sec) * 1000;
}
