// Titolo in italiano con emoji, generato da Workers AI (binding «AI»). null = traduzione non riuscita, da riprovare.
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const SYSTEM = "Traduci in italiano il titolo di un oggetto stampato in 3D da mettere in vendita. Rispondi SOLO con il titolo tradotto, breve e naturale (massimo 60 caratteri), preceduto da 1 o 2 emoji legate all'oggetto. Niente virgolette, niente spiegazioni.";

/** Ripulisce la risposta del modello: prima riga, senza virgolette, prefissi o markdown. */
export function cleanTitle(text) {
  const line = String(text || '').split('\n').map((s) => s.trim()).find(Boolean) || '';
  return line.replace(/^(titolo|title)\s*:\s*/i, '').replace(/^["'«*]+|["'»*]+$/g, '').trim().slice(0, 90);
}

export async function italianTitle(env, item) {
  if (!env.AI) return null;
  try {
    const r = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `${item.title}${item.tags?.length ? ` (tag: ${item.tags.slice(0, 6).join(', ')})` : ''}` },
      ],
      max_tokens: 60,
      temperature: 0.3,
    });
    return cleanTitle(r?.response ?? r?.choices?.[0]?.message?.content) || null;
  } catch {
    return null; // non blocca la coda: l'articolo resta col titolo originale e si riprova più tardi
  }
}
