// Articoli da mostrare nell'app: quelli sbloccati dalla coda (5 ogni 30 minuti)
// più le decisioni condivise (pubblicati/scartati).
import { json, getCatalog, getState } from '../../lib/server/store.js';
import { releaseIfDue, nextReleaseAt, BATCH_SIZE } from '../../lib/server/queue.js';

export async function onRequestGet({ request, env }) {
  const catalog = await getCatalog(env, request);
  const queue = await releaseIfDue(env, catalog);
  return json({
    ok: true,
    items: Object.values(queue.items),
    categories: catalog.categories || [],
    generatedAt: catalog.generatedAt || null,
    catalogCount: (catalog.items || []).length,
    nextReleaseAt: nextReleaseAt(),
    batchSize: BATCH_SIZE,
    state: await getState(env),
  });
}
