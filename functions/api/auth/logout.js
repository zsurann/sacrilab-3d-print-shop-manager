// Esce da questo dispositivo.
import { json } from '../../../lib/server/store.js';
import { deleteSession } from '../../../lib/server/auth.js';

export async function onRequestPost({ request, env }) {
  const token = request.headers.get('X-Session');
  if (token && /^[0-9a-f]{64}$/.test(token)) await deleteSession(env, token);
  return json({ ok: true });
}
