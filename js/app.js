import * as store from './store.js';
import { publishProduct, sendText, findChats, formatPrice, buildCaption } from './telegram.js';

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

let catalog = { items: [], categories: [], generatedAt: null };

/* ------------------------------------------------------------------ data */

async function loadCatalog({ silent = false } = {}) {
  const btn = $('#btn-refresh');
  btn.classList.add('spinning');
  const url = store.settings.dataUrl || 'data/products.json';
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    catalog = {
      items: Array.isArray(data.items) ? data.items : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      generatedAt: data.generatedAt || null,
    };
    if (!silent) toast(`Catalogo aggiornato: ${catalog.items.length} articoli`, 'info');
  } catch (e) {
    if (!silent) toast('Impossibile caricare il catalogo', 'err');
    console.error(e);
  } finally {
    setTimeout(() => btn.classList.remove('spinning'), 400);
  }
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

const titleOf = (it) => store.state.titles[it.id] ?? it.title;

/* ---------------------------------------------------------------- render */

function render() {
  renderCounts();
  renderChips();
  renderGrid();
  renderFooter();
  $('#setup-banner').hidden = Boolean(store.settings.token && store.settings.chatId);
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
        ? ['Catalogo vuoto', 'Il catalogo viene generato automaticamente da GitHub Actions analizzando MakerWorld. Avvia il workflow «Aggiorna catalogo MakerWorld» oppure attendi il prossimo aggiornamento.']
        : ui.query || ui.category !== 'all'
          ? ['Nessun risultato', 'Prova a cambiare ricerca o categoria.']
          : ['Tutto fatto! 🎉', 'Hai valutato tutti gli articoli. Nuovi modelli arriveranno al prossimo aggiornamento del catalogo.'],
      published: ['Ancora nessuna pubblicazione', 'Gli articoli pubblicati su Telegram compariranno qui.'],
      discarded: ['Nessun articolo scartato', 'Gli articoli scartati compariranno qui e potrai ripristinarli.'],
    };
    const [t, d] = msgs[ui.view];
    $('#empty-title').textContent = t;
    $('#empty-text').textContent = d;
  }
}

