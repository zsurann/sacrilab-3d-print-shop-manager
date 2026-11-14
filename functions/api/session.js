// Stato della connessione: ruolo, account Telegram collegato, formato della didascalia.
import { json, getSettings } from '../../lib/server/store.js';
import { sender } from '../../lib/server/sender.js';

export async function onRequestGet({ env, data }) {
  const account = await sender(env, 'status').catch((e) => ({ linked: false, error: e.message }));
  // Il vecchio token del bot non serve più: lo si elimina la prima volta che capita.
  if (await env.KV.get('secret:botToken')) await env.KV.delete('secret:botToken');
  return json({ ok: true, role: data.session.role, account, format: (await getSettings(env)).format });
}
