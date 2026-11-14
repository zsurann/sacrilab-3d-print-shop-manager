import test from 'node:test';
import assert from 'node:assert/strict';
import { seal, open } from './secret-box.js';

test('la sessione cifrata si riapre solo con la chiave giusta', async () => {
  const box = await seal('chiave-1', 'sessione-segreta');
  assert.ok(!JSON.stringify(box).includes('sessione-segreta'));
  assert.equal(await open('chiave-1', box), 'sessione-segreta');
  await assert.rejects(open('chiave-2', box));
});
