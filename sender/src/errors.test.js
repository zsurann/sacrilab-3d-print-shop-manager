import test from 'node:test';
import assert from 'node:assert/strict';
import { explain } from './errors.js';

test('errori di Telegram tradotti', () => {
  assert.deepEqual(explain({ text: 'FLOOD_WAIT_%d', seconds: 42 }).slice(0, 2), [429, 'Telegram chiede di attendere 42 secondi prima di inviare di nuovo.']);
  assert.equal(explain({ text: 'PEER_FLOOD' })[0], 429);
  assert.equal(explain({ text: 'SESSION_REVOKED' })[2], true, 'sessione revocata → scollega');
  assert.equal(explain({ text: 'PHONE_CODE_INVALID' })[2], undefined, 'codice errato non scollega');
  assert.equal(explain(new Error('boh'))[1], 'boh');
});
