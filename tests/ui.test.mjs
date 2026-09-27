import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPartName } from '../src/ui.js';

test('findPartName は親をたどって部品名を見つける', () => {
  const root = { userData: { partName: 'ボンネット' }, parent: null };
  const mid = { userData: {}, parent: root };
  const leaf = { userData: {}, parent: mid };
  assert.equal(findPartName(leaf), 'ボンネット');
  assert.equal(findPartName({ userData: {}, parent: null }), null);
});
