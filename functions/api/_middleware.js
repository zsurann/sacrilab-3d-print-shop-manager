// Protegge le API: serve una sessione valida (header X-Session), ottenuta con
// la password del gestore o con quella del proprietario.
// Pubbliche: catalogo (dati pubblici di MakerWorld; l'invio è protetto da INGEST_TOKEN)
// e /api/auth/* (stato, prima configurazione, accesso, uscita).
import { fail } from '../../lib/server/store.js';
import { getSession } from '../../lib/server/auth.js';
import { setApiBase } from '../../lib/server/telegram.js';

export async function onRequest(context) {
  const { request, env, next, data } = context;
  const path = new URL(request.url).pathname;
  setApiBase(env.TELEGRAM_API_BASE);

  if (!env.KV) return fail(503, 'Database non collegato: aggiungi il binding KV con nome «KV» al progetto Cloudflare Pages e rifai il deploy.');

  try {
    if (path === '/api/catalog' || path.startsWith('/api/auth/')) return await next();
    const session = await getSession(env, request.headers.get('X-Session'));
    if (!session) return fail(401, 'Sessione scaduta: entra di nuovo.');
    data.session = session;
    return await next();
  } catch (e) {
    return fail(e.status || 500, e.message || 'Errore del server.');
  }
}
