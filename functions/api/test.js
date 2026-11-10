// Invia un messaggio di prova nella chat configurata.
import { json, fail, getSettings, getBotToken } from '../../lib/server/store.js';
import { call } from '../../lib/server/telegram.js';

export async function onRequestPost({ env }) {
  const { chatId } = await getSettings(env);
  if (!chatId) return fail(400, 'Seleziona prima la chat Telegram.');
  await call(await getBotToken(env), 'sendMessage', { chat_id: chatId, text: '✅ Sacrilab 3D Print Shop Manager è collegato a questa chat.' });
  return json({ ok: true });
}
