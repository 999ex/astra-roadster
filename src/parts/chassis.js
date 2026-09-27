import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { profileAt, uToX } from '../bodyLoft.js';
import { mesh, spec, worldAssembly, tubeThrough } from './util.js';
import { TIRE_WIDTH } from './wheels.js';

const alongZ = (g) => { g.rotateX(Math.PI / 2); return g; };

export function buildChassis(bp, m) {
  const out = [];
  const [wf, wr] = bp.wheels;
  const xf = uToX(bp, wf.u), xr = uToX(bp, wr.u);
  const yFrame = Math.min(...bp.bottomCenter.slice(10, 111)) + 0.05;
  const railZ = 0.8 * profileAt(bp, 0.5).zIn;

  // フレーム: 縦2本＋横5本
  const fx0 = xf + 0.45, fx1 = xr - 0.45, fLen = fx0 - fx1, fMid = (fx0 + fx1) / 2;
  const frame = [
    mesh(new THREE.BoxGeometry(fLen, 0.06, 0.05), m.steel, [fMid, yFrame, railZ]),
    mesh(new THREE.BoxGeometry(fLen, 0.06, 0.05), m.steel, [fMid, yFrame, -railZ]),
  ];
  for (let i = 0; i < 5; i++) frame.push(mesh(new THREE.BoxGeometry(0.05, 0.05, 2 * railZ), m.steel, [fx1 + (fLen * i) / 4, yFrame, 0]));
  out.push(spec('シャーシフレーム', 'chassis', worldAssembly(frame), [0, 0, 0]));

  // バッテリー: 前後輪の間のトレイと、3×2のモジュール
  const bx0 = xf - wf.radius - 0.15, bx1 = xr + wr.radius + 0.15;
  const bLen = bx0 - bx1, bMid = (bx0 + bx1) / 2, bW = 2 * railZ - 0.08, yCase = yFrame + 0.04;
  out.push(spec('バッテリーケース', 'chassis', worldAssembly([
    mesh(new THREE.BoxGeometry(bLen, 0.02, bW), m.aluminum, [bMid, yCase, 0]),
    mesh(new THREE.BoxGeometry(bLen, 0.07, 0.015), m.aluminum, [bMid, yCase + 0.045, bW / 2]),
    mesh(new THREE.BoxGeometry(bLen, 0.07, 0.015), m.aluminum, [bMid, yCase + 0.045, -bW / 2]),
  ]), [0, 0.05, 0]));
  let k = 0;
  for (let ix = 0; ix < 3; ix++) for (const iz of [-1, 1]) {
    k++;
    const mx = bMid + ((ix - 1) * bLen) / 3, mz = (iz * bW) / 4;
    out.push(spec(`バッテリーモジュール${k}`, 'chassis', worldAssembly([
      mesh(new RoundedBoxGeometry(bLen / 3 - 0.04, 0.06, bW / 2 - 0.04, 2, 0.01), m.battery, [mx, yCase + 0.045, mz]),
      mesh(new THREE.BoxGeometry(0.05, 0.012, 0.08), m.copper, [mx, yCase + 0.08, mz]),
    ]), [(ix - 1) * 0.35, 0.12, iz * 0.45]));
  }

  // モーター: 車軸上。アルミの本体、両端に銅のコイル
  for (const [name, x, R, sgn] of [['フロントモーター', xf, wf.radius, 1], ['リアモーター', xr, wr.radius, -1]]) {
    out.push(spec(name, 'chassis', worldAssembly([
      mesh(alongZ(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 32)), m.aluminum, [x, R, 0]),
      mesh(new THREE.TorusGeometry(0.13, 0.018, 10, 40), m.copper, [x, R, 0.13]),
      mesh(new THREE.TorusGeometry(0.13, 0.018, 10, 40), m.copper, [x, R, -0.13]),
      mesh(alongZ(new THREE.CylinderGeometry(0.05, 0.05, 0.38, 16)), m.steel, [x, R, 0]),
    ]), [sgn * 0.75, 0.15, 0]));
  }

  const inverter = [mesh(new RoundedBoxGeometry(0.25, 0.08, 0.3, 2, 0.015), m.aluminum, [xr + 0.32, wr.radius + 0.12, 0])];
  for (let i = 0; i < 5; i++) inverter.push(mesh(new THREE.BoxGeometry(0.22, 0.03, 0.008), m.steel, [xr + 0.32, wr.radius + 0.175, -0.12 + i * 0.06]));
  out.push(spec('インバーター', 'chassis', worldAssembly(inverter), [-1.0, 0.45, 0]));

  // 四隅: ドライブシャフトとサスペンション
  for (const [axle, x, w] of [['前', xf, wf], ['後', xr, wr]]) {
    const W = profileAt(bp, w.u).W;
    for (const [side, s] of [['右', 1], ['左', -1]]) {
      const zHub = s * (W - 0.02 - TIRE_WIDTH / 2 - 0.1);
      const z0 = s * 0.19;
      out.push(spec(`ドライブシャフト${side}${axle}`, 'chassis', worldAssembly([
        mesh(alongZ(new THREE.CylinderGeometry(0.022, 0.022, Math.abs(zHub - z0), 12)), m.steel, [x, w.radius, (z0 + zHub) / 2]),
        mesh(new THREE.SphereGeometry(0.04, 16, 12), m.interior, [x, w.radius, z0 + s * 0.03]),
        mesh(new THREE.SphereGeometry(0.04, 16, 12), m.interior, [x, w.radius, zHub - s * 0.03]),
      ]), [0, 0.1, s * 0.45]));

      const zS = s * (W - 0.02 - TIRE_WIDTH - 0.08);
      const y0 = w.radius - 0.02;
      const helix = Array.from({ length: 73 }, (_, i) => {
        const a = (i / 72) * Math.PI * 2 * 6;
        return [x - 0.1 + 0.045 * Math.cos(a), y0 + (0.32 * i) / 72, zS + 0.045 * Math.sin(a)];
      });
      out.push(spec(`サスペンション${side}${axle}`, 'chassis', worldAssembly([
        mesh(tubeThrough(helix, 0.008, 240), m.copper),
        mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.4, 12), m.aluminum, [x - 0.1, y0 + 0.16, zS]),
      ]), [0, 0.55, s * 0.55]));
    }
  }

  out.push(spec('ステアリングラック', 'chassis', worldAssembly([
    mesh(alongZ(new THREE.CylinderGeometry(0.03, 0.03, 2 * railZ + 0.1, 16)), m.steel, [xf + 0.2, wf.radius + 0.02, 0]),
    mesh(alongZ(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 16)), m.aluminum, [xf + 0.2, wf.radius + 0.02, -0.15]),
  ]), [0.55, 0.1, 0]));

  const xRad = uToX(bp, 0.06);
  const pR = profileAt(bp, 0.06);
  const radW = Math.min(0.8, 2 * pR.zIn * 0.9);
  const yRad = pR.Bc + 0.18;
  const radiator = [mesh(new THREE.BoxGeometry(0.05, 0.26, radW), m.aluminum, [xRad, yRad, 0])];
  for (let i = 0; i < 8; i++) radiator.push(mesh(new THREE.BoxGeometry(0.056, 0.008, radW * 0.95), m.steel, [xRad, yRad - 0.11 + i * 0.031, 0]));
  out.push(spec('ラジエーター', 'chassis', worldAssembly(radiator), [1.3, 0.35, 0]));

  return out;
}
