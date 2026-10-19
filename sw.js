// Football Manager service worker: versioned precache, cache-first app shell.
// VERSION is replaced with the commit SHA by the deploy workflow, so every deploy
// produces a new worker. The page decides when to activate it (never mid-match).
const VERSION = 'dev';
const CACHE = `fm-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'fonts/outfit-latin.woff2',
  'fonts/outfit-latin-ext.woff2',
  'js/app.js',
  'js/version.js',
  'js/core/clock.js',
  'js/core/fixture.js',
  'js/core/format.js',
  'js/core/history.js',
  'js/core/match.js',
  'js/core/squad.js',
  'js/core/summary.js',
  'js/core/timer.js',
  'js/platform/alerts.js',
  'js/platform/lifecycle.js',
  'js/platform/log.js',
  'js/platform/store.js',
  'js/platform/wakelock.js',
  'js/ui/dom.js',
  'js/ui/fixtures.js',
  'js/ui/goal-picker.js',
  'js/ui/history.js',
  'js/ui/live.js',
  'js/ui/result-card.js',
  'js/ui/selection.js',
  'js/ui/settings.js',
  'js/ui/share.js',
  'js/ui/team.js',
  'js/vendor/idb.js',
  'icons/apple-touch-icon-180.png',
  'icons/club-logo.png',
  'icons/favicon-64.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('fm-') && k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('index.html', { cacheName: CACHE }).then((r) => r || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(request)));
});
