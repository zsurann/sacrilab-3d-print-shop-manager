// Stato della connessione: ruolo, account Telegram collegato, formato della didascalia.
import { json, getSettings, getCatalog } from '../../lib/server/store.js';
import { markConfigured } from '../../lib/server/queue.js';
import { sender } from '../../lib/server/sender.js';

export async function onRequestGet({ request, env, data }) {
  const account = await sender(env, 'status').catch((e) => ({ linked: false, error: e.message }));
  // Account già collegato (es. dalla prova di invio) ma sito mai segnato come configurato.
  if (account.linked) await markConfigured(env, await getCatalog(env, request));
  // Il vecchio token del bot non serve più: lo si elimina la prima volta che capita.
  if (await env.KV.get('secret:botToken')) await env.KV.delete('secret:botToken');
  return json({ ok: true, role: data.session.role, account, format: (await getSettings(env)).format });
}
