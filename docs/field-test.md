# Field test: timer accuracy against a stopwatch

Goal: prove the clock stays correct over a real 15-minute quarter while the phone is locked, backgrounded
and force-quit. Run it in the **installed** app (home screen), **debug speed off**, on the deployed version.

## Setup

- A separate stopwatch (or the Clock app on a second phone).
- Start the app's quarter and the stopwatch at the same moment (one tap with each hand), or film both screens
  so you can read the start offset afterwards. Note the start offset and subtract it from every reading.
- In the app: *Settings → Diagnostics* lets you check the re-anchor drift after each lock/unlock.

**Pass criterion:** |app − stopwatch| ≤ 1 s at every checkpoint, with no cumulative drift.

## Protocol

| Stopwatch | Action | Check | App | Δ | OK |
|---|---|---|---|---|---|
| 0:00 | Start Q1 + stopwatch | | | | |
| 2:00 | Leave app in foreground | Screen did not dim (wake lock) | | | |
| 2:00 → 5:00 | **Lock the screen** for 3 min, then unlock | Correct time on the very first frame | | | |
| 5:00 → 6:00 | **Switch to another app** (camera / take a call) for 1 min | Correct on return | | | |
| 6:00 → 6:30 | **Pause** app and stopwatch together, resume both after 30 s | | | | |
| 7:00 → 8:30 | **Lock across 7:30** | On unlock: SUBSTITUTION flash immediately, "missed by ~1:00" | | | |
| 9:00 | **Force-quit** (swipe up), wait 60 s, reopen | Correct time, score and goals intact | | | |
| 12:00 | Low Power Mode **on**, Airplane mode **on** | Still runs, still correct | | | |
| 14:00 → 16:00 | **Lock across 15:00** | On unlock: END OF Q1 alert, clock `15:00 +1:00 overtime`, still running | | | |
| 16:30 | End Q1 → Start Q2, run 1 min | Q2 starts at 00:00, "Sub at 7:30" badge reset | | | |

Repeat a short run (reminder only) with the **silent switch on** to confirm the beep is still audible.

## Results

| Date | iOS version | App version | Max Δ | Notes |
|---|---|---|---|---|
| | | | | |
