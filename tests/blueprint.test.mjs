import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLUEPRINT as bp } from '../src/blueprint.js';
import { mergeLargeComponents, largestComponent, fillGaps, curvatureSignFlips } from '../tools/extract-blueprint.mjs';

const inMid = (i) => i / (bp.samples - 1) > 0.06 && i / (bp.samples - 1) < 0.94;

test('配列の長さと数値の妥当性', () => {
  assert.equal(bp.samples, 121);
  for (const key of ['top', 'bottomOuter', 'bottomCenter', 'halfWidth', 'holeHalfWidth']) {
    assert.equal(bp[key].length, 121, key);
    assert.ok(bp[key].every(Number.isFinite), key);
  }
  assert.equal(bp.template.length, 33);
  assert.ok(bp.template.every((v) => v >= 0.35 && v <= 1.0001));
});

test('車らしいプロポーション', () => {
  assert.equal(bp.length, 4.0);
  const ratio = bp.width / bp.length;
  assert.ok(ratio > 0.38 && ratio < 0.55, `width/length=${ratio}`);
  const maxTop = Math.max(...bp.top);
  assert.ok(maxTop > 0.8 && maxTop < 1.4, `maxTop=${maxTop}`);
});

test('上端は下端より十分高く、中央の下端は外側の下端以下', () => {
  bp.top.forEach((t, i) => {
    if (!inMid(i)) return;
    assert.ok(t - bp.bottomOuter[i] > 0.15, `i=${i}`);
    assert.ok(bp.bottomCenter[i] <= bp.bottomOuter[i] + 1e-6, `i=${i}`);
    assert.ok(bp.bottomCenter[i] >= 0.08, `i=${i}`);
  });
});

test('ホイールは前後2つで、位置と半径が妥当', () => {
  assert.equal(bp.wheels.length, 2);
  const [front, rear] = bp.wheels;
  assert.ok(front.u > 0.1 && front.u < 0.32, `front.u=${front.u}`);
  assert.ok(rear.u > 0.66 && rear.u < 0.9, `rear.u=${rear.u}`);
  for (const w of bp.wheels) assert.ok(w.radius > 0.26 && w.radius < 0.46, `r=${w.radius}`);
});

test('コックピット開口は中央付近だけにある', () => {
  const open = bp.holeHalfWidth.map((v, i) => [i / 120, v]).filter(([, v]) => v > 0);
  assert.ok(open.length >= 10, `open stations=${open.length}`);
  for (const [u] of open) assert.ok(u > 0.25 && u < 0.8, `u=${u}`);
  assert.ok(bp.cockpitFloor > 0.15 && bp.cockpitFloor < 0.6);
});

test('holeHalfWidth は開口区間の内部に0の隙間（膜）を持たない', () => {
  const idx = bp.holeHalfWidth.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  const first = idx[0], last = idx[idx.length - 1];
  for (let i = first; i <= last; i++) {
    assert.ok(bp.holeHalfWidth[i] > 0, `holeHalfWidth[${i}]=${bp.holeHalfWidth[i]} is a gap inside the cockpit opening (first=${first}, last=${last})`);
  }
});

test('mergeLargeComponents は大きい成分をすべて残し、小さい成分は除外する', () => {
  // 30x10 の合成マスク: 左に10x10のブロブA（100px）、右に10x10のブロブB（100px）、
  // 中央上部に孤立した1pxのブロブC。A/Bはratio=0.2のしきい値(20px)を超え、Cは超えない。
  const w = 30, h = 10;
  const mask = new Uint8Array(w * h);
  const set = (x, y) => { mask[y * w + x] = 1; };
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) set(x, y);
  for (let y = 0; y < 10; y++) for (let x = 20; x < 30; x++) set(x, y);
  set(15, 0);

  const merged = mergeLargeComponents({ w, h, mask }, 0.2);
  let count = 0;
  for (let i = 0; i < w * h; i++) count += merged.mask[i];

  assert.equal(count, 200, 'A(100)+B(100)のみ残り、Cの1pxは除外される');
  assert.equal(merged.mask[0 * w + 15], 0, '孤立した小さい成分Cは除外される');
  assert.equal(merged.mask[0 * w + 0], 1, '大きい成分Aは残る');
  assert.equal(merged.mask[0 * w + 29], 1, '大きい成分Bは残る');
});

test('fillGaps は先頭・末尾の非ゼロ要素の間にある0を線形補間で埋める', () => {
  assert.deepEqual(fillGaps([0, 2, 0, 0, 8, 0]), [0, 2, 4, 6, 8, 0]);
  assert.deepEqual(fillGaps([0, 0, 5, 0, 5, 0, 0]), [0, 0, 5, 5, 5, 0, 0]);
  assert.deepEqual(fillGaps([0, 0, 0]), [0, 0, 0]);
});


test('上端(top)と半幅(halfWidth)は中間ステーション(i=8..112)で波打たない（曲率の符号反転 ≤ 6）', () => {
  for (const key of ['top', 'halfWidth']) {
    const flips = curvatureSignFlips(bp[key]);
    assert.ok(flips <= 6, `${key}: curvature sign flips=${flips} (> 6) — ボディ表面が波打つ`);
  }
});

test('largestComponent は空マスクに対して全ゼロのマスクを返し、非空なら最大成分だけを残す', () => {
  const w = 6, h = 3;
  const empty = largestComponent({ w, h, mask: new Uint8Array(w * h) });
  assert.equal(empty.mask.reduce((a, v) => a + v, 0), 0, '空入力で全画素が1になってはいけない');
  const mask = new Uint8Array(w * h);
  mask[0] = 1; // 1px の成分
  for (const i of [3, 4, 5, 9, 10, 11]) mask[i] = 1; // 6px の成分
  const out = largestComponent({ w, h, mask });
  assert.deepEqual([...out.mask], [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]);
});
