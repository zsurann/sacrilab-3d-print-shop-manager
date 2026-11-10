// Coda degli articoli da valutare: ogni 30 minuti vengono sbloccati i 5 migliori
// articoli del catalogo non ancora mostrati. Gli articoli sbloccati sono salvati
// interi (foto, titolo, link), così restano disponibili anche se escono dal catalogo.
import { getState } from './store.js';

export const BATCH_SIZE = 5;
export const SLOT_MS = 30 * 60 * 1000;
export const MAX_PENDING = 100; // oltre questo numero di articoli in attesa non se ne aggiungono altri
const DISCARDED_KEEP_MS = 30 * 864e5;

export const currentSlot = (now = Date.now()) => Math.floor(now / SLOT_MS);
export const nextReleaseAt = (now = Date.now()) => (currentSlot(now) + 1) * SLOT_MS;

export async function getQueue(env) {
  const q = (await env.KV.get('queue', 'json')) || {};
  return { items: q.items || {}, lastSlot: q.lastSlot ?? null, batches: q.batches || 0 };
}

/**
 * Sblocca un nuovo gruppo di articoli se è iniziata una nuova mezz'ora (o se `force`).
 * Restituisce la coda aggiornata.
 */
export async function releaseIfDue(env, catalog, { force = false, now = Date.now() } = {}) {
  const queue = await getQueue(env);
  const slot = currentSlot(now);
  const empty = !Object.keys(queue.items).length;
  if (!force && !empty && queue.lastSlot === slot) return queue;

  const state = await getState(env);
  const decided = (id) => state.published[id] || state.discarded[id];
  const pending = Object.keys(queue.items).filter((id) => !decided(id)).length;

  const candidates = (catalog?.items || [])
    .filter((it) => !queue.items[it.id] && !decided(it.id))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // Catalogo ancora vuoto: non consumare la mezz'ora, si riprova al prossimo controllo.
  if (!candidates.length) return queue;

  if (pending < MAX_PENDING) {
    const batch = queue.batches + 1;
    for (const it of candidates.slice(0, BATCH_SIZE)) {
      queue.items[it.id] = { ...it, releasedAt: now, batch };
    }
    queue.batches = batch;
  }
  queue.lastSlot = slot;

  // Pulizia: gli scartati da più di 30 giorni non servono più.
  for (const id of Object.keys(queue.items)) {
    const d = state.discarded[id];
    if (d && now - d.at > DISCARDED_KEEP_MS) delete queue.items[id];
  }

  await env.KV.put('queue', JSON.stringify(queue));
  return queue;
}
