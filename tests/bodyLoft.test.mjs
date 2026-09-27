import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLUEPRINT as bp } from '../src/blueprint.js';
import { ringAt, rightContour, loftGrid, panelRegions, shellInclude, cockpitRange, uToX, pointOnSide } from '../src/bodyLoft.js';

test('断面は43点で、リングは左右対称', () => {
  assert.equal(rightContour(bp, 0.5).length, 43);
  const ring = ringAt(bp, 0.5);
  assert.equal(ring.length, 86);
  for (let j = 0; j < ring.length; j++) {
    const k = ring.length - 1 - j;
    assert.ok(Math.abs(ring[j].z + ring[k].z) < 1e-9);
    assert.ok(Math.abs(ring[j].y - ring[k].y) < 1e-9);
  }
});

test('頂点はすべて地面より上、最大高さ以下', () => {
  const { positions } = loftGrid(bp, { caps: true });
  const maxTop = Math.max(...bp.top);
  for (let i = 1; i < positions.length; i += 3) {
    assert.ok(positions[i] >= 0 && positions[i] <= maxTop + 0.01);
  }
});

test('シェルとパネルで四角形がちょうど分割される', () => {
  const total = loftGrid(bp).quadCount;
  const panels = Object.values(panelRegions(bp)).map((f) => loftGrid(bp, { include: f }).quadCount);
  const shell = loftGrid(bp, { include: shellInclude(bp) }).quadCount;
  panels.forEach((q) => assert.ok(q > 20, `panel quads=${q}`));
  assert.equal(shell + panels.reduce((a, b) => a + b, 0), total);
});

test('パネルの位置: ボンネットは前、トランクは後ろ、右ドアは z>0', () => {
  const { u0, u1 } = cockpitRange(bp);
  const xs = (f) => { const p = loftGrid(bp, { include: f }).positions; return p.filter((_, i) => i % 3 === 0); };
  const r = panelRegions(bp);
  assert.ok(Math.min(...xs(r.hood)) > uToX(bp, u0));
  assert.ok(Math.max(...xs(r.trunk)) < uToX(bp, u1));
  const doorR = loftGrid(bp, { include: r.doorR }).positions;
  for (let i = 2; i < doorR.length; i += 3) assert.ok(doorR[i] > 0);
});

test('caps を付けると三角形が増え、pointOnSide は右側の点を返す', () => {
  assert.ok(loftGrid(bp, { caps: true }).indices.length > loftGrid(bp).indices.length);
  const [x, y, z] = pointOnSide(bp, 0.5, 0.5, 1);
  assert.ok(Math.abs(x - uToX(bp, 0.5)) < 1e-9 && y > 0 && z > 0);
});

test('キャップの法線は外向き: 鼻先は+X、尾部は-X', () => {
  const uSteps = 4;
  const noCaps = loftGrid(bp, { uSteps });
  const withCaps = loftGrid(bp, { uSteps, caps: true });
  const noCapsTriCount = noCaps.indices.length / 3;
  const withCapsTriCount = withCaps.indices.length / 3;
  const R = (withCapsTriCount - noCapsTriCount) / 2; // 鼻先R個 + 尾部R個
  const pos = withCaps.positions;
  const idx = withCaps.indices;

  const faceNormalX = (t) => {
    const i0 = idx[t * 3], i1 = idx[t * 3 + 1], i2 = idx[t * 3 + 2];
    const ux = pos[i1 * 3] - pos[i0 * 3], uy = pos[i1 * 3 + 1] - pos[i0 * 3 + 1], uz = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];
    const vx = pos[i2 * 3] - pos[i0 * 3], vy = pos[i2 * 3 + 1] - pos[i0 * 3 + 1], vz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    return { nx, len: Math.hypot(nx, ny, nz) };
  };

  let checkedNose = 0, checkedTail = 0;
  for (let t = noCapsTriCount; t < noCapsTriCount + R; t++) {
    const { nx, len } = faceNormalX(t);
    if (len > 1e-9) { assert.ok(nx > 0, `nose cap triangle nx=${nx}`); checkedNose++; }
  }
  for (let t = noCapsTriCount + R; t < withCapsTriCount; t++) {
    const { nx, len } = faceNormalX(t);
    if (len > 1e-9) { assert.ok(nx < 0, `tail cap triangle nx=${nx}`); checkedTail++; }
  }
  assert.ok(checkedNose > 0 && checkedTail > 0, 'non-degenerate cap triangles should exist to check');
});
