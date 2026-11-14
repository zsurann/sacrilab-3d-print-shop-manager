// Formato della didascalia, salvato su KV (valido per tutti i dispositivi).
import { json, fail } from '../../lib/server/store.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const format = String(body.format ?? '').trim() || '{titolo}, {prezzo}€';
  if (!format.includes('{titolo}') && !format.includes('{prezzo}')) return fail(400, 'Il formato deve contenere {titolo} o {prezzo}.');
  await env.KV.put('settings', JSON.stringify({ format }));
  return json({ ok: true, settings: { format } });
}
