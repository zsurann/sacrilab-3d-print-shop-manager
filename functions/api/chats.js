// Elenca le chat che hanno scritto al bot, per scegliere la destinazione.
import { json } from '../../lib/server/store.js';
import { findChats } from '../../lib/server/telegram.js';

export async function onRequestGet({ env }) {
  return json({ ok: true, ...(await findChats(env.TELEGRAM_BOT_TOKEN)) });
}
