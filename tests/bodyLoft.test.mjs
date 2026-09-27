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
