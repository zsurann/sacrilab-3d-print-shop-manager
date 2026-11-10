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

  const targets = [
    ...DISCOVERY_PATHS.map((p) => ({ url: `${BASE}${p}`, hint: null })),
    ...CATEGORIES.flatMap((c) => c.search.map((q) => ({
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
  const { items, rejected } = rank([...found.values()]);
  log(`Selezionati: ${items.length} · Esclusi →`, rejected);

  if (!items.length) {
    console.error('Nessun modello estratto: il catalogo esistente NON viene sovrascritto.');
    process.exit(2);
  }

  // Unione con il catalogo precedente per non far sparire articoli ancora da valutare.
  let previous = [];
  try { previous = JSON.parse(await readFile(OUT, 'utf8')).items || []; } catch { /* primo avvio */ }
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
