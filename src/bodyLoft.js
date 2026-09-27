import { lerp, sampleArray } from './math.js';

export const CROWN = 0.04;
const SEG = { bottom: 4, archwall: 3, archroof: 3, side: 16, top: 8, wall: 4, tub: 4 };
export const U_STEPS = 120;

export const uToX = (bp, u) => bp.length / 2 - u * bp.length;

export function profileAt(bp, u) {
  const W = sampleArray(bp.halfWidth, u);
  const T = sampleArray(bp.top, u);
  const Bo = sampleArray(bp.bottomOuter, u);
  const Bc = sampleArray(bp.bottomCenter, u);
  const tpl = bp.template;
  const hmax = tpl.indexOf(Math.max(...tpl)) / (tpl.length - 1);
  const shape = (h) => (h <= hmax ? sampleArray(tpl, h) : lerp(1, 0.8, ((h - hmax) / Math.max(1e-6, 1 - hmax)) ** 2));
  const zOut = W * shape(0);
  const zIn = Math.min(0.58 * W, 0.9 * zOut);
  const zTop = 0.8 * W;
  const hole = Math.min(sampleArray(bp.holeHalfWidth, u), 0.75 * W);
  const yTop = (z) => T - CROWN * (z / zTop) ** 2;
  const floor = hole > 0 ? Math.min(yTop(hole) - 0.05, bp.cockpitFloor) : yTop(0);
  return { W, T, Bo, Bc, hole, zIn, zOut, zTop, floor, shape, yTop };
}

export function rightContour(bp, u) {
  const p = profileAt(bp, u);
  const pts = [];
  for (let k = 0; k <= SEG.bottom; k++) pts.push({ z: lerp(0, p.zIn, k / SEG.bottom), y: p.Bc, region: 'bottom', h: 0 });
  for (let k = 1; k <= SEG.archwall; k++) pts.push({ z: p.zIn, y: lerp(p.Bc, p.Bo, k / SEG.archwall), region: 'archwall', h: 0 });
  for (let k = 1; k <= SEG.archroof; k++) pts.push({ z: lerp(p.zIn, p.zOut, k / SEG.archroof), y: p.Bo, region: 'archroof', h: 0 });
  for (let k = 1; k <= SEG.side; k++) {
    const h = k / SEG.side;
    pts.push({ z: p.W * p.shape(h), y: lerp(p.Bo, p.T - CROWN, h), region: 'side', h });
  }
  for (let k = 1; k <= SEG.top; k++) {
    const z = lerp(p.zTop, p.hole, k / SEG.top);
    pts.push({ z, y: p.yTop(z), region: 'top', h: 1 });
  }
  for (let k = 1; k <= SEG.wall; k++) pts.push({ z: p.hole, y: lerp(p.yTop(p.hole), p.floor, k / SEG.wall), region: 'wall', h: 1 });
  for (let k = 1; k <= SEG.tub; k++) pts.push({ z: lerp(p.hole, 0, k / SEG.tub), y: p.floor, region: 'tub', h: 1 });
  return pts;
}

export function ringAt(bp, u) {
  const right = rightContour(bp, u).map((q) => ({ ...q, side: 1 }));
  const left = right.map((q) => ({ ...q, z: -q.z, side: -1 })).reverse();
  return right.concat(left);
}

// 区間 j→j2 の属性: 右半分は終点側、左半分（逆順）は始点側の点が区間を代表する
const quadMeta = (ring, j, j2) => (ring[j].side > 0 ? ring[j2] : ring[j]);

export function loftGrid(bp, { include = () => true, uSteps = U_STEPS, caps = false } = {}) {
  const rings = [];
  for (let i = 0; i <= uSteps; i++) rings.push(ringAt(bp, i / uSteps));
  const R = rings[0].length;
  const pos = [];
  for (let i = 0; i <= uSteps; i++) {
    const x = uToX(bp, i / uSteps);
    for (const q of rings[i]) pos.push(x, q.y, q.z);
  }
  const idx = [];
  let quadCount = 0;
  for (let i = 0; i < uSteps; i++) {
    const uMid = (i + 0.5) / uSteps;
    for (let j = 0; j < R; j++) {
      const j2 = (j + 1) % R;
      if (!include(uMid, quadMeta(rings[i], j, j2))) continue;
      const a = i * R + j, b = i * R + j2, c = (i + 1) * R + j, d = (i + 1) * R + j2;
      idx.push(a, c, b, b, c, d);
      quadCount++;
    }
  }
  if (caps) {
    for (const i of [0, uSteps]) {
      const ring = rings[i];
      const cy = ring.reduce((s, q) => s + q.y, 0) / R;
      const center = pos.length / 3;
      pos.push(uToX(bp, i / uSteps), cy, 0);
      for (let j = 0; j < R; j++) idx.push(center, i * R + j, i * R + ((j + 1) % R));
    }
  }
  return compact(pos, idx, quadCount);
}

function compact(pos, idx, quadCount) {
  const map = new Map();
  const out = [];
  const indices = idx.map((v) => {
    if (!map.has(v)) { map.set(v, out.length / 3); out.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
    return map.get(v);
  });
  return { positions: new Float32Array(out), indices: new Uint32Array(indices), quadCount, vertexCount: out.length / 3 };
}

export function pointOnSide(bp, u, h, side = 1) {
  const p = profileAt(bp, u);
  return [uToX(bp, u), lerp(p.Bo, p.T - CROWN, h), side * p.W * p.shape(h)];
}

export function cockpitRange(bp) {
  const n = bp.samples - 1;
  const idx = bp.holeHalfWidth.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  return { u0: idx[0] / n, u1: idx[idx.length - 1] / n };
}

export function panelRegions(bp) {
  const { u0, u1 } = cockpitRange(bp);
  const doorEnd = u0 + 0.55 * (u1 - u0);
  const door = (sign) => (u, m) => m.region === 'side' && m.side === sign && m.h > 0.3 && u > u0 - 0.03 && u < doorEnd;
  return {
    hood: (u, m) => m.region === 'top' && u > 0.07 && u < u0 - 0.015,
    trunk: (u, m) => m.region === 'top' && u > u1 + 0.03 && u < 0.94,
    doorR: door(1),
    doorL: door(-1),
  };
}

export function shellInclude(bp) {
  const regions = Object.values(panelRegions(bp));
  return (u, m) => !regions.some((f) => f(u, m));
}
