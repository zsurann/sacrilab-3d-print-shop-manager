// Utilità condivise dalle Cloudflare Pages Functions: risposte JSON, autenticazione, dati su KV.

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

export const fail = (status, error) => json({ ok: false, error }, status);

/** Confronto a tempo costante (evita di rivelare la password carattere per carattere). */
export function safeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(String(a ?? ''));
  const y = enc.encode(String(b ?? ''));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const EMPTY_STATE = () => ({ published: {}, discarded: {}, updatedAt: null });

export async function getState(env) {
  const s = (await env.KV.get('state', 'json')) || EMPTY_STATE();
  s.published ||= {};
  s.discarded ||= {};
  return s;
}

export async function putState(env, state) {
  state.updatedAt = new Date().toISOString();
  await env.KV.put('state', JSON.stringify(state));
  return state;
}

export async function getSettings(env) {
  const s = (await env.KV.get('settings', 'json')) || {};
  return {
    chatId: s.chatId || env.TELEGRAM_CHAT_ID || '',
    format: s.format || env.CAPTION_FORMAT || '{titolo}, {prezzo}€',
  };
}

export async function getCatalog(env, request) {
  const stored = await env.KV.get('catalog', 'json');
  if (stored) return stored;
  // Primo avvio: catalogo statico incluso nel sito (vuoto finché lo scraper non invia dati).
  try {
    const res = await env.ASSETS.fetch(new URL('/data/products.json', request.url));
    if (res.ok) return await res.json();
  } catch { /* nessun asset */ }
  return { generatedAt: null, categories: [], items: [] };
}
