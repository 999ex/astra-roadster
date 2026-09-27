import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BLUEPRINT as bp } from '../src/blueprint.js';
import { createMaterials } from '../src/materials.js';
import { buildExterior } from '../src/parts/exterior.js';
import { buildWheels } from '../src/parts/wheels.js';

const mats = createMaterials();
const EXTERIOR = ['ボディシェル', 'ボンネット', 'トランクリッド', 'シザードア左', 'シザードア右', 'フロントバンパー', 'リアディフューザー', 'フロントガラス', 'ドアミラー左', 'ドアミラー右', 'ヘッドライト左', 'ヘッドライト右', 'テールライトバー', 'フロントグリル', 'サイドスカート左', 'サイドスカート右', 'ロールフープ'];

export function checkSpecs(specs, group, names) {
  assert.deepEqual(specs.map((s) => s.name).sort(), [...names].sort());
  for (const s of specs) {
    assert.equal(s.group, group, s.name);
    assert.equal(s.explode.offset.length, 3, s.name);
    let meshes = 0;
    s.object3d.traverse((o) => { if (o.isMesh) meshes++; });
    assert.ok(meshes >= 1, s.name);
    const box = new THREE.Box3().setFromObject(s.object3d);
    assert.ok(box.min.y >= -0.01, `${s.name} は地面より下にある`);
    assert.ok(Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) < 2.6, `${s.name} が台座の範囲を超えている`);
  }
}

test('外装は17点', () => {
  checkSpecs(buildExterior(bp, mats), 'exterior', EXTERIOR);
});

test('シザードアはヒンジを持ち、ヒンジは前端にある', () => {
  for (const name of ['シザードア左', 'シザードア右']) {
    const door = buildExterior(bp, mats).find((s) => s.name === name);
    assert.ok(door.object3d.userData.hinge, name);
    const box = new THREE.Box3().setFromObject(door.object3d);
    assert.ok(door.object3d.position.x >= box.max.x - 1e-6, name);
  }
});

const WHEEL_NAMES = ['右前', '左前', '右後', '左後'].flatMap((p) => ['タイヤ', 'ホイール', 'ブレーキディスク', 'キャリパー'].map((k) => p + k));

test('足まわりは16点', () => {
  checkSpecs(buildWheels(bp, mats), 'wheels', WHEEL_NAMES);
});

test('回転するのはタイヤ・ホイール・ディスクの12点で、キャリパーは回らない', () => {
  const specs = buildWheels(bp, mats);
  const spinning = specs.filter((s) => s.object3d.userData.spin);
  assert.equal(spinning.length, 12);
  assert.ok(specs.filter((s) => s.name.endsWith('キャリパー')).every((s) => !s.object3d.userData.spin));
});

test('タイヤは地面に接し、右のタイヤは z>0', () => {
  for (const s of buildWheels(bp, mats).filter((x) => x.name.endsWith('タイヤ'))) {
    const box = new THREE.Box3().setFromObject(s.object3d);
    assert.ok(Math.abs(box.min.y) < 0.02, `${s.name} min.y=${box.min.y}`);
    assert.equal(s.object3d.position.z > 0, s.name.startsWith('右'), s.name);
  }
});
