// GET: catalogo per l'app (pubblico). PUT: aggiornamento dallo scraper (Authorization: Bearer INGEST_TOKEN).
import { json, fail, safeEqual, getCatalog } from '../../lib/server/store.js';

export async function onRequestGet({ request, env }) {
  const catalog = await getCatalog(env, request);
  const etag = `"${catalog.generatedAt || 'empty'}-${(catalog.items || []).length}"`;
  if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
  return json(catalog, 200, { ETag: etag });
}

export async function onRequestPut({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.INGEST_TOKEN || !safeEqual(auth, `Bearer ${env.INGEST_TOKEN}`)) return fail(401, 'Token di invio non valido.');
  const catalog = await request.json().catch(() => null);
  if (!catalog || !Array.isArray(catalog.items) || !catalog.items.length) return fail(400, 'Catalogo vuoto o non valido.');
  await env.KV.put('catalog', JSON.stringify(catalog));
  return json({ ok: true, count: catalog.items.length });
}
