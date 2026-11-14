// Cifratura AES-GCM della sessione Telegram prima di salvarla nel Durable Object.
async function keyFrom(secret) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(secret, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(secret), new TextEncoder().encode(text));
  return { iv: [...iv], data: [...new Uint8Array(data)] };
}

export async function open(secret, box) {
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(box.iv) }, await keyFrom(secret), new Uint8Array(box.data));
  return new TextDecoder().decode(data);
}
