// Accesso con la password del gestore o del proprietario.
import { json, fail } from '../../../lib/server/store.js';
import { checkPassword, createSession, needsSetup } from '../../../lib/server/auth.js';

export async function onRequestPost({ request, env }) {
  const { password } = await request.json().catch(() => ({}));
  const role = await checkPassword(env, String(password || ''));
  if (!role) {
    await new Promise((r) => setTimeout(r, 600)); // rallenta i tentativi a raffica
    const msg = (await needsSetup(env)) && !env.OWNER_PASSWORD ? 'Crea prima la password del gestore.' : 'Password non valida.';
    return fail(401, msg);
  }
  return json({ ok: true, role, token: await createSession(env, role) });
}
