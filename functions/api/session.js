// Stato della connessione: ruolo, bot e chat configurati.
import { json, getSettings, getBotToken } from '../../lib/server/store.js';
import { call } from '../../lib/server/telegram.js';

export async function onRequestGet({ env, data }) {
  const settings = await getSettings(env);
  const token = await getBotToken(env);
  let bot = null;
  let botError = null;
  if (token) {
    try {
      const me = await call(token, 'getMe');
      bot = { username: me.username, name: me.first_name };
    } catch (e) {
      botError = e.message;
    }
  } else {
    botError = 'Inserisci il token del bot nelle impostazioni.';
  }
  return json({
    ok: true,
    role: data.session.role,
    bot,
    botError,
    botFromEnv: Boolean(env.TELEGRAM_BOT_TOKEN),
    chatId: settings.chatId,
    format: settings.format,
  });
}
