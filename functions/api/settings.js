// Chat di destinazione e formato della didascalia, salvati su KV (validi per tutti i dispositivi).
import { json, fail, getSettings } from '../../lib/server/store.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const current = await getSettings(env);
  const next = {
    chatId: body.chatId != null ? String(body.chatId).trim() : current.chatId,
    format: body.format != null ? String(body.format).trim() || '{titolo}, {prezzo}€' : current.format,
  };
  if (next.chatId && !/^(-?\d+|@[\w]{4,})$/.test(next.chatId)) return fail(400, 'Chat ID non valido (numero oppure @nomecanale).');
  if (!next.format.includes('{titolo}') && !next.format.includes('{prezzo}')) return fail(400, 'Il formato deve contenere {titolo} o {prezzo}.');
  await env.KV.put('settings', JSON.stringify(next));
  return json({ ok: true, settings: next });
}
