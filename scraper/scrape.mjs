#!/usr/bin/env node
// Scraper MakerWorld → data/products.json
// Usa un browser reale (Playwright/Chromium) per superare le protezioni anti-bot e
// intercetta le risposte JSON delle API interne del sito, più i dati __NEXT_DATA__.
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, LOCALE, CATEGORIES, DISCOVERY_PATHS, LIMITS } from './config.mjs';
import { collectDesigns, rank } from './score.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/products.json');
const DEBUG = process.env.SCRAPER_DEBUG === '1';
const DEBUG_DIR = resolve(ROOT, 'scraper/debug');
const KEEP_DAYS = 21; // gli articoli restano nel catalogo almeno questi giorni
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const INGEST_TOKEN = process.env.INGEST_TOKEN || '';
// Ogni esecuzione analizza le pagine di tendenza + un gruppo di categorie a rotazione,
// così un giro dura pochi minuti e in poche ore vengono coperte tutte le categorie.
const CATS_PER_RUN = Number(process.env.CATEGORIES_PER_RUN || 2);
const RUN_SLOT_MIN = 30;

function categoriesForThisRun(firstRun) {
  if (firstRun || process.env.SCRAPE_ALL === '1' || CATS_PER_RUN >= CATEGORIES.length) return CATEGORIES;
  const groups = Math.ceil(CATEGORIES.length / CATS_PER_RUN);
  const slot = Math.floor(Date.now() / (RUN_SLOT_MIN * 60000)) % groups;
  return CATEGORIES.slice(slot * CATS_PER_RUN, slot * CATS_PER_RUN + CATS_PER_RUN);
}

async function loadPrevious() {
  try {
    if (SITE_URL) {
      const r = await fetch(`${SITE_URL}/api/catalog`, { headers: { Accept: 'application/json' } });
      if (r.ok) return (await r.json()).items || [];
      log(`⚠️  Catalogo precedente non leggibile da ${SITE_URL} (HTTP ${r.status})`);
    }
    return JSON.parse(await readFile(OUT, 'utf8')).items || [];
  } catch {
    return [];
  }
}

async function upload(catalog) {
  if (!SITE_URL || !INGEST_TOKEN) {
    log('SITE_URL/INGEST_TOKEN non impostati: catalogo salvato solo in locale.');
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(`${SITE_URL}/api/catalog`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INGEST_TOKEN}` },
      body: JSON.stringify(catalog),
    }).catch((e) => ({ ok: false, status: e.message, text: async () => '' }));
    if (r.ok) { log(`☁️  Catalogo inviato a ${SITE_URL}`); return; }
    log(`⚠️  Invio fallito (tentativo ${attempt}): HTTP ${r.status} ${await r.text()}`);
    if (r.status === 401) break;
    await sleep(attempt * 5000);
  }
  throw new Error('Impossibile inviare il catalogo al sito.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    viewport: { width: 1440, height: 1000 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  });
  await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
  const page = await context.newPage();

  const found = new Map();
  let currentHint = null;
  const apiLog = [];

  page.on('response', async (res) => {
    try {
      const url = res.url();
      const ct = res.headers()['content-type'] || '';
      if (!url.includes('makerworld') || !ct.includes('json')) return;
      const json = await res.json();
      const before = found.size;
      collectDesigns(json, found, currentHint);
      apiLog.push({ url, status: res.status(), added: found.size - before });
    } catch { /* risposta non leggibile */ }
  });

  // Il catalogo precedente serve sia per la classifica sia per capire se è il primo giro:
  // al primo giro si analizzano tutte le categorie, così il sito parte subito pieno.
  const previous = await loadPrevious();
  const firstRun = previous.length === 0;
  if (firstRun) log('Primo giro: analizzo tutte le categorie.');

  const targets = [
    ...DISCOVERY_PATHS.map((p) => ({ url: `${BASE}${p}`, hint: null })),
    ...categoriesForThisRun(firstRun).flatMap((c) => c.search.map((q) => ({
      url: `${BASE}/${LOCALE}/search/models?keyword=${encodeURIComponent(q)}`,
      hint: c.key,
    }))),
  ];

  let blocked = 0;
  for (const [i, t] of targets.entries()) {
    currentHint = t.hint;
    const before = found.size;
    try {
      const resp = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      if (resp && resp.status() >= 400) blocked++;

      // Dati incorporati nella pagina (Next.js).
      const embedded = await page.evaluate(() => {
        const el = document.getElementById('__NEXT_DATA__');
        return el ? el.textContent : null;
      });
      if (embedded) collectDesigns(JSON.parse(embedded), found, t.hint);

      for (let s = 0; s < LIMITS.scrollsPerPage; s++) {
        await page.mouse.wheel(0, 2400);
        await sleep(900 + Math.random() * 600);
      }
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

      if (DEBUG && i < 3) {
        await mkdir(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: `${DEBUG_DIR}/page-${i}.png` });
        await writeFile(`${DEBUG_DIR}/page-${i}.html`, await page.content());
      }
    } catch (e) {
      log('⚠️ ', t.url, e.message.split('\n')[0]);
    }
    log(`[${i + 1}/${targets.length}] +${found.size - before} (tot ${found.size}) ${t.url}`);
    await sleep(800 + Math.random() * 1200);
  }

  await browser.close();

  if (DEBUG) {
    await mkdir(DEBUG_DIR, { recursive: true });
    await writeFile(`${DEBUG_DIR}/api-log.json`, JSON.stringify(apiLog, null, 2));
  }

  log(`Modelli trovati: ${found.size}` + (blocked ? ` (pagine con errore: ${blocked})` : ''));
  if (!found.size) {
    console.error('Nessun modello estratto: il catalogo esistente NON viene sovrascritto.');
    process.exit(2);
  }

  // I modelli del catalogo precedente rientrano nella classifica insieme ai nuovi
  // (con statistiche aggiornate se ritrovati), così le categorie non analizzate
  // in questo giro non spariscono.
  const pool = new Map(previous.map((p) => [String(p.id), p]));
  for (const [id, d] of found) pool.set(id, { ...pool.get(id), ...d });
  const { items, rejected } = rank([...pool.values()]);
  log(`Selezionati: ${items.length} su ${pool.size} · Esclusi →`, rejected);

  const nowIso = new Date().toISOString();
  const prevById = new Map(previous.map((p) => [p.id, p]));
  const merged = items.map((it) => ({ ...it, firstSeen: prevById.get(it.id)?.firstSeen || nowIso }));
  const ids = new Set(merged.map((x) => x.id));
  for (const p of previous) {
    if (ids.has(p.id)) continue;
    const age = (Date.now() - new Date(p.firstSeen || 0)) / 864e5;
    if (age < KEEP_DAYS) merged.push(p);
  }

  const catalog = {
    generatedAt: nowIso,
    source: `${BASE}/${LOCALE}`,
    count: merged.length,
    categories: [...CATEGORIES.map(({ key, label, emoji }) => ({ key, label, emoji })), { key: 'altro', label: 'Altro', emoji: '📦' }],
    items: merged,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(catalog, null, 1)}\n`);
  log(`Scritto ${OUT} (${merged.length} articoli)`);
  await upload(catalog);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
