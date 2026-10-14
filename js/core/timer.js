// Pure match-timer state machine. All times are in the wall-clock domain
// (values from MatchClock.now()). Nothing here counts ticks or holds live time.

export const PHASE = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  BREAK: 'break',
  FINISHED: 'finished',
});

export const DEFAULT_CONFIG = Object.freeze({
  quarterCount: 4,
  quarterMs: 15 * 60 * 1000,
  reminderAtMs: 7.5 * 60 * 1000, // 0 disables the reminder
});

// Threshold after which a reminder counts as "missed" (app was not in foreground).
export const MISSED_THRESHOLD_MS = 2000;

export function initialTimer() {
  return {
    phase: PHASE.IDLE,
    quarter: 0,
    accumulatedMs: 0,
    startedAtWall: null,
    reminderFired: false,
    endAlertFired: false,
    quarterDurationsMs: [],
  };
}

export function elapsedMs(timer, now) {
  const running = timer.phase === PHASE.RUNNING && timer.startedAtWall != null;
  const ms = running ? timer.accumulatedMs + (now - timer.startedAtWall) : timer.accumulatedMs;
  return Math.max(0, ms);
}

// Returns a new timer object, or the same object if the action is not valid
// in the current phase.
export function reduce(timer, action, now, config = DEFAULT_CONFIG) {
  const { phase } = timer;
  switch (action.type) {
    case 'start':
      if (phase !== PHASE.IDLE) return timer;
      return { ...initialTimer(), phase: PHASE.RUNNING, quarter: 1, startedAtWall: now };

    case 'pause':
      if (phase !== PHASE.RUNNING) return timer;
      return { ...timer, phase: PHASE.PAUSED, accumulatedMs: elapsedMs(timer, now), startedAtWall: null };

    case 'resume':
      if (phase !== PHASE.PAUSED) return timer;
      return { ...timer, phase: PHASE.RUNNING, startedAtWall: now };

    case 'endQuarter': {
      if (phase !== PHASE.RUNNING && phase !== PHASE.PAUSED) return timer;
      const played = elapsedMs(timer, now);
      const last = timer.quarter >= config.quarterCount;
      return {
        ...timer,
        phase: last ? PHASE.FINISHED : PHASE.BREAK,
        accumulatedMs: played,
        startedAtWall: null,
        quarterDurationsMs: [...timer.quarterDurationsMs, played],
      };
    }

    case 'startNext':
      if (phase !== PHASE.BREAK) return timer;
      return {
        ...timer,
        phase: PHASE.RUNNING,
        quarter: timer.quarter + 1,
        accumulatedMs: 0,
        startedAtWall: now,
        reminderFired: false,
        endAlertFired: false,
      };

    case 'ackReminder':
      if ((phase !== PHASE.RUNNING && phase !== PHASE.PAUSED) || timer.reminderFired) return timer;
      return { ...timer, reminderFired: true };

    case 'ackEnd':
      if ((phase !== PHASE.RUNNING && phase !== PHASE.PAUSED) || timer.endAlertFired) return timer;
      return { ...timer, endAlertFired: true };

    default:
      return timer;
  }
}

// Everything the UI needs, computed from state + now. Called by the render loop.
export function derive(timer, config, now) {
  const elapsed = elapsedMs(timer, now);
  const inPlay = timer.phase === PHASE.RUNNING || timer.phase === PHASE.PAUSED;
  const reminderEnabled = config.reminderAtMs > 0 && config.reminderAtMs < config.quarterMs;
  const reminderDue = inPlay && reminderEnabled && !timer.reminderFired && elapsed >= config.reminderAtMs;
  const endDue = inPlay && !timer.endAlertFired && elapsed >= config.quarterMs;
  return {
    phase: timer.phase,
    quarter: timer.quarter,
    elapsedMs: elapsed,
    overtimeMs: Math.max(0, elapsed - config.quarterMs),
    isOvertime: inPlay && elapsed >= config.quarterMs,
    isLastQuarter: timer.quarter >= config.quarterCount,
    reminderEnabled,
    reminderDue,
    endDue,
    reminderLateMs: reminderDue ? elapsed - config.reminderAtMs : 0,
    endLateMs: endDue ? elapsed - config.quarterMs : 0,
  };
}

export function isMissed(lateMs) {
  return lateMs > MISSED_THRESHOLD_MS;
}
