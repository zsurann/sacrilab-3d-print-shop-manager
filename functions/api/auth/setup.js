// Prima configurazione: il gestore sceglie la password (e facoltativamente il token del bot).
// Possibile una sola volta: poi la password si cambia dalle impostazioni.
import { json, fail } from '../../../lib/server/store.js';
import { needsSetup, validatePassword, setManagerPassword, createSession } from '../../../lib/server/auth.js';
import { call } from '../../../lib/server/telegram.js';

export async function onRequestPost({ request, env }) {
  if (!(await needsSetup(env))) return fail(409, 'La password del gestore è già stata creata: usa «Entra».');
  const { password, botToken } = await request.json().catch(() => ({}));
  const err = validatePassword(password);
  if (err) return fail(400, err);

  const token = String(botToken || '').trim();
  if (token && !env.TELEGRAM_BOT_TOKEN) {
    await call(token, 'getMe'); // verifica il token prima di salvarlo
    await env.KV.put('secret:botToken', token);
  }
  await setManagerPassword(env, password);
  return json({ ok: true, role: 'manager', token: await createSession(env, 'manager') });
}
