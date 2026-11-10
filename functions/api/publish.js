// Pubblica un articolo sul bot Telegram e lo segna come pubblicato per tutti i dispositivi.
import { json, fail, getState, putState, getSettings, getCatalog, getBotToken } from '../../lib/server/store.js';
import { sendProductPhoto, formatPrice, buildCaption } from '../../lib/server/telegram.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '');
  const price = formatPrice(body.price);
  if (!id) return fail(400, 'Articolo mancante.');
  if (!price) return fail(400, 'Prezzo non valido.');

  const catalog = await getCatalog(env, request);
  const item = (catalog.items || []).find((x) => String(x.id) === id);
  if (!item) return fail(404, 'Articolo non trovato nel catalogo: aggiorna la pagina.');

  const state = await getState(env);
  if (state.published[id]) return fail(409, `Già pubblicato a ${state.published[id].price}€.`);

  const settings = await getSettings(env);
  if (!settings.chatId) return fail(400, 'Seleziona la chat Telegram nelle impostazioni.');

  const title = String(body.title || item.title).trim().slice(0, 300);
  const caption = buildCaption(settings.format, { title, price, link: item.url });
  await sendProductPhoto({ token: await getBotToken(env), chatId: settings.chatId, caption, image: item.image });

  // Rilegge lo stato: un altro dispositivo potrebbe averlo cambiato nel frattempo.
  const fresh = await getState(env);
  delete fresh.discarded[id];
  fresh.published[id] = { price, title, caption, at: Date.now() };
  return json({ ok: true, caption, state: await putState(env, fresh) });
}
