// PROTOTIPO: servizio di invio dall'account Telegram personale del proprietario.
// Serve solo a verificare che il piano gratuito di Cloudflare regga (Worker + Durable Object + mtcute).
import { DurableObject } from 'cloudflare:workers';
import { TelegramClient, MemoryStorage, WebCryptoProvider, WebPlatform, InputMedia } from '@mtcute/web';
import wasm from '@mtcute/wasm/mtcute.wasm';
import { seal, open } from './secret-box.js';
import PAGE from './page.html';

const TARGET = 'FlashShoppBot';

// Nei Workers non esiste navigator.onLine: senza questo mtcute crede di essere offline.
class WorkerPlatform extends WebPlatform {
  isOnline() { return true; }
  onNetworkChanged() { return () => {}; }
}

const json = (data, status = 200) => Response.json(data, { status });
// Senza un limite, se Telegram non risponde la richiesta resterebbe appesa per sempre.
const limit = () => AbortSignal.timeout(25000);

export class Sender extends DurableObject {
  async client() {
    if (this.tg) return this.tg;
    const tg = new TelegramClient({
      apiId: Number(this.env.API_ID),
      apiHash: this.env.API_HASH,
      storage: new MemoryStorage(),
      crypto: new WebCryptoProvider({ wasmInput: wasm }),
      platform: new WorkerPlatform(),
      disableUpdates: true,
    });
    const box = await this.ctx.storage.get('session');
    if (box) await tg.importSession(await open(this.env.SESSION_KEY, box));
    this.tg = tg;
    return tg;
  }

  async save() {
    await this.ctx.storage.put('session', await seal(this.env.SESSION_KEY, await this.tg.exportSession()));
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const t0 = Date.now();
    try {
      const tg = await this.client();
      if (path === '/api/status') {
        if (!(await this.ctx.storage.get('linked'))) return json({ linked: false });
        const me = await tg.getMe();
        return json({ linked: true, name: me.displayName, ms: Date.now() - t0 });
      }
      if (path === '/api/login/start') {
        const sent = await tg.sendCode({ phone: String(body.phone || ''), abortSignal: limit() });
        if (!('phoneCodeHash' in sent)) { await this.linked(); return json({ linked: true }); }
        await this.ctx.storage.put('login', { phone: String(body.phone), hash: sent.phoneCodeHash });
        await this.save(); // conserva la chiave usata per sendCode, nel caso il Durable Object venga riavviato
        return json({ next: 'code', delivery: sent.type });
      }
      if (path === '/api/login/code') {
        const login = await this.ctx.storage.get('login');
        if (!login) return json({ error: 'Prima inserisci il numero.' }, 400);
        try {
          await tg.signIn({ phone: login.phone, phoneCodeHash: login.hash, phoneCode: String(body.code || ''), abortSignal: limit() });
        } catch (e) {
          if (e?.text === 'SESSION_PASSWORD_NEEDED') { await this.save(); return json({ next: 'password' }); }
          throw e;
        }
        await this.linked();
        return json({ linked: true });
      }
      if (path === '/api/login/password') {
        await tg.checkPassword({ password: String(body.password || ''), abortSignal: limit() });
        await this.linked();
        return json({ linked: true });
      }
      if (path === '/api/send') {
        if (!(await this.ctx.storage.get('linked'))) return json({ error: 'Account non collegato.' }, 409);
        const msg = await tg.sendMedia(TARGET, InputMedia.photo(String(body.image), { caption: String(body.caption || '') }), { abortSignal: limit() });
        return json({ sent: true, messageId: msg.id, ms: Date.now() - t0 });
      }
      if (path === '/api/logout') {
        await tg.logOut().catch(() => {});
        await this.ctx.storage.deleteAll();
        this.tg = null;
        return json({ linked: false });
      }
      return json({ error: 'Percorso sconosciuto.' }, 404);
    } catch (e) {
      return json({ error: e.message || String(e), ms: Date.now() - t0 }, 502);
    }
  }

  async linked() {
    await this.save();
    await this.ctx.storage.put('linked', true);
    await this.ctx.storage.delete('login');
  }
}

async function authorized(request, env) {
  if (!env.SENDER_KEY) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(request.headers.get('Authorization') || '')),
    crypto.subtle.digest('SHA-256', enc.encode(`Bearer ${env.SENDER_KEY}`)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/') return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    for (const k of ['API_ID', 'API_HASH', 'SESSION_KEY', 'SENDER_KEY']) {
      if (!env[k]) return json({ error: `Manca il segreto ${k} nelle impostazioni del Worker.` }, 503);
    }
    if (!(await authorized(request, env))) return json({ error: 'Chiave del servizio non valida.' }, 401);
    return env.SENDER.get(env.SENDER.idFromName('owner')).fetch(request);
  },
};
