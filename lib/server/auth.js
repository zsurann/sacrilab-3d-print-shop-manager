// Accesso: password del gestore (scelta al primo avvio, salvata come hash su KV)
// + password del proprietario (variabile segreta OWNER_PASSWORD su Cloudflare), sempre valida.
import { safeEqual } from './store.js';

const ITERATIONS = 10000; // PBKDF2: compromesso tra sicurezza e limiti di CPU di Cloudflare
const SESSION_TTL = 60 * 60 * 24 * 365; // un anno: su ogni dispositivo si entra una volta sola

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n) => toHex(crypto.getRandomValues(new Uint8Array(n)));

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS },
    key,
    256,
  );
  return toHex(bits);
}

export const getManager = (env) => env.KV.get('auth:manager', 'json');

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 6) return 'La password deve avere almeno 6 caratteri.';
  if (pw.length > 200) return 'Password troppo lunga.';
  return null;
}

/** Salva (o cambia) la password del gestore. Cambiandola, le sessioni del gestore
 *  sugli altri dispositivi scadono. */
export async function setManagerPassword(env, password) {
  const prev = await getManager(env);
  const salt = randomHex(16);
  const record = { salt, hash: await hashPassword(password, salt), version: (prev?.version || 0) + 1, updatedAt: new Date().toISOString() };
  await env.KV.put('auth:manager', JSON.stringify(record));
  return record;
}

/** Restituisce il ruolo ('owner' | 'manager') se la password è corretta, altrimenti null. */
export async function checkPassword(env, password) {
  if (!password) return null;
  if (env.OWNER_PASSWORD && safeEqual(password, env.OWNER_PASSWORD)) return 'owner';
  const m = await getManager(env);
  if (m && safeEqual(await hashPassword(password, m.salt), m.hash)) return 'manager';
  return null;
}

export async function createSession(env, role) {
  const token = randomHex(32);
  const m = role === 'manager' ? await getManager(env) : null;
  await env.KV.put(`session:${token}`, JSON.stringify({ role, version: m?.version || 0, at: Date.now() }), { expirationTtl: SESSION_TTL });
  return token;
}

export async function getSession(env, token) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const s = await env.KV.get(`session:${token}`, 'json');
  if (!s) return null;
  if (s.role === 'owner') return env.OWNER_PASSWORD ? s : null;
  const m = await getManager(env);
  return m && m.version === s.version ? s : null;
}

export const deleteSession = (env, token) => env.KV.delete(`session:${token}`);
