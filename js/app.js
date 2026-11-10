import * as store from './store.js';

const { formatPrice } = store;
const SYNC_MS = 60_000;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const ICONS = {
  dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>',
  like: '<svg viewBox="0 0 24 24"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
  err: '<svg viewBox="0 0 24 24"><path d="M12 8v5m0 3.5v.5M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8v.5"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
};

const ui = {
  view: 'pending',
  category: 'all',
  query: '',
  sort: 'score',
};

const FEED_CACHE = 'sacrilab.feed.v1';
let catalog = { items: [], categories: [], generatedAt: null, nextReleaseAt: 0, batchSize: 5 };
try { Object.assign(catalog, JSON.parse(localStorage.getItem(FEED_CACHE)) || {}); } catch { /* nessuna cache */ }
let session = null;
let pendingRender = false;

/* ------------------------------------------------------------------ data */

const feedSig = () => catalog.items.map((x) => x.id).join(',');
const stateSig = () => JSON.stringify([Object.keys(store.state.published).sort(), Object.keys(store.state.discarded).sort()]);

/** Scarica gli articoli sbloccati (5 ogni 30 minuti) e le decisioni condivise. */
async function fetchFeed() {
  const { data } = await store.api('feed');
  store.applyState(data.state);
  catalog = {
    items: Array.isArray(data.items) ? data.items : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    generatedAt: data.generatedAt || null,
    nextReleaseAt: data.nextReleaseAt || 0,
    batchSize: data.batchSize || 5,
  };
  try { localStorage.setItem(FEED_CACHE, JSON.stringify(catalog)); } catch { /* storage pieno */ }
}

/** In background aggiorna lo schermo solo se qualcosa è cambiato e non stai scrivendo. */
async function sync({ manual = false } = {}) {
  const btn = $('#btn-refresh');
  if (manual) btn.classList.add('spinning');
  const before = feedSig() + stateSig();
  const prevIds = new Set(catalog.items.map((x) => x.id));
  try {
    await fetchFeed();
    const fresh = catalog.items.filter((x) => !prevIds.has(x.id)).length;
    if (prevIds.size && fresh) toast(fresh === 1 ? 'Nuovo articolo da valutare' : `${fresh} nuovi articoli da valutare`, 'info');
    else if (manual) toast('Tutto aggiornato', 'info');
    if (before !== feedSig() + stateSig() || manual) safeRender();
    else renderFooter();
  } catch (e) {
    if (e.status === 401) return showLogin();
    if (manual) toast(e.message || 'Impossibile aggiornare', 'err');
    console.warn(e);
  } finally {
    if (manual) setTimeout(() => btn.classList.remove('spinning'), 400);
  }
}

function safeRender() {
  const typing = document.activeElement?.closest?.('#grid') && document.activeElement.matches('input, textarea');
  if (typing || $('#grid .card[data-busy]')) { pendingRender = true; return; }
  pendingRender = false;
  render();
}

function itemsFor(view) {
  return catalog.items.filter((it) => store.statusOf(it.id) === view);
}

function visibleItems() {
  const q = ui.query.trim().toLowerCase();
  let list = itemsFor(ui.view);
  if (ui.category !== 'all') list = list.filter((it) => it.category === ui.category);
  if (q) list = list.filter((it) => `${titleOf(it)} ${it.title} ${it.author || ''} ${(it.tags || []).join(' ')}`.toLowerCase().includes(q));
  const s = (it) => it.stats || {};
  const sorters = {
    score: (a, b) => (b.score || 0) - (a.score || 0),
    downloads: (a, b) => (s(b).downloads || 0) - (s(a).downloads || 0),
    likes: (a, b) => (s(b).likes || 0) - (s(a).likes || 0),
    prints: (a, b) => (s(b).prints || 0) - (s(a).prints || 0),
    recent: (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0),
  };
  if (ui.view !== 'pending') {
    const bucket = ui.view === 'published' ? store.state.published : store.state.discarded;
    return list.sort((a, b) => (bucket[b.id]?.at || 0) - (bucket[a.id]?.at || 0));
  }
  return list.sort(sorters[ui.sort] || sorters.score);
}

