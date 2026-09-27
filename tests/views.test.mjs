import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, interpolateView, toSpherical, shortestAngle } from '../src/views.js';

const close = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test('t=0 で出発点、t=1 で到着点', () => {
  const a = interpolateView(VIEWS.reset, VIEWS.side, 0);
  const b = interpolateView(VIEWS.reset, VIEWS.side, 1);
  assert.ok(close(a.position, VIEWS.reset.position));
  assert.ok(close(b.position, VIEWS.side.position));
  assert.ok(close(b.target, VIEWS.side.target));
});

test('途中でも注視点からの距離は両端の間に収まる（車を突き抜けない）', () => {
  const ra = toSpherical(VIEWS.front.position, VIEWS.front.target).r;
  const rb = toSpherical(VIEWS.side.position, VIEWS.side.target).r;
  for (let t = 0; t <= 1; t += 0.1) {
    const v = interpolateView(VIEWS.front, VIEWS.side, t);
    const r = toSpherical(v.position, v.target).r;
    assert.ok(r >= Math.min(ra, rb) - 1e-6 && r <= Math.max(ra, rb) + 1e-6);
  }
});

test('shortestAngle は ±π の範囲に収まる', () => {
  assert.ok(Math.abs(shortestAngle(3, -3) - (2 * Math.PI - 6)) < 1e-9);
  assert.ok(Math.abs(shortestAngle(0, 1) - 1) < 1e-9);
});

test('視点の向き: 上は真上から前方が画面上、横は前が画面左、正面は +X から', () => {
  assert.ok(toSpherical(VIEWS.top.position, VIEWS.top.target).phi < 0.01);
  assert.ok(VIEWS.top.position[0] < 0);
  assert.ok(VIEWS.side.position[2] < 0);
  assert.ok(VIEWS.front.position[0] > 0);
});
