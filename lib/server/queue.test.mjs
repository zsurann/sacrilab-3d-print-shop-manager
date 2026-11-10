// Test della coda: node --test lib/server/queue.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseIfDue, SLOT_MS, BATCH_SIZE } from './queue.js';

const fakeEnv = () => {
  const m = new Map();
  return { KV: {
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