const titleOf = (it) => store.draftTitle(it.id) ?? it.title;

/* ---------------------------------------------------------------- render */

function render() {
  renderCounts();
  renderChips();
  renderGrid();
  renderFooter();
  renderBanner();
}

function renderBanner() {
  const banner = $('#setup-banner');
  if (!session) { banner.hidden = true; return; }
  if (!session.bot) {
    $('#banner-title').textContent = 'Bot Telegram non collegato';
    $('#banner-text').textContent = session.botError || 'Inserisci il token del bot nelle impostazioni.';
  } else {
    $('#banner-title').textContent = 'Scegli la chat Telegram';
    $('#banner-text').textContent = `Il bot @${session.bot.username} è collegato: indica dove pubblicare i prodotti.`;
  }
  banner.hidden = Boolean(session.bot && session.chatId);
}

function renderCounts() {
  for (const k of ['pending', 'published', 'discarded']) {
    const n = itemsFor(k).length;
    const b = $(`.stat[data-k="${k}"] b`);
    if (b.textContent !== String(n)) {
      animateNumber(b, Number(b.textContent) || 0, n);
      b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
    }
    $(`[data-count="${k}"]`).textContent = n;
  }
}

function animateNumber(el, from, to) {
  const start = performance.now();
  const dur = 500;
  const step = (t) => {
    const p = Math.min(1, (t - start) / dur);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderChips() {
  const base = itemsFor(ui.view);
  const counts = base.reduce((m, it) => (m[it.category] = (m[it.category] || 0) + 1, m), {});
  const cats = [{ key: 'all', label: 'Tutti', emoji: '✨' }, ...catalog.categories.filter((c) => counts[c.key])];
  if (ui.category !== 'all' && !counts[ui.category]) ui.category = 'all';
  const html = cats.map((c) => `<button class="chip ${ui.category === c.key ? 'active' : ''}" data-cat="${c.key}" role="listitem">${c.emoji || ''} ${esc(c.label)} <small>${c.key === 'all' ? base.length : counts[c.key]}</small></button>`).join('');
  $('#chips').innerHTML = html;
}

function renderGrid() {
  const grid = $('#grid');
  const list = visibleItems();
  grid.replaceChildren(...list.map((it, i) => buildCard(it, i)));
  const empty = $('#empty');
  empty.hidden = list.length > 0;
  if (!list.length) {
    const noData = catalog.items.length === 0;
    const msgs = {
      pending: noData
        ? ['Preparazione dei primi articoli…', 'Sto analizzando MakerWorld per scegliere i modelli più vendibili. I primi 5 articoli compariranno qui da soli tra pochi minuti.']
        : ui.query || ui.category !== 'all'
          ? ['Nessun risultato', 'Prova a cambiare ricerca o categoria.']
          : ['Tutto fatto! 🎉', `Hai valutato tutti gli articoli. ${nextBatchText()}.`],
      published: ['Ancora nessuna pubblicazione', 'Gli articoli pubblicati su Telegram compariranno qui.'],
      discarded: ['Nessun articolo scartato', 'Gli articoli scartati compariranno qui e potrai ripristinarli.'],
    };
    const [t, d] = msgs[ui.view];
    $('#empty-title').textContent = t;
    $('#empty-text').textContent = d;
  }
}

function minutesToNext() {
  return Math.max(0, Math.ceil(((catalog.nextReleaseAt || 0) - Date.now()) / 60000));
}
function nextBatchText() {
  if (!catalog.nextReleaseAt) return `Ogni 30 minuti arrivano ${catalog.batchSize} nuovi articoli`;
  const m = minutesToNext();
  return m <= 0 ? `I prossimi ${catalog.batchSize} articoli stanno arrivando` : `I prossimi ${catalog.batchSize} articoli arrivano tra ${m} min`;
}

function renderFooter() {
  const when = catalog.generatedAt ? new Date(catalog.generatedAt).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  $('#foot').textContent = `Analisi MakerWorld: ${when} · Sacrilab`;
  const pending = itemsFor('pending').length;
  $('#hero-sub').textContent = pending
    ? `${pending} ${pending === 1 ? 'articolo' : 'articoli'} da valutare, scelti tra i più vendibili di MakerWorld.`
    : 'I modelli più vendibili di MakerWorld, selezionati per te.';
  const box = $('#next-batch');
  box.hidden = !catalog.nextReleaseAt;
  if (catalog.nextReleaseAt) {
    const SLOT = 30 * 60000;
    const left = Math.max(0, catalog.nextReleaseAt - Date.now());
    $('#next-batch-label').textContent = nextBatchText();
    $('#next-batch-fill').style.transform = `scaleX(${Math.min(1, 1 - left / SLOT)})`;
  }
}

const fmt = (n) => (n >= 10000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n || 0));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buildCard(it, i) {
  const card = $('#card-tpl').content.firstElementChild.cloneNode(true);
  card.dataset.id = it.id;
  card.style.setProperty('--i', Math.min(i, 12));
  card.style.viewTransitionName = `c${String(it.id).replace(/\W/g, '')}`;

  const img = $('img', card);
  img.alt = it.title;
  img.addEventListener('load', () => { img.classList.add('loaded'); $('.skeleton', card)?.remove(); }, { once: true });
  img.addEventListener('error', () => { $('.skeleton', card)?.remove(); }, { once: true });
  img.src = it.image;

  const latestBatch = Math.max(0, ...catalog.items.map((x) => x.batch || 0));
  $('.badge-new', card).hidden = !(ui.view === 'pending' && it.batch && it.batch === latestBatch && latestBatch > 1);

  const score = Math.round(it.score || 0);
  const sb = $('.badge-score', card);
  sb.textContent = `${score >= 80 ? '🔥' : '★'} ${score}`;
  sb.classList.toggle('hot', score >= 80);
  const cat = catalog.categories.find((c) => c.key === it.category);
  $('.badge-cat', card).textContent = cat ? `${cat.emoji || ''} ${cat.label}` : 'Altro';
  $('.badge-link', card).href = it.url;

  const title = $('.card-title', card);
  title.value = titleOf(it);
  title.readOnly = ui.view !== 'pending';
  autoGrow(title);

  const st = it.stats || {};
  $('.card-meta', card).innerHTML = `
    <span title="Download">${ICONS.dl}${fmt(st.downloads)}</span>
    <span title="Mi piace">${ICONS.like}${fmt(st.likes)}</span>
    <span title="Stampe">${ICONS.print}${fmt(st.prints)}</span>
    ${it.author ? `<span title="Autore">di ${esc(it.author)}</span>` : ''}`;

  const reasons = (it.flags || []).map((f) => `<span class="warn" title="Verifica prima di vendere">⚠️ ${esc(f)}</span>`);
  reasons.push(...(it.reasons || []).slice(0, 3).map((r) => `<span>${esc(r)}</span>`));
  if (it.license) reasons.push(`<span class="lic" title="Licenza del modello">${esc(it.license)}</span>`);
  $('.card-reasons', card).innerHTML = reasons.join('');

  const actions = $('.card-actions', card);
  if (ui.view === 'pending') {
    const price = store.draftPrice(it.id) ?? '';
    actions.innerHTML = `
      <label class="price">
        <input type="text" inputmode="decimal" enterkeyhint="send" placeholder="Prezzo" value="${esc(price)}" aria-label="Prezzo in euro" />
        <b>€</b>
      </label>
      <div class="btn-row">
        <button class="btn btn-discard" data-act="discard" title="Scarta prodotto">${ICONS.trash}<span>Scarta</span></button>
        <button class="btn btn-tg" data-act="publish" ${formatPrice(price) ? '' : 'disabled'}>${ICONS.send}<span>Pubblica</span></button>
      </div>`;
  } else {
    const rec = (ui.view === 'published' ? store.state.published : store.state.discarded)[it.id] || {};
    const when = rec.at ? new Date(rec.at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '';
    actions.innerHTML = `
      <div class="done-row">
        ${ui.view === 'published' ? `<span class="tag ok">✓ Pubblicato a ${esc(rec.price)}€</span>` : '<span class="tag no">Scartato</span>'}
        <time>${when}</time>
      </div>
      <button class="btn btn-ghost btn-sm" data-act="restore">${ICONS.undo}<span>${ui.view === 'published' ? 'Rimetti in valutazione' : 'Ripristina'}</span></button>`;
  }
  return card;
}

function autoGrow(ta) {
  requestAnimationFrame(() => { ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`; });
}

/* --------------------------------------------------------------- actions */

function withTransition(fn) {
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.startViewTransition(fn);
  } else fn();
}

function removeCard(card, kind) {
  return new Promise((resolve) => {
    card.classList.add(kind === 'publish' ? 'leaving-publish' : 'leaving-discard');
    card.style.viewTransitionName = 'none';
    setTimeout(() => withTransition(() => { card.remove(); resolve(); }), kind === 'publish' ? 600 : 380);
  });
}

async function onPublish(card, it) {
  const input = $('.price input', card);
  const price = formatPrice(input.value);
  if (!price) return shake($('.price', card));
  if (session && (!session.bot || !session.chatId)) {
    toast(session.bot ? 'Scegli prima la chat Telegram' : 'Bot Telegram non configurato', 'err');
    return openSettings();
  }
  if (card.dataset.busy) return;
  const title = $('.card-title', card).value.trim() || it.title;
  const btn = $('[data-act="publish"]', card);
  card.dataset.busy = '1';
  btn.classList.add('loading');
  try {
    await store.publish(it.id, title, price);
    haptic(20);
    confetti(btn);
    toast(`Pubblicato: ${title}, ${price}€`, 'ok');
    await removeCard(card, 'publish');
    afterChange();
  } catch (e) {
    btn.classList.remove('loading');
    delete card.dataset.busy;
    if (e.status === 401) return showLogin();
    toast(e.message || 'Errore durante la pubblicazione', 'err');
    if (e.status === 409) sync();
  }
}

async function onDiscard(card, it) {
  if (card.dataset.busy) return;
  card.dataset.busy = '1';
  haptic(10);
  const req = store.discard(it.id);
  req.catch(() => {}); // l'errore viene gestito sotto, dopo l'animazione
  await removeCard(card, 'discard');
  afterChange();
  try {
    await req;
    toast('Prodotto scartato', 'info', {
      label: 'Annulla',
      fn: () => store.restore(it.id).then(() => withTransition(render)).catch((e) => toast(e.message, 'err')),
    });
  } catch (e) {
    toast(e.message || 'Impossibile scartare', 'err');
    if (e.status === 401) return showLogin();
    sync();
  }
}

async function onRestore(card, it) {
  if (card.dataset.busy) return;
  card.dataset.busy = '1';
  const req = store.restore(it.id);
  req.catch(() => {});
  await removeCard(card, 'discard');
  afterChange();
  try {
    await req;
    toast('Articolo rimesso in valutazione', 'info');
  } catch (e) {
    toast(e.message || 'Impossibile ripristinare', 'err');
    if (e.status === 401) return showLogin();
    sync();
  }
}

function afterChange() {
  renderCounts(); renderChips(); maybeEmpty();
  if (pendingRender) safeRender();
}

function maybeEmpty() {
  if (!$('#grid').children.length) renderGrid();
}

function shake(el) {
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  $('input', el)?.focus();
  haptic([10, 40, 10]);
}

const haptic = (p) => { try { navigator.vibrate?.(p); } catch { /* noop */ } };

function confetti(origin) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = origin.getBoundingClientRect();
  const colors = ['#ff5e3a', '#ff9a3c', '#8b5cf6', '#2aabee', '#34d399', '#facc15'];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.background = colors[i % colors.length];
    c.style.left = `${r.left + r.width / 2}px`;
    c.style.top = `${r.top + r.height / 2}px`;
    document.body.append(c);
    const a = Math.random() * Math.PI * 2;
    const v = 80 + Math.random() * 140;
    c.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * v}px, ${Math.sin(a) * v - 60}px) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${Math.cos(a) * v * 1.2}px, ${Math.sin(a) * v + 120}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => c.remove();
  }
}

/* ----------------------------------------------------------------- toast */

function toast(msg, type = 'ok', action) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="ico">${ICONS[type] || ICONS.info}</div><span></span>`;
  $('span', el).textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => { action.fn(); close(); };
    el.append(b);
  }
  box.append(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  setTimeout(close, action ? 5000 : 3200);
}

/* -------------------------------------------------------------- settings */

function renderBotStatus() {
  const box = $('#bot-status');
  if (!session) { box.innerHTML = ''; return; }
  box.classList.toggle('err', !session.bot);
  box.innerHTML = session.bot
    ? `<span class="dot"></span><div><strong>@${esc(session.bot.username)} collegato</strong><small>Attivo su tutti i dispositivi</small></div>`
    : `<span class="dot"></span><div><strong>Bot non collegato</strong><small>${esc(session.botError || '')}</small></div>`;
}

function openSettings() {
  renderBotStatus();
  $('#bot-token-field').hidden = Boolean(session?.botFromEnv);
  $('#tg-token').value = '';
  $('#new-pass').value = '';
  $('#role-info').textContent = session?.role === 'owner'
    ? 'Sei entrato con la password del proprietario.'
    : 'Sei entrato con la password del gestore.';
  $('#tg-chat').value = session?.chatId || '';
  $('#tg-format').value = session?.format || '{titolo}, {prezzo}€';
  $('#chat-list').hidden = true;
  $('#sheet-backdrop').hidden = false;
  $('#settings').hidden = false;
}
function closeSettings() {
  const sheet = $('#settings');
  const bd = $('#sheet-backdrop');
  sheet.classList.add('closing'); bd.classList.add('closing');
  setTimeout(() => { sheet.hidden = bd.hidden = true; sheet.classList.remove('closing'); bd.classList.remove('closing'); }, 280);
}

function closeSettingsNow() {
  $('#settings').hidden = true;
  $('#sheet-backdrop').hidden = true;
}

async function withLoading(btn, fn) {
  btn.classList.add('loading');
  try { await fn(); } catch (err) {
    if (err.status === 401) showLogin();
    else toast(err.message, 'err');
  } finally { btn.classList.remove('loading'); }
}

async function saveSettings() {
  const { data } = await store.api('settings', { method: 'POST', body: { chatId: $('#tg-chat').value.trim(), format: $('#tg-format').value.trim() } });
  session = { ...session, ...data.settings };
  renderBanner();
}

function bindSettings() {
  $('#btn-settings').onclick = openSettings;
  $('#banner-setup').onclick = openSettings;
  $('#sheet-backdrop').onclick = closeSettings;
  $('#settings [data-close]').onclick = closeSettings;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#lightbox').hidden) $('#lightbox').hidden = true;
    else if (!$('#settings').hidden) closeSettings();
  });

  $('#settings-form').onsubmit = (e) => {
    e.preventDefault();
    withLoading($('#settings-form [type=submit]'), async () => {
      await saveSettings();
      toast('Impostazioni salvate per tutti i dispositivi', 'ok');
      closeSettings();
    });
  };

  $('#find-chat').onclick = (e) => withLoading(e.currentTarget, async () => {
    const { data } = await store.api('chats');
    const list = $('#chat-list');
    list.hidden = false;
    list.innerHTML = data.chats.length
      ? data.chats.map((c) => `<button type="button" data-id="${esc(c.id)}"><strong>${esc(c.name)}</strong><small>${esc(c.type)} · ID ${esc(c.id)}</small></button>`).join('')
      : `<p class="hint">Nessuna chat trovata. Apri <a href="https://t.me/${esc(data.bot.username)}" target="_blank" rel="noopener">@${esc(data.bot.username)}</a>, premi Avvia e scrivi un messaggio, poi riprova.</p>`;
    $$('button', list).forEach((b) => (b.onclick = () => { $('#tg-chat').value = b.dataset.id; list.hidden = true; toast('Chat selezionata: premi Salva', 'ok'); }));
  });

  $('#test-tg').onclick = (e) => withLoading(e.currentTarget, async () => {
    await saveSettings();
    await store.api('test', { method: 'POST' });
    toast('Messaggio di prova inviato!', 'ok');
  });

  $('#save-token').onclick = (e) => withLoading(e.currentTarget, async () => {
    const data = await store.saveBotToken($('#tg-token').value);
    $('#tg-token').value = '';
    await loadSession();
    renderBotStatus();
    toast(`Bot @${data.bot.username} collegato`, 'ok');
  });

  $('#change-pass').onclick = (e) => withLoading(e.currentTarget, async () => {
    const pw = $('#new-pass').value;
    if (pw.length < 6) throw new Error('La password deve avere almeno 6 caratteri.');
    await store.changePassword(pw);
    $('#new-pass').value = '';
    toast('Password del gestore cambiata', 'ok');
  });

  $('#logout').onclick = async () => { await store.logout(); showLogin(); };

  $('#reset-state').onclick = () => {
    if (!confirm('Rimettere in valutazione tutti gli articoli pubblicati e scartati, su tutti i dispositivi?')) return;
    store.resetAll().then(() => { render(); toast('Tutti gli articoli sono di nuovo da valutare', 'info'); }).catch((err) => toast(err.message, 'err'));
  };
}

/* ----------------------------------------------------------------- login */

let loginMode = 'login'; // 'login' | 'setup' | 'bot'

function openLoginOverlay() {
  const el = $('#login');
  el.classList.remove('leaving');
  el.hidden = false;
  document.body.classList.add('locked');
}

function closeLoginOverlay() {
  const el = $('#login');
  if (el.hidden) return Promise.resolve();
  document.body.classList.remove('locked');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.hidden = true; return Promise.resolve(); }
  el.classList.add('leaving');
  return new Promise((r) => setTimeout(() => { el.hidden = true; el.classList.remove('leaving'); r(); }, 520));
}

function setLoginMode(mode, botFromEnv = false) {
  loginMode = mode;
  const setup = mode === 'setup';
  const bot = mode === 'bot';
  $('#pass-fields').hidden = bot;
  $('#pass2-field').hidden = !setup;
  $('#bot-field').hidden = !(setup || bot) || botFromEnv;
  $('#login-switch').hidden = !(setup || bot);
  $('#login-switch').textContent = bot ? 'Esci ed entra con un\'altra password' : 'Ho già una password';
  $('#login-form').dataset.mode = mode;
  $('#login-sub').textContent = setup ? 'Benvenuto! Crea la password del gestore e collega il bot'
    : bot ? 'Ultimo passo: collega il bot Telegram' : '3D Print Shop Manager';
  $('#login-pass-label').textContent = setup ? 'Nuova password (almeno 6 caratteri)' : 'Password';
  $('#login-pass').autocomplete = setup ? 'new-password' : 'current-password';
  $('#login-btn').textContent = setup ? 'Crea password ed entra' : bot ? 'Collega il bot' : 'Entra';
}

function clearLocalData() {
  catalog = { items: [], categories: [], generatedAt: null, nextReleaseAt: 0, batchSize: 5 };
  try { localStorage.removeItem(FEED_CACHE); } catch { /* noop */ }
  store.clearLocal();
  session = null;
  closeSettingsNow();
  render();
}

async function showLogin(msg = '') {
  store.forget();
  clearLocalData();
  openLoginOverlay();
  $('#login-err').textContent = msg;
  try {
    const st = await store.authStatus();
    setLoginMode(st.needsSetup ? 'setup' : 'login', st.botFromEnv);
  } catch (e) {
    setLoginMode('login');
    $('#login-err').textContent = e.message;
  }
  setTimeout(() => $('#login-pass').focus(), 200);
}

/** Senza un bot Telegram funzionante non si può usare l'app. */
function requireBot() {
  if (session?.bot) return false;
  openLoginOverlay();
  setLoginMode('bot', session?.botFromEnv);
  $('#login-err').textContent = session?.botError || '';
  setTimeout(() => $('#login-bot').focus(), 200);
  return true;
}

async function loadSession() {
  const { data } = await store.api('session');
  session = data;
  renderBanner();
}

function bindLogin() {
  $('#login-switch').onclick = async () => {
    if (loginMode === 'bot') { await store.logout(); return showLogin(); }
    setLoginMode('login');
  };
  // Mostra/nascondi password.
  $('#login-form').addEventListener('click', (e) => {
    const b = e.target.closest('[data-eye]');
    if (!b) return;
    const inp = b.previousElementSibling;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    b.classList.toggle('on', inp.type === 'text');
    inp.focus();
  });
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#login-btn');
    const pw = $('#login-pass').value;
    const botToken = $('#login-bot').value.trim();
    const mode = loginMode;
    $('#login-err').textContent = '';
    btn.classList.add('loading');
    try {
      if (mode === 'setup') {
        if (pw.length < 6) throw new Error('La password deve avere almeno 6 caratteri.');
        if (pw !== $('#login-pass2').value) throw new Error('Le due password non coincidono.');
        if (!$('#bot-field').hidden && !botToken) throw new Error('Inserisci il token del bot Telegram per continuare.');
        await store.setup(pw, botToken);
      } else if (mode === 'bot') {
        if (!botToken) throw new Error('Inserisci il token del bot Telegram per continuare.');
        await store.saveBotToken(botToken);
      } else {
        if (!pw) throw new Error('Inserisci la password.');
        await store.login(pw);
      }
      await loadSession();
      if (requireBot()) return;
      btn.classList.remove('loading');
      btn.classList.add('success');
      await fetchFeed().catch(() => {});
      await new Promise((r) => setTimeout(r, 380));
      render();
      await closeLoginOverlay();
      btn.classList.remove('success');
      for (const id of ['#login-pass', '#login-pass2', '#login-bot']) { $(id).value = ''; $(id).type = 'password'; }
      if (mode !== 'login') toast(`Bot @${session.bot.username} collegato! Ora scegli la chat`, 'ok');
      if (!session.chatId) openSettings();
    } catch (err) {
      if (err.status === 409) setLoginMode('login');
      $('#login-err').textContent = err.message;
      const card = $('.login-card');
      card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    } finally {
      btn.classList.remove('loading');
    }
  };
}

