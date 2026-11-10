// Dice all'app se il gestore deve ancora creare la password.
import { json } from '../../../lib/server/store.js';
import { needsSetup } from '../../../lib/server/auth.js';

export async function onRequestGet({ env }) {
  return json({ ok: true, needsSetup: await needsSetup(env), botFromEnv: Boolean(env.TELEGRAM_BOT_TOKEN) });
}
