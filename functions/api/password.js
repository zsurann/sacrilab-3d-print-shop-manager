// Cambia la password del gestore (possibile sia al gestore sia al proprietario).
// I dispositivi del gestore dovranno entrare di nuovo; questo resta collegato.
import { json, fail } from '../../lib/server/store.js';
import { validatePassword, setManagerPassword, createSession } from '../../lib/server/auth.js';

export async function onRequestPost({ request, env, data }) {
  const { password } = await request.json().catch(() => ({}));
  const err = validatePassword(password);
  if (err) return fail(400, err);
  await setManagerPassword(env, password);
  const token = data.session.role === 'manager' ? await createSession(env, 'manager') : null;
  return json({ ok: true, token });
}
