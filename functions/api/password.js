// Imposta o cambia la password del gestore (solo il proprietario). I dispositivi del gestore dovranno rientrare.
import { json, fail } from '../../lib/server/store.js';
import { validatePassword, setManagerPassword } from '../../lib/server/auth.js';

export async function onRequestPost({ request, env, data }) {
  if (data.session.role !== 'owner') return fail(403, 'Solo il proprietario può cambiare le impostazioni.');
  const { password } = await request.json().catch(() => ({}));
  const err = validatePassword(password);
  if (err) return fail(400, err);
  await setManagerPassword(env, password);
  return json({ ok: true });
}
