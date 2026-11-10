// Prima configurazione: il gestore sceglie la password e collega il bot Telegram (token obbligatorio).
// Possibile una sola volta: poi la password si cambia dalle impostazioni.
import { json, fail } from '../../../lib/server/store.js';
import { needsSetup, validatePassword, setManagerPassword, createSession } from '../../../lib/server/auth.js';
import { call } from '../../../lib/server/telegram.js';
import { getCatalog } from '../../../lib/server/store.js';
import { releaseIfDue } from '../../../lib/server/queue.js';

export async function onRequestPost({ request, env }) {
  if (!(await needsSetup(env))) return fail(409, 'La password del gestore è già stata creata: usa «Entra».');
  const { password, botToken } = await request.json().catch(() => ({}));
  const err = validatePassword(password);
  if (err) return fail(400, err);

  const token = String(botToken || '').trim();
  if (!env.TELEGRAM_BOT_TOKEN) {
    if (!/^\d+:[\w-]{20,}$/.test(token)) return fail(400, 'Inserisci il token del bot Telegram (da @BotFather, formato 123456:ABC…).');
    await call(token, 'getMe'); // verifica il token con Telegram prima di salvarlo
    await env.KV.put('secret:botToken', token);
  }
  await setManagerPassword(env, password);
  // Primi 5 articoli disponibili subito.
  await releaseIfDue(env, await getCatalog(env, request), { force: true });
  return json({ ok: true, role: 'manager', token: await createSession(env, 'manager') });
}
