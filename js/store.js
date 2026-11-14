// Stato dell'app: decisioni (pubblicati/scartati) condivise sul server, bozze locali.
const KEY_AUTH = 'sacrilab.session.v3';
const KEY_DRAFTS = 'sacrilab.drafts.v2';
const KEY_CACHE = 'sacrilab.cache.v2';

const load = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage bloccato */ } };

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

let key = load(KEY_AUTH, '');
export const hasKey = () => Boolean(key);
function setKey(k) { key = k || ''; save(KEY_AUTH, key); }
export function forget() { key = ''; try { localStorage.removeItem(KEY_AUTH); } catch { /* noop */ } }
/** Cancella i dati salvati su questo dispositivo (usato quando si esce). */
export function clearLocal() {
  state.published = {};
  state.discarded = {};
  drafts.titles = {};
  drafts.prices = {};
  for (const k of [KEY_CACHE, KEY_DRAFTS]) { try { localStorage.removeItem(k); } catch { /* noop */ } }
}

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(`api/${path}`, {
      method,
      headers: { 'X-Session': key, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Connessione assente. Riprova quando sei online.', 0);
  }
  if (res.status === 304) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    const msg = data?.error || (res.status === 404 ? 'Server non disponibile: l\'app va pubblicata su Cloudflare Pages.' : `Errore ${res.status}`);
    throw new ApiError(msg, res.status);
  }
  return { data, res };
}

/* ---------- accesso ---------- */
export async function login(password) {
  const { data } = await api('auth/login', { method: 'POST', body: { password } });
  setKey(data.token);
  return data;
}
export async function logout() {
  try { await api('auth/logout', { method: 'POST' }); } catch { /* già scaduta */ }
  forget();
}
export async function changePassword(password) {
  await api('password', { method: 'POST', body: { password } });
}
export async function account(action, extra = {}) {
  return (await api('account', { method: 'POST', body: { action, ...extra } })).data;
}

/* ---------- decisioni condivise ---------- */
const cached = load(KEY_CACHE, {});
export const state = { published: cached.published || {}, discarded: cached.discarded || {} };
const persist = () => save(KEY_CACHE, state);

export function applyState(s) {
  state.published = s.published || {};
  state.discarded = s.discarded || {};
  persist();
}

export function statusOf(id) {
  if (state.published[id]) return 'published';
  if (state.discarded[id]) return 'discarded';
  return 'pending';
}

export async function refreshState() {
  const { data } = await api('state');
  applyState(data.state);
  return data.state;
}

// Aggiornamento ottimistico: l'interfaccia cambia subito, in caso di errore si torna indietro.
async function op(op, id, mutate) {
  const backup = { published: { ...state.published }, discarded: { ...state.discarded } };
  mutate();
  persist();
  try {
    const { data } = await api('state', { method: 'POST', body: { op, id } });
    applyState(data.state);
  } catch (e) {
    applyState(backup);
    throw e;
  }
}
export const discard = (id) => op('discard', id, () => { delete state.published[id]; state.discarded[id] = { at: Date.now() }; });
export const restore = (id) => op('restore', id, () => { delete state.published[id]; delete state.discarded[id]; });
export const resetAll = () => op('reset', null, () => { state.published = {}; state.discarded = {}; });

export async function publish(id, title, price) {
  const { data } = await api('publish', { method: 'POST', body: { id, title, price } });
  applyState(data.state);
  clearDraft(id);
  return data;
}

/* ---------- bozze locali (titolo modificato, prezzo digitato) ---------- */
const drafts = load(KEY_DRAFTS, { titles: {}, prices: {} });
drafts.titles ||= {};
drafts.prices ||= {};
export const draftTitle = (id) => drafts.titles[id];
export const draftPrice = (id) => drafts.prices[id];
export function setDraft(id, field, value) {
  const bucket = field === 'title' ? drafts.titles : drafts.prices;
  if (value === '' || value == null) delete bucket[id]; else bucket[id] = value;
  save(KEY_DRAFTS, drafts);
}
function clearDraft(id) {
  delete drafts.titles[id];
  delete drafts.prices[id];
  save(KEY_DRAFTS, drafts);
}

export function formatPrice(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}
