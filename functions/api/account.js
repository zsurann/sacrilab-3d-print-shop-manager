// Collegamento dell'account Telegram del proprietario (solo con la password del proprietario).
import { json, fail } from '../../lib/server/store.js';
import { sender } from '../../lib/server/sender.js';
import { releaseIfDue } from '../../lib/server/queue.js';
import { getCatalog } from '../../lib/server/store.js';

const ACTIONS = {
  start: (b) => ['login/start', { phone: String(b.phone || '').replace(/\s/g, '') }],
  code: (b) => ['login/code', { code: String(b.code || '').trim() }],
  password: (b) => ['login/password', { password: String(b.password || '') }],
  logout: () => ['logout', {}],
};

export async function onRequestPost({ request, env, data }) {
  if (data.session.role !== 'owner') return fail(403, 'Solo il proprietario può collegare o scollegare l\'account Telegram.');
  const body = await request.json().catch(() => ({}));
  const action = ACTIONS[body.action];
  if (!action) return fail(400, 'Azione non valida.');
  const [path, payload] = action(body);
  const result = await sender(env, path, payload);
  if (result.linked && !(await env.KV.get('configured'))) {
    // Configurazione completata: da qui partono gli articoli, i primi 5 subito.
    await env.KV.put('configured', new Date().toISOString());
    await releaseIfDue(env, await getCatalog(env, request), { force: true });
  }
  return json({ ok: true, ...result });
}
