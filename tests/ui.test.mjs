import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPartName, isTap, shouldClearOnLeave } from '../src/ui.js';

test('findPartName は親をたどって部品名を見つける', () => {
  const root = { userData: { partName: 'ボンネット' }, parent: null };
  const mid = { userData: {}, parent: root };
  const leaf = { userData: {}, parent: mid };
  assert.equal(findPartName(leaf), 'ボンネット');
  assert.equal(findPartName({ userData: {}, parent: null }), null);
});

test('isTap: 同じ pointerId で移動が 8px 未満ならタップ', () => {
  const down = { id: 3, x: 100, y: 100 };
  assert.equal(isTap(down, { id: 3, x: 104, y: 103 }), true);
  assert.equal(isTap(down, { id: 3, x: 108, y: 100 }), false, '8px ちょうどはドラッグ扱い');
  assert.equal(isTap(down, { id: 3, x: 130, y: 100 }), false);
  assert.equal(isTap(down, { id: 4, x: 100, y: 100 }), false, '別の指の pointerup はタップではない');
  assert.equal(isTap(null, { id: 3, x: 100, y: 100 }), false);
  assert.equal(isTap(down, { id: 3, x: 105, y: 100 }, 4), false, 'しきい値を指定できる');
});

test('shouldClearOnLeave: マウスのときだけ pointerleave でハイライトを消す（タッチは pointerup 直後に leave が来るため）', () => {
  assert.equal(shouldClearOnLeave('mouse'), true);
  assert.equal(shouldClearOnLeave('touch'), false);
  assert.equal(shouldClearOnLeave('pen'), false);
});