function renderFooter() {
  const when = catalog.generatedAt ? new Date(catalog.generatedAt).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  $('#foot').textContent = `Catalogo aggiornato: ${when} · Fonte: MakerWorld · Sacrilab`;
  $('#hero-sub').textContent = catalog.items.length
    ? `${catalog.items.length} modelli selezionati da MakerWorld tra i più vendibili.`
    : 'I modelli più vendibili di MakerWorld, selezionati per te.';
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

  const reasons = (it.reasons || []).slice(0, 3).map((r) => `<span>${esc(r)}</span>`);
  if (it.license) reasons.push(`<span class="lic" title="Licenza del modello">${esc(it.license)}</span>`);
  $('.card-reasons', card).innerHTML = reasons.join('');

  const actions = $('.card-actions', card);
  if (ui.view === 'pending') {
    const price = store.state.prices[it.id] ?? '';
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
  if (!store.settings.token || !store.settings.chatId) {
    toast('Configura prima il bot Telegram', 'err');
    return openSettings();
  }
  const title = $('.card-title', card).value.trim() || it.title;
  const btn = $('[data-act="publish"]', card);
  btn.classList.add('loading');
  try {
    const caption = buildCaption(store.settings.format, { title, price, link: it.url });
    await publishProduct({ token: store.settings.token, chatId: store.settings.chatId, caption, image: it.image });
    store.markPublished(it.id, { price, title, caption });
    haptic(20);
    confetti(btn);
    toast(`Pubblicato: ${title}, ${price}€`, 'ok');
    await removeCard(card, 'publish');
    renderCounts(); renderChips(); maybeEmpty();
  } catch (e) {
    btn.classList.remove('loading');
    toast(e.message || 'Errore durante la pubblicazione', 'err');
  }
}

async function onDiscard(card, it) {
  store.markDiscarded(it.id);
  haptic(10);
  await removeCard(card, 'discard');
  renderCounts(); renderChips(); maybeEmpty();
  toast('Prodotto scartato', 'info', {
    label: 'Annulla',
    fn: () => { store.restore(it.id); withTransition(render); },
  });
}

function onRestore(card, it) {
  store.restore(it.id);
  removeCard(card, 'discard').then(() => { renderCounts(); renderChips(); maybeEmpty(); });
  toast('Articolo rimesso in valutazione', 'info');
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

function openSettings() {
  const s = store.settings;
  $('#tg-token').value = s.token;
  $('#tg-chat').value = s.chatId;
  $('#tg-format').value = s.format;
  $('#data-url').value = s.dataUrl;
  $('#chat-list').hidden = true;
  $('#sheet-backdrop').hidden = false;
  $('#settings').hidden = false;
  setTimeout(() => (s.token ? $('#tg-chat') : $('#tg-token')).focus({ preventScroll: true }), 350);
}
function closeSettings() {
  const sheet = $('#settings');
  const bd = $('#sheet-backdrop');
  sheet.classList.add('closing'); bd.classList.add('closing');
  setTimeout(() => { sheet.hidden = bd.hidden = true; sheet.classList.remove('closing'); bd.classList.remove('closing'); }, 280);
}
function readSettingsForm() {
  return {
    token: $('#tg-token').value.trim(),
    chatId: $('#tg-chat').value.trim(),
    format: $('#tg-format').value.trim() || '{titolo}, {prezzo}€',
    dataUrl: $('#data-url').value.trim(),
  };
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

  $('#toggle-token').onclick = (e) => {
    const inp = $('#tg-token');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    e.target.textContent = inp.type === 'password' ? 'Mostra' : 'Nascondi';
  };

  $('#settings-form').onsubmit = (e) => {
    e.preventDefault();
    const prevUrl = store.settings.dataUrl;
    store.saveSettings(readSettingsForm());
    toast('Impostazioni salvate', 'ok');
    closeSettings();
    if (prevUrl !== store.settings.dataUrl) loadCatalog();
    else render();
  };

  $('#find-chat').onclick = async (e) => {
    const btn = e.currentTarget;
    const token = $('#tg-token').value.trim();
    btn.classList.add('loading');
    try {
      const { bot, chats } = await findChats(token);
      const list = $('#chat-list');
      list.hidden = false;
      list.innerHTML = chats.length
        ? chats.map((c) => `<button type="button" data-id="${c.id}"><strong>${esc(c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || c.id)}</strong><small>${esc(c.type)} · ID ${c.id}</small></button>`).join('')
        : `<p class="hint">Nessuna chat trovata. Apri <a href="https://t.me/${esc(bot.username)}" target="_blank" rel="noopener">@${esc(bot.username)}</a>, premi Avvia e scrivi un messaggio, poi riprova.</p>`;
      $$('button', list).forEach((b) => (b.onclick = () => { $('#tg-chat').value = b.dataset.id; list.hidden = true; toast('Chat selezionata', 'ok'); }));
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.classList.remove('loading');
    }
  };

  $('#test-tg').onclick = async (e) => {
    const btn = e.currentTarget;
    const s = readSettingsForm();
    btn.classList.add('loading');
    try {
      await sendText({ token: s.token, chatId: s.chatId, text: '✅ Sacrilab 3D Print Shop Manager collegato correttamente.' });
      toast('Messaggio di prova inviato!', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.classList.remove('loading');
    }
  };

  $('#export-state').onclick = () => {
    const blob = new Blob([store.exportState()], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `sacrilab-stato-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#import-state').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { store.importState(await f.text()); render(); toast('Stato importato', 'ok'); } catch { toast('File non valido', 'err'); }
    e.target.value = '';
  };
  $('#reset-state').onclick = () => {
    if (!confirm('Ripristinare tutti gli articoli pubblicati e scartati?')) return;
    store.resetState(); render(); toast('Stato ripristinato', 'info');
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
    $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
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
  $('#btn-refresh').onclick = () => loadCatalog();

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

bindUI();
bindSettings();
requestAnimationFrame(moveIndicator);
document.fonts?.ready.then(moveIndicator);
loadCatalog({ silent: true });
registerSW();
