// Salva il token del bot Telegram inserito dall'app (se non è impostato su Cloudflare).
import { json, fail } from '../../lib/server/store.js';
import { call } from '../../lib/server/telegram.js';

export async function onRequestPost({ request, env }) {
  if (env.TELEGRAM_BOT_TOKEN) return fail(400, 'Il token è impostato nelle variabili di Cloudflare: cambialo da lì.');
  const { botToken } = await request.json().catch(() => ({}));
  const token = String(botToken || '').trim();
  if (!/^\d+:[\w-]{20,}$/.test(token)) return fail(400, 'Token non valido: copialo da @BotFather (formato 123456:ABC…).');
  const me = await call(token, 'getMe');
  await env.KV.put('secret:botToken', token);
  return json({ ok: true, bot: { username: me.username, name: me.first_name } });
}
