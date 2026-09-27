import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerp, clamp, sampleArray, easeInOutCubic, approach } from '../src/math.js';

test('lerp と clamp', () => {
  assert.equal(lerp(2, 4, 0.5), 3);
  assert.equal(clamp(1.5), 1);
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(5, 0, 10), 5);
});

test('sampleArray は端と中間を線形補間する', () => {
  assert.equal(sampleArray([0, 10, 20], 0), 0);
  assert.equal(sampleArray([0, 10, 20], 1), 20);
  assert.equal(sampleArray([0, 10, 20], 0.25), 5);
  assert.equal(sampleArray([0, 10, 20], 2), 20);
});

test('easeInOutCubic は 0→0, 0.5→0.5, 1→1', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(0.5), 0.5);
  assert.equal(easeInOutCubic(1), 1);
});

test('approach は行き過ぎない', () => {
  assert.equal(approach(0, 1, 0.3), 0.3);
  assert.equal(approach(0.9, 1, 0.3), 1);
  assert.equal(approach(1, 0, 0.3), 0.7);
});
