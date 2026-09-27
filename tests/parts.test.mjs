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
import { seatLayout } from '../src/parts/util.js';

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

// --- Fix round 1: シャーシ/バッテリーが車体下面より上、内装フロアより下にあること。
// ドライブシャフトの外側ジョイントがタイヤ内側面より内側にあること。フレームが他部品と干渉しないこと。

function maxBcOverX(bp0, xLo, xHi, steps = 40) {
  let m = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const x = xLo + ((xHi - xLo) * i) / steps;
    const u = Math.min(1, Math.max(0, (bp0.length / 2 - x) / bp0.length));
    const p = profileAt(bp0, u);
    if (p.Bc > m) m = p.Bc;
  }
  return m;
}

function meshWorldBoxes(object3d) {
  object3d.updateMatrixWorld(true);
  const boxes = [];
  object3d.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    boxes.push(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  return boxes;
}

function boxesDisjoint(a, b, tol) {
  const ea = a.clone().expandByScalar(-tol);
  const eb = b.clone().expandByScalar(-tol);
  return !ea.intersectsBox(eb);
}

const BATTERY_NAMES = ['バッテリーケース', ...[1, 2, 3, 4, 5, 6].map((i) => `バッテリーモジュール${i}`)];

test('シャーシフレーム・バッテリーケース・バッテリーモジュールは車体下面より上にある', () => {
  const chassis = buildChassis(bp, mats);
  for (const name of ['シャーシフレーム', ...BATTERY_NAMES]) {
    const obj = chassis.find((s) => s.name === name).object3d;
    const box = new THREE.Box3().setFromObject(obj);
    const maxBc = maxBcOverX(bp, box.min.x, box.max.x);
    assert.ok(box.min.y >= maxBc - 1e-3, `${name}: min.y=${box.min.y.toFixed(4)} < maxBc=${maxBc.toFixed(4)}`);
  }
});

test('バッテリーケース・バッテリーモジュールは内装フロアより下にある', () => {
  const chassis = buildChassis(bp, mats);
  const floor = seatLayout(bp).floor;
  for (const name of BATTERY_NAMES) {
    const obj = chassis.find((s) => s.name === name).object3d;
    const box = new THREE.Box3().setFromObject(obj);
    assert.ok(box.max.y <= floor + 1e-3, `${name}: max.y=${box.max.y.toFixed(4)} > floor=${floor.toFixed(4)}`);
  }
});

test('ドライブシャフトの外側ジョイントはタイヤ内側面より内側にある', () => {
  const chassis = buildChassis(bp, mats);
  const wheels = buildWheels(bp, mats);
  for (const c of CORNERS) {
    const shaft = chassis.find((s) => s.name === `ドライブシャフト${c}`).object3d;
    const tire = wheels.find((s) => s.name === `${c}タイヤ`).object3d;
    const sBox = new THREE.Box3().setFromObject(shaft);
    const tBox = new THREE.Box3().setFromObject(tire);
    const shaftMaxAbsZ = Math.max(Math.abs(sBox.min.z), Math.abs(sBox.max.z));
    const tireMinAbsZ = Math.min(Math.abs(tBox.min.z), Math.abs(tBox.max.z));
    assert.ok(shaftMaxAbsZ <= tireMinAbsZ + 1e-3, `${c}: shaft|z|max=${shaftMaxAbsZ.toFixed(4)} > tire|z|min=${tireMinAbsZ.toFixed(4)}`);
  }
});

test('シャーシフレームはバッテリー・モーター・ドライブシャフトと干渉しない', () => {
  const chassis = buildChassis(bp, mats);
  const frameBoxes = meshWorldBoxes(chassis.find((s) => s.name === 'シャーシフレーム').object3d);
  const others = [...BATTERY_NAMES, 'フロントモーター', 'リアモーター', ...CORNERS.map((c) => `ドライブシャフト${c}`)];
  for (const name of others) {
    const otherBoxes = meshWorldBoxes(chassis.find((s) => s.name === name).object3d);
    for (const fb of frameBoxes) {
      for (const ob of otherBoxes) {
        assert.ok(boxesDisjoint(fb, ob, 1e-3), `シャーシフレーム と ${name} が干渉`);
      }
    }
  }
});