/* ---------------------------------------------------------------- events */

function moveIndicator() {
  const active = $('.tab.active');
  const ind = $('.tab-indicator');
  ind.style.width = `${active.offsetWidth}px`;
  ind.style.transform = `translateX(${active.offsetLeft}px)`;
}

function bindUI() {
  $('#tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t || t.classList.contains('active')) return;
    $$('.tab').forEach((x) => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', String(x === t)); });
    ui.view = t.dataset.view;
    ui.category = 'all';
    moveIndicator();
    $('.toolbar .select-wrap').style.visibility = ui.view === 'pending' ? '' : 'hidden';
    withTransition(() => { renderChips(); renderGrid(); });
  });
  addEventListener('resize', moveIndicator);

  $('#chips').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    ui.category = c.dataset.cat;
    $$('.chip').forEach((x) => x.classList.toggle('active', x === c));
    c.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    renderGrid();
  });

  let qT;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(qT);
    qT = setTimeout(() => { ui.query = e.target.value; renderGrid(); }, 160);
  });
  $('#sort').addEventListener('change', (e) => { ui.sort = e.target.value; withTransition(renderGrid); });
  $('#btn-refresh').onclick = () => sync({ manual: true });

  const grid = $('#grid');
  const itemOf = (card) => catalog.items.find((x) => String(x.id) === card.dataset.id);

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const it = itemOf(card);
    const act = e.target.closest('[data-act]');
    if (act) {
      ripple(act, e);
      if (act.dataset.act === 'publish') onPublish(card, it);
      else if (act.dataset.act === 'discard') onDiscard(card, it);
      else if (act.dataset.act === 'restore') onRestore(card, it);
      return;
    }
    if (e.target.closest('.card-media') && !e.target.closest('a')) openLightbox(it);
  });

  grid.addEventListener('input', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    if (e.target.matches('.price input')) {
      const v = e.target.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');
      if (v !== e.target.value) e.target.value = v;
      store.setDraft(card.dataset.id, 'price', v);
      $('[data-act="publish"]', card).disabled = !formatPrice(v);
    } else if (e.target.matches('.card-title')) {
      const it = itemOf(card);
      store.setDraft(card.dataset.id, 'title', e.target.value === it.title ? '' : e.target.value);
      autoGrow(e.target);
    }
  });
  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const card = e.target.closest('.card');
    if (e.target.matches('.price input')) { e.preventDefault(); onPublish(card, itemOf(card)); }
    if (e.target.matches('.card-title')) { e.preventDefault(); $('.price input', card)?.focus(); }
  });

  $('#lightbox').onclick = () => ($('#lightbox').hidden = true);

  // Aggiorna lo schermo rimandato mentre stavi scrivendo.
  grid.addEventListener('focusout', () => setTimeout(() => { if (pendingRender) safeRender(); }, 150));
}

