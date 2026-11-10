// Persistenza locale (per dispositivo) di impostazioni e decisioni.
const KEY_STATE = 'sacrilab.state.v1';
const KEY_SETTINGS = 'sacrilab.settings.v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage pieno o bloccato */ }
}

const DEFAULT_SETTINGS = { token: '', chatId: '', format: '{titolo}, {prezzo}€', dataUrl: '' };
const DEFAULT_STATE = { published: {}, discarded: {}, titles: {}, prices: {} };

export const settings = read(KEY_SETTINGS, DEFAULT_SETTINGS);
export const state = read(KEY_STATE, DEFAULT_STATE);
for (const k of Object.keys(DEFAULT_STATE)) state[k] ||= {};

export function saveSettings(patch) {
  Object.assign(settings, patch);
  write(KEY_SETTINGS, settings);
}
export function saveState() { write(KEY_STATE, state); }

export function statusOf(id) {
  if (state.published[id]) return 'published';
  if (state.discarded[id]) return 'discarded';
  return 'pending';
}

export function markPublished(id, data) {
  delete state.discarded[id];
  state.published[id] = { ...data, at: Date.now() };
  saveState();
}
export function markDiscarded(id) {
  state.discarded[id] = { at: Date.now() };
  saveState();
}
export function restore(id) {
  delete state.discarded[id];
  delete state.published[id];
  saveState();
}
export function setDraft(id, field, value) {
  const bucket = field === 'title' ? state.titles : state.prices;
  if (value === '' || value == null) delete bucket[id]; else bucket[id] = value;
  saveState();
}

export function exportState() {
  return JSON.stringify({ app: 'sacrilab', version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
}
export function importState(json) {
  const data = JSON.parse(json);
  const s = data.state || data;
  for (const k of Object.keys(DEFAULT_STATE)) state[k] = { ...(s[k] || {}) };
  saveState();
}
export function resetState() {
  for (const k of Object.keys(DEFAULT_STATE)) state[k] = {};
  saveState();
}
