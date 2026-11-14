// Prima configurazione: il gestore sceglie la password.
// Possibile una sola volta: poi la password si cambia dalle impostazioni.
import { json, fail } from '../../../lib/server/store.js';
import { needsSetup, validatePassword, setManagerPassword, createSession } from '../../../lib/server/auth.js';
import { getCatalog } from '../../../lib/server/store.js';
import { releaseIfDue } from '../../../lib/server/queue.js';

export async function onRequestPost({ request, env }) {
  if (!(await needsSetup(env))) return fail(409, 'La password del gestore è già stata creata: usa «Entra».');
  const { password } = await request.json().catch(() => ({}));
  const err = validatePassword(password);
  if (err) return fail(400, err);
  await setManagerPassword(env, password);
  // Primi 5 articoli disponibili subito.
  await releaseIfDue(env, await getCatalog(env, request), { force: true });
  return json({ ok: true, role: 'manager', token: await createSession(env, 'manager') });
}
