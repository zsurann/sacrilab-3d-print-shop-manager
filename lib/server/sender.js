// Invio su Telegram dall'account del proprietario tramite il servizio separato (cartella sender/).

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

/** Chiama il servizio di invio via service binding «SENDER», protetto da SENDER_KEY. */
export async function sender(env, path, body) {
  if (!env.SENDER || !env.SENDER_KEY) {
    throw Object.assign(new Error('Servizio di invio non collegato: aggiungi il binding «SENDER» e il segreto SENDER_KEY al progetto Cloudflare Pages.'), { status: 503 });
  }
  const res = await env.SENDER.fetch(`https://sender/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${env.SENDER_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 401 qui significa SENDER_KEY diversa tra sito e servizio: è un problema di configurazione, non di sessione.
    const msg = res.status === 401 ? 'SENDER_KEY diversa tra il sito e il servizio di invio.' : data.error;
    throw Object.assign(new Error(msg || `Servizio di invio: errore ${res.status}`), { status: res.status === 401 ? 502 : res.status });
  }
  return data;
}
