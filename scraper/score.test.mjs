import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDesigns, rank, isNonCommercial, categorize, toDesign } from './score.mjs';

const mk = (id, title, s = {}, extra = {}) => ({
  id, title, cover: `https://makerworld.bblmw.com/makerworld/model/${id}/cover.jpg`,
  likeCount: s.likes ?? 300, downloadCount: s.dl ?? 2000, printCount: s.prints ?? 500, collectionCount: s.col ?? 200,
  designCreator: { name: 'Maker' }, license: s.license ?? 'BY', createTime: '2026-10-01T00:00:00Z', ...extra,
});

test('estrae modelli da JSON annidato', () => {
  const json = { data: { hits: [mk(1, 'Cable organizer'), { foo: [mk(2, 'Desk lamp')] }], other: { id: 3, title: 'no cover' } } };
  const m = collectDesigns(json);
  assert.deepEqual([...m.keys()].sort(), ['1', '2']);
  assert.equal(m.get('1').url, 'https://makerworld.com/it/models/1');
  assert.equal(m.get('1').author, 'Maker');
});

test('ignora oggetti che non sono modelli', () => {
  assert.equal(toDesign({ id: 5, title: 'x' }), null);
  assert.equal(toDesign({ id: 'abc', title: 'x', cover: 'https://a/b.jpg', likeCount: 1 }), null);
});

test('licenze non commerciali', () => {
  assert.ok(isNonCommercial('BY-NC-SA'));
  assert.ok(isNonCommercial('Creative Commons NonCommercial'));
  assert.ok(!isNonCommercial('BY-SA'));
  assert.ok(!isNonCommercial('Standard Digital File License'));
});

test('categorizza per parole intere', () => {
  const c = (t) => categorize({ title: t, tags: [] });
  assert.equal(c('Spice rack for kitchen'), 'cucina');
  assert.equal(c('Articulated dragon fidget'), 'giochi');
  assert.equal(c('Scattered thoughts'), 'altro'); // "cat" non deve combaciare
});

test('rank esclude IP, ricambi stampante e NC, ordina per punteggio', () => {
  const designs = [...collectDesigns([
    mk(1, 'Pikachu planter'),
    mk(2, 'AMS spool holder'),
    mk(3, 'Wall hook', { license: 'BY-NC' }),
    mk(4, 'Headphone stand', { dl: 20000, likes: 4000, prints: 6000 }),
    mk(5, 'Plant pot', { dl: 900, likes: 80, prints: 50 }),
    mk(6, 'Tiny thing', { dl: 10, likes: 1, prints: 0 }),
  ]).values()];
  const { items, rejected } = rank(designs);
  assert.deepEqual(items.map((x) => x.id), ['4', '5']);
  assert.deepEqual(rejected, { ip: 1, low: 1, license: 1, unpopular: 1 });
  assert.ok(items[0].score > items[1].score && items[0].score <= 99);
  assert.equal(items[0].category, 'tech');
});
