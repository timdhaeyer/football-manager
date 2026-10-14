// Small diagnostics ring buffer (memory + IndexedDB) because there is no Web Inspector on Windows.
import { getMeta, setMeta } from './store.js';

const MAX = 50;
let entries = [];
let loaded = false;
let saveTimer = null;
const listeners = new Set();

export async function loadLog() {
  const stored = await getMeta('log', []);
  entries = [...stored, ...entries].slice(-MAX);
  loaded = true;
}

export function log(message, data) {
  const line = { at: new Date().toISOString(), message, ...(data === undefined ? {} : { data }) };
  entries.push(line);
  if (entries.length > MAX) entries = entries.slice(-MAX);
  if (loaded) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => setMeta('log', entries).catch(() => {}), 500);
  }
  listeners.forEach((fn) => fn());
}

export function getLog() {
  return entries;
}

export function onLog(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function installErrorHandlers() {
  addEventListener('error', (e) => log('error', String(e.message || e.error)));
  addEventListener('unhandledrejection', (e) => log('unhandledrejection', String(e.reason?.message || e.reason)));
}
