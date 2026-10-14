# Football Manager

A personal, offline-first iPhone PWA for the sideline of a U11 football match (Voetbal Vlaanderen, 4 × 15′):
match timer with substitution reminder, score and scorers. No accounts, no backend: static files on
GitHub Pages, data in IndexedDB on the phone.

## Features (v1)

- **Match timer**: 4 quarters of 15:00 (configurable), start / pause / resume / end quarter (two-tap confirm) /
  start next quarter. The clock never stops by itself: after 15:00 it shows `+m:ss overtime`.
- **Substitution reminder** at 7:30 (configurable, `0` = off): one beep plus a full-screen flash for a few seconds.
  The same alert fires at the end of each quarter. If the phone was locked across the mark, the alert shows the
  moment you return ("missed by 1:40").
- **Score and scorers**: `+ Goal` → tap the scorer from this match's selection (or *Own goal (opponent)* /
  *Unknown scorer*); `+ Opponent` for opponent goals; *Undo goal* removes the last goal after confirmation.
- **Squad selection** per match from the imported squad file, plus opponent name and **Home / Away**
  (the scoreboard lists the home team first; a HOME/AWAY badge shows during the match).
- **Match summary for the parents** (in Dutch) at full time: a **result card image** (crests, big score, goals
  under each team) and a text version (score, goals with minute and running score, scorers). *Share image* sends
  the card (with the text as caption) via the iOS share sheet, e.g. to WhatsApp; *Share text* / *Copy text* for
  text only.
- Recovers after the app is killed: the timer is derived from timestamps stored in IndexedDB on every change.
- Keeps the screen on (Screen Wake Lock), works offline (service worker), club colours and crest.

## Project layout

```
index.html, manifest.webmanifest, sw.js   app shell, PWA manifest, offline cache
css/app.css                               mobile-first, high-contrast styles (club colours)
fonts/                                    Outfit (club website typeface), self-hosted, SIL OFL 1.1
js/core/        pure logic, no DOM: clock, timer state machine, match, squad, format (unit-tested)
js/platform/    browser adapters: IndexedDB store, alerts (beep/flash), wake lock, lifecycle, log
js/ui/          views: selection, live, goal picker, settings
js/vendor/      idb 8.0.4 (vendored, ISC)
test/           node:test unit tests
tools/          dev server, icon generator
docs/           field-test protocol
```

No framework and no build step. Node 22+ is only needed for tests and the dev server.

## Develop

```powershell
npm test            # unit tests (timer, clock, match, squad, PWA checks)
npm run serve       # http://localhost:8080 (localhost is a secure context)
```

- **Debug speed**: *Settings → Debug → 60× faster* runs a full match in about a minute. It applies to new matches only
  and debug matches carry a purple `DEBUG` badge.
- The service worker is disabled on `localhost` so caching doesn't get in the way; add `?sw=1` to test it.
- If a `squad.json` exists in the project root it is loaded automatically on first start (local dev only).
- *Settings → Diagnostics* shows version, wake-lock / audio / storage state, clock re-anchor drift and the last
  50 log lines (there is no Safari Web Inspector on Windows).

## Squad file

The real squad is **not** committed: the repo and the site are public and the squad contains children's names.
`squad.json` is gitignored; `squad.example.json` shows the format:

```json
{ "team": "My Club U11", "players": [ { "id": "p01", "name": "Thibaut Courtois", "number": 1 } ] }
```

`id` must stay stable forever (future match history refers to it); `number` is optional. Plain text with one
player per line (`7 Lars`) can also be pasted.

**On the iPhone** (inside the *installed* app, not in Safari, because home-screen apps have their own storage):
AirDrop or save `squad.json` to Files → *Settings → Import squad file…*. Re-importing updates names; players
missing from a new file are kept as inactive.

## Deploy to GitHub Pages

1. Create a **public** GitHub repo (free Pages needs public) and push this folder to `main`.
2. Repo *Settings → Pages → Build and deployment → Source: GitHub Actions*.
3. Every push to `main` runs the tests and, if green, deploys an allowlist of files
   (`.github/workflows/pages.yml`). The short commit SHA is stamped into `js/version.js` and `sw.js`, so each
   deploy is a new service worker version (shown in *Settings → Diagnostics*).
4. Updates are never applied during a live match: an *Update available* banner appears between matches.

Use branches for experiments: the Pages site is also your match-day app.

## Install on the iPhone

Open `https://<user>.github.io/<repo>/` in **Safari** → Share → *Add to Home Screen*. The label is "Football".
Open it from the home screen and import the squad there.

## Testing on the iPhone over LAN HTTPS (optional, faster iteration)

Service workers and wake lock need HTTPS on a non-localhost address:

```powershell
winget install FiloSottile.mkcert
mkcert -install
mkdir certs; mkcert -cert-file certs/cert.pem -key-file certs/key.pem <your-PC-LAN-IP> localhost
npm run serve:https  # https://<LAN-IP>:8443
```

Send `"$(mkcert -CAROOT)\rootCA.pem"` to the iPhone (AirDrop/mail), install the profile, then enable it under
*Settings → General → About → Certificate Trust Settings*. Allow port 8443 in Windows Firewall.
An app installed from this origin is separate from the Pages one (separate storage).

## Match-day checklist

- iPhone *Auto-Lock → Never* (safety net in case the wake lock fails; watch for the "⚠ Screen may sleep" badge).
- Volume up; *Settings → Test beep + flash* once (this also unlocks audio).
- Charged phone or a power bank (screen on for about 75 minutes).
- Background alerts are impossible for web apps: if the screen is locked at 7:30, the alert shows on unlock.

## Icons

Generated from the club crest (`icons/club-logo-source.png`, from ksvsottegem.be) with
`npm run icons` (Windows, PowerShell 7). iOS icons must be opaque PNGs, so the crest sits on white.

## Later (designed for, not built yet)

Squad management screen, match history and season top scorers, per-player playing time, JSON export/import. Matches are stored as complete documents with an append-only event log,
stable player ids and a `schemaVersion`, so these can be added without migrations of existing data.
