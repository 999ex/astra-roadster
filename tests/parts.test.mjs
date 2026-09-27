import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BLUEPRINT as bp } from '../src/blueprint.js';
import { createMaterials } from '../src/materials.js';
import { buildExterior } from '../src/parts/exterior.js';
import { buildWheels } from '../src/parts/wheels.js';
import { buildInterior } from '../src/parts/interior.js';
import { buildChassis } from '../src/parts/chassis.js';
import { createRegistry } from '../src/registry.js';
import { cockpitRange, profileAt } from '../src/bodyLoft.js';

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

const INTERIOR = ['シート左', 'シート右', 'ステアリング', 'ダッシュボード', 'メーターディスプレイ', 'センターコンソール', 'フロア'];

test('内装は7点', () => {
  checkSpecs(buildInterior(bp, mats), 'interior', INTERIOR);
});

test('シートは左右に分かれ、ステアリングは左ハンドル（z<0）', () => {
  const specs = buildInterior(bp, mats);
  const z = (n) => specs.find((s) => s.name === n).object3d.position.z;
  assert.ok(z('シート右') > 0 && z('シート左') < 0);
  assert.ok(z('ステアリング') < 0);
});

test('フロアとダッシュボードはコックピット開口の局所的な幅からはみ出さない', () => {
  const { u0, u1 } = cockpitRange(bp);
  const specs = buildInterior(bp, mats);
  const v = new THREE.Vector3();
  for (const name of ['フロア', 'ダッシュボード']) {
    const obj = specs.find((s) => s.name === name).object3d;
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        const uAtX = (bp.length / 2 - v.x) / bp.length;
        const p = profileAt(bp, uAtX);
        // コックピット開口の内側(u0..u1)は開口の局所幅(hole)が境界。
        // 外側（ダッシュボード前端がカウル下の実体シェルへ入り込む領域）は開口が存在しない(hole=0)ため、
        // 車体外殻の局所幅(zTop)を境界にする。hole基準のみだと、実体シェル内に収まっていても誤検出になる。
        const limit = (uAtX >= u0 && uAtX <= u1 ? p.hole : p.zTop) + 0.01;
        assert.ok(Math.abs(v.z) <= limit, `${name}: |z|=${Math.abs(v.z).toFixed(3)} > limit=${limit.toFixed(3)} (x=${v.x.toFixed(3)}, u=${uAtX.toFixed(3)})`);
      }
    });
  }
});

const CORNERS = ['右前', '左前', '右後', '左後'];
const CHASSIS = [
  'シャーシフレーム', 'バッテリーケース', ...[1, 2, 3, 4, 5, 6].map((i) => `バッテリーモジュール${i}`),
  'フロントモーター', 'リアモーター', 'インバーター',
  ...CORNERS.map((c) => `ドライブシャフト${c}`), ...CORNERS.map((c) => `サスペンション${c}`),
  'ステアリングラック', 'ラジエーター',
];

test('シャーシは21点', () => {
  checkSpecs(buildChassis(bp, mats), 'chassis', CHASSIS);
});

test('全体で61点、名前は重複せず、グループ別は 17/16/7/21', () => {
  const reg = createRegistry();
  for (const build of [buildExterior, buildWheels, buildInterior, buildChassis]) for (const s of build(bp, mats)) reg.add(s);
  assert.equal(reg.count(), 61);
  assert.deepEqual(['exterior', 'wheels', 'interior', 'chassis'].map((g) => reg.byGroup(g).length), [17, 16, 7, 21]);
});
