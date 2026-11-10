// Estrazione, normalizzazione e punteggio di vendibilità dei modelli MakerWorld.
import {
  BASE, LOCALE, CATEGORIES, IP_BLOCKLIST, LOW_SELLABILITY, HIGH_SELLABILITY, LIMITS, FILTERS, LOW_SELLABILITY_PENALTY,
} from './config.mjs';

const num = (...v) => {
  for (const x of v) {
    const n = Number(x);
    if (x != null && x !== '' && Number.isFinite(n)) return n;
  }
  return 0;
};
const str = (...v) => v.find((x) => typeof x === 'string' && x.trim())?.trim() || '';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reCache = new Map();
function hasWord(text, word) {
  let re = reCache.get(word);
  if (!re) {
    re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(word.toLowerCase())}(e?s)?($|[^\\p{L}\\p{N}])`, 'u');
    reCache.set(word, re);
  }
  return re.test(text);
}
export const anyWord = (text, words) => words.some((w) => hasWord(text, w));

function absUrl(u) {
  if (!u || typeof u !== 'string') return '';
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return `${BASE}${u}`;
  return u.startsWith('http') ? u : '';
}

const COVER_KEYS = ['cover', 'coverUrl', 'coverImage', 'coverPic', 'thumbnail', 'thumbnailUrl', 'image', 'imageUrl', 'picture'];
const COUNT_KEYS = ['likeCount', 'downloadCount', 'printCount', 'collectionCount', 'favoriteCount', 'downloadCnt', 'printCnt', 'likeCnt'];

/** Riconosce un oggetto JSON che rappresenta un modello (design) di MakerWorld. */
export function toDesign(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const id = o.id ?? o.designId ?? o.modelId;
  const title = str(o.title, o.titleTranslated, o.name);
  if (id == null || !/^\d+$/.test(String(id)) || !title) return null;
  let cover = '';
  for (const k of COVER_KEYS) {
    const v = o[k];
    cover = absUrl(typeof v === 'string' ? v : v?.url);
    if (cover) break;
  }
  if (!cover) return null;
  if (!COUNT_KEYS.some((k) => k in o)) return null;

  const creator = o.designCreator || o.creator || o.user || o.author || {};
  const lic = typeof o.license === 'string' ? o.license : str(o.license?.name, o.license?.title, o.licenseName, o.licenseType);
  const tags = (Array.isArray(o.tags) ? o.tags : Array.isArray(o.tagsOriginal) ? o.tagsOriginal : [])
    .map((t) => (typeof t === 'string' ? t : str(t?.name, t?.tag, t?.title)))
    .filter(Boolean)
    .slice(0, 20);
  const created = o.createTime ?? o.publishTime ?? o.createdAt ?? o.publishedAt ?? o.firstPublishTime;
  const publishedAt = created ? new Date(typeof created === 'number' && created < 1e12 ? created * 1000 : created) : null;

  return {
    id: String(id),
    title,
    image: cover,
    url: `${BASE}/${LOCALE}/models/${id}`,
    author: str(creator.name, creator.nickname, creator.handle, o.creatorName),
    license: lic,
    tags,
    publishedAt: publishedAt && !Number.isNaN(+publishedAt) ? publishedAt.toISOString() : null,
    stats: {
      downloads: num(o.downloadCount, o.downloadCnt, o.downloads),
      prints: num(o.printCount, o.printCnt, o.prints),
      likes: num(o.likeCount, o.likeCnt, o.likes),
      collections: num(o.collectionCount, o.favoriteCount, o.collectCount),
      comments: num(o.commentCount, o.commentCnt),
    },
  };
}

/** Percorre ricorsivamente qualsiasi JSON e raccoglie i modelli trovati. */
export function collectDesigns(json, out = new Map(), hint = null, depth = 0) {
  if (depth > 14 || json == null || typeof json !== 'object') return out;
  if (Array.isArray(json)) {
    for (const v of json) collectDesigns(v, out, hint, depth + 1);
    return out;
  }
  const d = toDesign(json);
  if (d) {
    const prev = out.get(d.id);
    if (!prev || sumStats(d) > sumStats(prev)) out.set(d.id, { ...d, hints: new Set([...(prev?.hints || []), ...(hint ? [hint] : [])]) });
    else if (hint) prev.hints.add(hint);
  }
  for (const v of Object.values(json)) if (v && typeof v === 'object') collectDesigns(v, out, hint, depth + 1);
  return out;
}
const sumStats = (d) => Object.values(d.stats).reduce((a, b) => a + b, 0);

const textOf = (d) => ` ${d.title} ${d.tags.join(' ')} `.toLowerCase();

export function isNonCommercial(license) {
  const l = (license || '').toLowerCase();
  return /(^|[^a-z])nc([^a-z]|$)/.test(l) || /non[\s_-]?commercial/.test(l);
}

export function categorize(d) {
  const text = textOf(d);
  let best = null;
  let bestScore = 0;
  for (const c of CATEGORIES) {
    let s = c.match.filter((w) => hasWord(text, w)).length;
    if (d.hints?.has(c.key)) s += 0.5;
    if (s > bestScore) { bestScore = s; best = c.key; }
  }
  return best || 'altro';
}

/** Filtra, assegna punteggio e seleziona i modelli più vendibili bilanciando le categorie. */
export function rank(designs, { now = Date.now(), limits = LIMITS, filters = FILTERS } = {}) {
  const pool = [];
  const rejected = { ip: 0, low: 0, license: 0, unpopular: 0 };
  for (const d of designs) {
    const text = textOf(d);
    const flags = [];
    const isIP = anyWord(text, IP_BLOCKLIST);
    const isLow = anyWord(text, LOW_SELLABILITY);
    const isNC = isNonCommercial(d.license);
    if (isIP) { if (filters.excludeIP) { rejected.ip++; continue; } flags.push('Marchio di terzi'); }
    if (isLow && filters.excludeLowSellability) { rejected.low++; continue; }
    if (isNC) { if (filters.excludeNonCommercial) { rejected.license++; continue; } flags.push('Licenza non commerciale'); }
    if (d.stats.downloads < (filters.minDownloads || 0)) { rejected.unpopular++; continue; }

    const { downloads, prints, likes, collections, comments } = d.stats;
    const reasons = [];
    let raw = 1.0 * Math.log1p(downloads) + 1.3 * Math.log1p(prints) + 0.9 * Math.log1p(likes)
      + 0.8 * Math.log1p(collections) + 0.3 * Math.log1p(comments);

    const love = (likes + collections) / (downloads + 1);
    raw += Math.min(3, love * 6);
    if (love > 0.35) reasons.push('Amatissimo');

    const printRatio = prints / (downloads + 1);
    raw += Math.min(3, printRatio * 5);
    if (printRatio > 0.4) reasons.push('Stampato spesso');

    if (d.publishedAt) {
      const days = (now - new Date(d.publishedAt)) / 864e5;
      if (days < 30) { raw += 3; reasons.push('Novità'); } else if (days < 90) raw += 1.5;
    }

    let bonus = 0;
    for (const rule of HIGH_SELLABILITY) {
      if (anyWord(text, rule.words)) { bonus += rule.bonus; reasons.push(rule.reason); }
    }
    raw += Math.min(10, bonus);
    if (isLow) raw -= LOW_SELLABILITY_PENALTY;

    pool.push({ ...d, category: categorize(d), raw, flags, reasons: [...new Set(reasons)] });
  }

  if (!pool.length) return { items: [], rejected };

  // Percentili di popolarità per motivazioni leggibili.
  const p80 = (key) => {
    const v = pool.map((x) => x.stats[key]).sort((a, b) => a - b);
    return v[Math.floor(v.length * 0.8)] || Infinity;
  };
  const topDl = p80('downloads');
  for (const x of pool) if (x.stats.downloads >= topDl) x.reasons.unshift('Molto scaricato');

  const min = Math.min(...pool.map((x) => x.raw));
  const max = Math.max(...pool.map((x) => x.raw));
  for (const x of pool) x.score = Math.round(35 + 64 * Math.sqrt((x.raw - min) / (max - min || 1)));
  pool.sort((a, b) => b.score - a.score);

  // Bilanciamento: i migliori di ogni categoria, poi riempimento per punteggio globale.
  const picked = new Map();
  const seenTitles = new Set();
  const key = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').slice(0, 5).join(' ');
  const take = (x) => {
    const k = key(x.title) || `#${x.id}`;
    if (picked.has(x.id) || seenTitles.has(k)) return false;
    picked.set(x.id, x); seenTitles.add(k); return true;
  };
  const perCat = {};
  for (const x of pool) {
    perCat[x.category] ||= 0;
    if (x.category !== 'altro' && perCat[x.category] < limits.perCategory && take(x)) perCat[x.category]++;
  }
  for (const x of pool) {
    if (picked.size >= limits.total) break;
    take(x);
  }

  const items = [...picked.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limits.total)
    .map(({ raw, hints, ...rest }) => rest);
  return { items, rejected };
}
