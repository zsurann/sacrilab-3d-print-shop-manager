// Test della coda: node --test lib/server/queue.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseIfDue, translatePending, markConfigured, getQueue, SLOT_MS, BATCH_SIZE } from './queue.js';
import { cleanTitle } from './translate.js';

const fakeEnv = ({ configured = true, AI } = {}) => {
  const m = new Map(configured ? [['configured', '2026-11-14']] : []);
  return { AI, KV: {
    get: async (k, t) => (m.has(k) ? (t === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null),
    put: async (k, v) => { m.set(k, v); },
  } };
};
const catalog = { items: Array.from({ length: 23 }, (_, i) => ({ id: String(i), title: `T${i}`, score: 100 - i })) };
const T0 = 1_000 * SLOT_MS + 1000;

test('primo gruppo subito, poi 5 per ogni mezz\'ora, i migliori per punteggio', async () => {
  const env = fakeEnv();
  let q = await releaseIfDue(env, catalog, { now: T0 });
  assert.deepEqual(Object.keys(q.items), ['0', '1', '2', '3', '4']);
  q = await releaseIfDue(env, catalog, { now: T0 + 60_000 });       // stessa mezz'ora
  assert.equal(Object.keys(q.items).length, BATCH_SIZE);
  q = await releaseIfDue(env, catalog, { now: T0 + SLOT_MS });      // mezz'ora dopo
  assert.equal(Object.keys(q.items).length, 10);
  q = await releaseIfDue(env, catalog, { now: T0 + 10 * SLOT_MS }); // assenza lunga: solo 5 in più
  assert.equal(Object.keys(q.items).length, 15);
});

test('catalogo vuoto: aspetta senza consumare la mezz\'ora', async () => {
  const env = fakeEnv();
  let q = await releaseIfDue(env, { items: [] }, { now: T0 });
  assert.equal(Object.keys(q.items).length, 0);
  q = await releaseIfDue(env, catalog, { now: T0 + 5000 });
  assert.equal(Object.keys(q.items).length, 5);
});

test('salta gli articoli già decisi', async () => {
  const env = fakeEnv();
  await env.KV.put('state', JSON.stringify({ published: { 0: { at: 1 } }, discarded: { 1: { at: T0 } } }));
  const q = await releaseIfDue(env, catalog, { now: T0 });
  assert.deepEqual(Object.keys(q.items), ['2', '3', '4', '5', '6']);
});

test('finché il proprietario non configura il sito non esce nessun articolo', async () => {
  const q = await releaseIfDue(fakeEnv({ configured: false }), catalog, { now: T0 });
  assert.equal(Object.keys(q.items).length, 0);
});

test('i titoli vengono tradotti con emoji, l\'originale resta salvato', async () => {
  const AI = { run: async (_m, { messages }) => ({ response: `"🧩 ${messages[1].content.toUpperCase()}"\nspiegazione` }) };
  const q = await releaseIfDue(fakeEnv({ AI }), catalog, { now: T0 });
  assert.equal(q.items['0'].title, '🧩 T0');
  assert.equal(q.items['0'].originalTitle, 'T0');
});

test('se la traduzione fallisce resta il titolo originale, da riprovare', async () => {
  const AI = { run: async () => { throw new Error('quota esaurita'); } };
  const q = await releaseIfDue(fakeEnv({ AI }), catalog, { now: T0 });
  assert.equal(q.items['0'].title, 'T0');
  assert.equal(q.items['0'].originalTitle, undefined);
});

test('gli articoli in attesa non tradotti vengono tradotti poco alla volta', async () => {
  let ok = false;
  const AI = { run: async (_m, { messages }) => { if (!ok) throw new Error('giù'); return { response: `🎁 ${messages[1].content}` }; } };
  const env = fakeEnv({ AI });
  let q = await releaseIfDue(env, catalog, { now: T0 }); // AI giù: titoli originali
  q = await releaseIfDue(env, catalog, { now: T0 + SLOT_MS });
  const state = { published: { 1: { at: 1 } }, discarded: {} };
  ok = true;
  q = await translatePending(env, q, state);
  const done = Object.values(q.items).filter((x) => x.originalTitle);
  assert.equal(done.length, BATCH_SIZE, 'al massimo 5 per volta');
  assert.ok(!q.items['1'].originalTitle, 'i pubblicati non si traducono');
  assert.equal(q.items['0'].title, '🎁 T0');
  q = await translatePending(env, q, state);
  assert.equal(Object.values(q.items).filter((x) => x.originalTitle).length, 9, 'il giro dopo finisce gli altri');
});

test('markConfigured sblocca subito i primi 5, una volta sola', async () => {
  const env = fakeEnv({ configured: false });
  await markConfigured(env, catalog);
  assert.equal(Object.keys((await getQueue(env)).items).length, 5);
  await markConfigured(env, catalog);
  assert.equal(Object.keys((await getQueue(env)).items).length, 5);
});

test('pulizia della risposta del modello', () => {
  assert.equal(cleanTitle('Titolo: «🔪 Supporto tagliere»'), '🔪 Supporto tagliere');
  assert.equal(cleanTitle('\n**🌿 Vaso**\naltro'), '🌿 Vaso');
  assert.equal(cleanTitle(''), '');
});
