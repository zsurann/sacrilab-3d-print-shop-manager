// Articoli pubblicati/scartati, condivisi tra tutti i dispositivi.
import { json, fail, getState, putState } from '../../lib/server/store.js';

export async function onRequestGet({ env }) {
  return json({ ok: true, state: await getState(env) });
}

export async function onRequestPost({ request, env }) {
  const { op, id } = await request.json().catch(() => ({}));
  const state = await getState(env);
  const key = id == null ? '' : String(id);
  if (op === 'discard' && key) {
    delete state.published[key];
    state.discarded[key] = { at: Date.now() };
  } else if (op === 'restore' && key) {
    delete state.published[key];
    delete state.discarded[key];
  } else if (op === 'reset') {
    state.published = {};
    state.discarded = {};
  } else {
    return fail(400, 'Operazione non valida.');
  }
  return json({ ok: true, state: await putState(env, state) });
}
