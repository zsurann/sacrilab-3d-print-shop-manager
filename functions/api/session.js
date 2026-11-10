// Stato della connessione: login riuscito, bot e chat configurati.
import { json, getSettings } from '../../lib/server/store.js';
import { call } from '../../lib/server/telegram.js';

export async function onRequestGet({ env }) {
  const settings = await getSettings(env);
  let bot = null;
  let botError = null;
  if (env.TELEGRAM_BOT_TOKEN) {
    try {
      const me = await call(env.TELEGRAM_BOT_TOKEN, 'getMe');
      bot = { username: me.username, name: me.first_name };
    } catch (e) {
      botError = e.message;
    }
  } else {
    botError = 'Manca TELEGRAM_BOT_TOKEN nelle variabili del progetto Cloudflare.';
  }
  return json({ ok: true, bot, botError, chatId: settings.chatId, format: settings.format });
}
