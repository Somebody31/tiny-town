import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { runStation, replayEvents } from '../src/station.js';

test('station replay is deterministic and records hat count in Gazette event', () => {
  const db = new DatabaseSync(':memory:');
  const first = runStation(db, 14, 3105);
  const second = runStation(db, 14, 3105);
  assert.deepEqual(first, second);
  assert.match(first.find(event => event.kind === 'train_delayed')!.detail, /14 former hats/);
  const fewer = runStation(db, 8, 3105);
  assert.match(fewer.find(event => event.kind === 'train_delayed')!.detail, /8 former hats/);
  assert.deepEqual(replayEvents(db, 1), first);
  db.close();
});
