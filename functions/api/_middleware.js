// Protegge tutte le API con la password dell'app (variabile APP_PASSWORD su Cloudflare).
// Eccezioni: lettura del catalogo (dati pubblici di MakerWorld) e invio del catalogo
// dallo scraper (protetto da INGEST_TOKEN nella route).
import { fail, safeEqual } from '../../lib/server/store.js';
import { setApiBase } from '../../lib/server/telegram.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  setApiBase(env.TELEGRAM_API_BASE);
  if (!env.KV) return fail(503, 'Database non collegato: aggiungi il binding KV con nome «KV» al progetto Cloudflare Pages.');
  if (url.pathname === '/api/catalog') return next();

  if (!env.APP_PASSWORD) return fail(503, 'Imposta la variabile APP_PASSWORD nel progetto Cloudflare Pages.');
  const key = request.headers.get('X-App-Key');
  if (!key || !safeEqual(key, env.APP_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 400)); // rallenta i tentativi a raffica
    return fail(401, 'Password non valida.');
  }
  try {
    return await next();
  } catch (e) {
    return fail(e.status || 500, e.message || 'Errore del server.');
  }
}
