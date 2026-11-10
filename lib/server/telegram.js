// Telegram Bot API lato server (Cloudflare Pages Functions).
let API = 'https://api.telegram.org';

/** Solo per i test locali: permette di puntare a un server Telegram finto. */
export function setApiBase(url) { if (url) API = url.replace(/\/+$/, ''); }

export class TelegramError extends Error {
  constructor(message, description = '') {
    super(message);
    this.description = description;
    this.status = 502;
  }
}

function humanize(desc) {
  const d = desc.toLowerCase();
  if (d.includes('unauthorized')) return 'Token del bot non valido (TELEGRAM_BOT_TOKEN).';
  if (d.includes('chat not found')) return 'Chat non trovata: scrivi prima un messaggio al bot e controlla la chat selezionata.';
  if (d.includes('bot was blocked')) return "Il bot è stato bloccato dall'utente.";
  if (d.includes('not enough rights') || d.includes('need administrator')) return 'Il bot non ha i permessi per scrivere in questa chat.';
  if (d.includes('conflict') && d.includes('webhook')) return 'Il bot ha un webhook attivo: la ricerca delle chat non è disponibile, inserisci il chat ID a mano.';
  return `Telegram: ${desc}`;
}

export async function call(token, method, body) {
  if (!token) throw new TelegramError('Bot non configurato: manca TELEGRAM_BOT_TOKEN su Cloudflare.');
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new TelegramError('Impossibile raggiungere Telegram.');
  }
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    const desc = data.description || `HTTP ${res.status}`;
    throw new TelegramError(humanize(desc), desc);
  }
  return data.result;
}

export function formatPrice(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

export function buildCaption(format, { title, price, link }) {
  return (format || '{titolo}, {prezzo}€')
    .replaceAll('{titolo}', String(title).trim())
    .replaceAll('{prezzo}', price)
    .replaceAll('{link}', link || '')
    .slice(0, 1024);
}

const isPhotoError = (e) => /photo|file|url|image|dimension|type/i.test(e.description || '');

/** Invia foto + didascalia. Prova l'URL diretto, poi una versione JPG ridimensionata,
 *  infine scarica l'immagine e la carica come file. */
export async function sendProductPhoto({ token, chatId, caption, image }) {
  const clean = image.split('?')[0];
  const variants = [...new Set([image, `${clean}?x-oss-process=image/resize,w_1280/format,jpg`])];
  let lastErr;
  for (const photo of variants) {
    try {
      return await call(token, 'sendPhoto', { chat_id: chatId, photo, caption });
    } catch (e) {
      if (!isPhotoError(e)) throw e;
      lastErr = e;
    }
  }
  for (const url of variants.reverse()) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://makerworld.com/' } });
      if (!r.ok) continue;
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('caption', caption);
      form.append('photo', new File([await r.arrayBuffer()], 'prodotto.jpg', { type: r.headers.get('content-type') || 'image/jpeg' }));
      return await call(token, 'sendPhoto', form);
    } catch (e) {
      if (e instanceof TelegramError && !isPhotoError(e)) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof TelegramError ? lastErr : new TelegramError("Impossibile inviare l'immagine del prodotto.");
}

export async function findChats(token) {
  const bot = await call(token, 'getMe');
  const updates = await call(token, 'getUpdates', { limit: 100, allowed_updates: ['message', 'channel_post', 'my_chat_member'] });
  const chats = new Map();
  for (const u of updates) {
    const chat = (u.message || u.channel_post || u.my_chat_member || {}).chat;
    if (chat) chats.set(chat.id, {
      id: chat.id,
      type: chat.type,
      name: chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id),
    });
  }
  return { bot: { username: bot.username, name: bot.first_name }, chats: [...chats.values()].reverse() };
}
