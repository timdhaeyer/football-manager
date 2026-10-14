// MatchClock: returns time in the wall-clock (Date.now) domain, but advances it
// with the monotonic performance clock while the page is in the foreground.
// iOS may stop performance.now() while the device sleeps, so we re-anchor to the
// wall clock whenever the page becomes visible again (and at boot).

export function createClock({
  wall = () => Date.now(),
  perf = () => performance.now(),
  speed = 1,
  epochWall = null, // debug: real wall time at which accelerated time started
} = {}) {
  const epoch = speed === 1 ? 0 : (epochWall ?? wall());
  const scaledWall = () => (speed === 1 ? wall() : epoch + (wall() - epoch) * speed);

  let anchorWall = scaledWall();
  let anchorPerf = perf();
  let last = -Infinity;
  let lastDriftMs = 0;
  let lastReanchorAt = anchorWall;

  function raw() {
    return anchorWall + (perf() - anchorPerf) * speed;
  }

  function now() {
    const t = raw();
    // Never go backwards within a session (e.g. device clock set back).
    if (t > last) last = t;
    return last;
  }

  function reanchor() {
    const predicted = raw();
    anchorWall = scaledWall();
    anchorPerf = perf();
    lastDriftMs = anchorWall - predicted;
    lastReanchorAt = anchorWall;
    return lastDriftMs;
  }

  function info() {
    return { speed, epochWall: speed === 1 ? null : epoch, lastDriftMs, lastReanchorAt };
  }

  return { now, reanchor, info, speed };
}
