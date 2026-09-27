import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../src/registry.js';
import { applyExplode, localProgress, createExplodeController } from '../src/explode.js';

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; } });
const fake = (p = [0, 0, 0], r = [0, 0, 0]) => ({ position: vec(...p), rotation: vec(...r), userData: {} });

test('add は定位置を記録し、名前の重複と不明なグループを拒否する', () => {
  const reg = createRegistry();
  const o = fake([1, 2, 3], [0, 0.5, 0]);
  const part = reg.add({ name: 'ボンネット', group: 'exterior', object3d: o, explode: { offset: [0, 1, 0] } });
  assert.deepEqual(part.home.position, [1, 2, 3]);
  assert.deepEqual(part.home.rotation, [0, 0.5, 0]);
  assert.deepEqual(part.explode.rotate, [0, 0, 0]);
  assert.equal(o.userData.partName, 'ボンネット');
  assert.throws(() => reg.add({ name: 'ボンネット', group: 'exterior', object3d: fake(), explode: { offset: [0, 0, 0] } }));
  assert.throws(() => reg.add({ name: 'X', group: 'nope', object3d: fake(), explode: { offset: [0, 0, 0] } }));
  assert.equal(reg.count(), 1);
  assert.equal(reg.get('ボンネット'), part);
  assert.equal(reg.byGroup('exterior').length, 1);
});

test('applyExplode: 0で定位置、1で定位置＋オフセット', () => {
  const reg = createRegistry();
  const o = fake([1, 0, 0]);
  reg.add({ name: 'A', group: 'chassis', object3d: o, explode: { offset: [0, 2, 0], rotate: [0, 0, 1] } });
  applyExplode(reg, 1);
  assert.deepEqual([o.position.x, o.position.y, o.position.z], [1, 2, 0]);
  assert.equal(o.rotation.z, 1);
  applyExplode(reg, 0);
  assert.deepEqual([o.position.x, o.position.y, o.position.z], [1, 0, 0]);
  assert.equal(o.rotation.z, 0);
});

test('時間差: 外装が先に動き、シャーシは後から動く', () => {
  assert.ok(localProgress(0.3, 'exterior') > localProgress(0.3, 'interior'));
  assert.equal(localProgress(0.3, 'chassis'), 0);
  assert.equal(localProgress(1, 'chassis'), 1);
  assert.equal(localProgress(0.6, 'exterior'), 1);
});

test('コントローラは DURATION 秒で 0→1 に進み、toggle で戻る', () => {
  const reg = createRegistry();
  const o = fake();
  reg.add({ name: 'A', group: 'exterior', object3d: o, explode: { offset: [0, 1, 0] } });
  const ctl = createExplodeController(reg);
  assert.equal(ctl.toggle(), true);
  ctl.update(0.75);
  assert.ok(Math.abs(ctl.value - 0.5) < 1e-9);
  ctl.update(10);
  assert.equal(ctl.value, 1);
  assert.equal(ctl.exploded, true);
  assert.equal(o.position.y, 1);
  assert.equal(ctl.toggle(), false);
  ctl.update(10);
  assert.equal(o.position.y, 0);
});
