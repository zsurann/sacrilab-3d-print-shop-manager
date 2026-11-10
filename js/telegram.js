// Invio messaggi tramite la Telegram Bot API (direttamente dal browser).
const API = 'https://api.telegram.org';

export class TelegramError extends Error {}

async function call(token, method, body, isForm = false) {
  if (!token) throw new TelegramError('Token del bot mancante. Aprilo nelle impostazioni.');
  let res;
  try {
    res = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new TelegramError('Impossibile raggiungere Telegram. Controlla la connessione.');
  }
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new TelegramError(humanize(data.description || `Errore HTTP ${res.status}`), { cause: data });
  return data.result;
}

function humanize(desc) {
  const d = desc.toLowerCase();
  if (d.includes('unauthorized')) return 'Token del bot non valido.';
  if (d.includes('chat not found')) return 'Chat non trovata: controlla il chat ID e scrivi prima un messaggio al bot.';
  if (d.includes('bot was blocked')) return 'Il bot è stato bloccato dall\'utente.';
  if (d.includes('not enough rights') || d.includes('need administrator')) return 'Il bot non ha i permessi per scrivere in questa chat.';
  return `Telegram: ${desc}`;
}

export function formatPrice(value) {
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

export function buildCaption(format, { title, price, link }) {
  return (format || '{titolo}, {prezzo}€')
    .replaceAll('{titolo}', title.trim())
    .replaceAll('{prezzo}', price)
    .replaceAll('{link}', link || '')
    .slice(0, 1024);
}

// Varianti dell'URL immagine: Telegram a volte rifiuta webp o file troppo grandi,
// il CDN di MakerWorld supporta il ridimensionamento/conversione via parametri.
function imageVariants(url) {
  const clean = url.split('?')[0];
  return [...new Set([
    url,
    `${clean}?x-oss-process=image/resize,w_1280/format,jpg`,
  ])];
}

export async function publishProduct({ token, chatId, caption, image }) {
  if (!chatId) throw new TelegramError('Chat ID mancante. Aprilo nelle impostazioni.');
  let lastErr;
  // 1) Telegram scarica direttamente l'immagine dall'URL.
  for (const photo of imageVariants(image)) {
    try {
      return await call(token, 'sendPhoto', { chat_id: chatId, photo, caption });
    } catch (e) {
      lastErr = e;
      const d = String(e.cause?.description || '').toLowerCase();
      if (!d.includes('photo') && !d.includes('file') && !d.includes('url') && !d.includes('image')) throw e;
    }
  }
  // 2) Scarichiamo noi l'immagine e la carichiamo come file.
  try {
    const blob = await fetch(image, { mode: 'cors', referrerPolicy: 'no-referrer' }).then((r) => {
      if (!r.ok) throw new Error();
      return r.blob();
    });
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('photo', blob, 'prodotto.jpg');
    return await call(token, 'sendPhoto', form, true);
  } catch (e) {
    if (e instanceof TelegramError && !String(e.cause?.description || '').toLowerCase().includes('photo')) throw e;
  }
  throw lastErr || new TelegramError('Impossibile inviare l\'immagine.');
}

export function sendText({ token, chatId, text }) {
  if (!chatId) throw new TelegramError('Chat ID mancante.');
  return call(token, 'sendMessage', { chat_id: chatId, text });
}

export async function findChats(token) {
  const me = await call(token, 'getMe', {});
  const updates = await call(token, 'getUpdates', { limit: 100, allowed_updates: ['message', 'channel_post', 'my_chat_member'] });
  const chats = new Map();
  for (const u of updates) {
    const chat = (u.message || u.channel_post || u.my_chat_member || {}).chat;
    if (chat) chats.set(chat.id, chat);
  }
  return { bot: me, chats: [...chats.values()].reverse() };
}