function ripple(btn, e) {
  const r = btn.getBoundingClientRect();
  const s = Math.max(r.width, r.height);
  const el = document.createElement('span');
  el.className = 'ripple';
  Object.assign(el.style, { width: `${s}px`, height: `${s}px`, left: `${(e.clientX || r.left + r.width / 2) - r.left - s / 2}px`, top: `${(e.clientY || r.top + r.height / 2) - r.top - s / 2}px` });
  btn.append(el);
  setTimeout(() => el.remove(), 600);
}

function openLightbox(it) {
  $('#lightbox-img').src = it.image;
  $('#lightbox-cap').textContent = titleOf(it);
  $('#lightbox').hidden = false;
}

/* ------------------------------------------------------------------ boot */

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Nuova versione disponibile', 'info', { label: 'Aggiorna', fn: () => location.reload() });
        }
      });
    });
  }).catch(console.warn);
}

async function boot() {
  bindUI();
  bindSettings();
  bindLogin();
  requestAnimationFrame(moveIndicator);
  document.fonts?.ready.then(moveIndicator);
  registerSW();

  // Aggiornamenti periodici: partono sempre, ma lavorano solo quando si è entrati.
  const canSync = () => document.visibilityState === 'visible' && store.hasKey() && $('#login').hidden;
  setInterval(renderFooter, 15_000);
  setInterval(() => { if (canSync()) sync(); }, SYNC_MS);
  document.addEventListener('visibilitychange', () => { if (canSync()) sync(); });
  addEventListener('online', () => { if (canSync()) sync(); });

  // Mostra subito i dati in cache, poi sincronizza.
  if (!store.hasKey()) return showLogin();
  render();
  try {
    await loadSession();
    if (requireBot()) return;
    await sync();
  } catch (e) {
    if (e.status === 401) return showLogin();
    toast(e.message, 'err');
  }
}

boot();
