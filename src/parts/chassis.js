import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { profileAt, uToX } from '../bodyLoft.js';
import { mesh, spec, worldAssembly, tubeThrough, seatLayout } from './util.js';
import { TIRE_WIDTH } from './wheels.js';

const alongZ = (g) => { g.rotateX(Math.PI / 2); return g; };

// x区間 [xLo, xHi] 上の車体下面(bottomCenter)の最大値を求める（フレーム/バッテリーの床上クリアランス判定用）
function maxBcOverX(bp, xLo, xHi, steps = 40) {
  let m = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const x = xLo + ((xHi - xLo) * i) / steps;
    const u = Math.min(1, Math.max(0, (bp.length / 2 - x) / bp.length));
    const p = profileAt(bp, u);
    if (p.Bc > m) m = p.Bc;
  }
  return m;
}

export function buildChassis(bp, m) {
  const out = [];
  const [wf, wr] = bp.wheels;
  const xf = uToX(bp, wf.u), xr = uToX(bp, wr.u);
  const railZ = 0.8 * profileAt(bp, 0.5).zIn;

  // フレーム: 縦2本＋横4本（クロスメンバーはバッテリー区間とモーター区間(車軸±0.15)を避ける）
  const fx0 = xf + 0.45, fx1 = xr - 0.45, fLen = fx0 - fx1, fMid = (fx0 + fx1) / 2;
  const bx0 = xf - wf.radius - 0.15, bx1 = xr + wr.radius + 0.15;

  // レール下面は、フレーム区間の車体下面の最高点より上、かつ車軸上のドライブシャフト／ジョイント球(R±0.04)より上にする
  const maxBcFrame = maxBcOverX(bp, fx1, fx0);
  const railHalfH = 0.03;
  const railBottomMin = Math.max(maxBcFrame + 0.01, wf.radius + 0.04);
  const yFrame = railBottomMin + railHalfH + 0.005;

  const frame = [
    mesh(new THREE.BoxGeometry(fLen, 0.06, 0.05), m.steel, [fMid, yFrame, railZ]),
    mesh(new THREE.BoxGeometry(fLen, 0.06, 0.05), m.steel, [fMid, yFrame, -railZ]),
  ];
  // クロスメンバー4本: 前端・バッテリー前端の少し前・バッテリー後端の少し後・後端（バッテリー区間とモーター区間の外側）
  for (const cx of [fx0, bx0 + 0.04, bx1 - 0.04, fx1]) frame.push(mesh(new THREE.BoxGeometry(0.05, 0.05, 2 * railZ), m.steel, [cx, yFrame, 0]));
  out.push(spec('シャーシフレーム', 'chassis', worldAssembly(frame), [0, 0, 0]));

  // バッテリー: 前後輪の間のトレイと、3×2のモジュール。
  // 高さは yFrame から独立させ、「区間内の車体下面の最高点＋5mm」〜「内装フロア－5mm」の範囲に収める。
  const bLen = bx0 - bx1, bMid = (bx0 + bx1) / 2, bW = 2 * railZ - 0.08;
  const maxBcBattery = maxBcOverX(bp, bx1, bx0);
  const battLow = maxBcBattery + 0.005;
  const battHigh = seatLayout(bp).floor - 0.005;
  const battBudget = battHigh - battLow;
  const trayH = 0.01, connH = 0.008;
  const moduleH = Math.max(0.02, battBudget - trayH - connH - 0.004);
  const caseWallH = trayH + moduleH;
  const trayY = battLow + trayH / 2;
  const wallY = battLow + caseWallH / 2;
  const moduleY = battLow + trayH + moduleH / 2;
  const connY = battLow + trayH + moduleH + connH / 2;

  out.push(spec('バッテリーケース', 'chassis', worldAssembly([
    mesh(new THREE.BoxGeometry(bLen, trayH, bW), m.aluminum, [bMid, trayY, 0]),
    mesh(new THREE.BoxGeometry(bLen, caseWallH, 0.015), m.aluminum, [bMid, wallY, bW / 2]),
    mesh(new THREE.BoxGeometry(bLen, caseWallH, 0.015), m.aluminum, [bMid, wallY, -bW / 2]),
  ]), [0, 0.05, 0]));
  let k = 0;
  for (let ix = 0; ix < 3; ix++) for (const iz of [-1, 1]) {
    k++;
    const mx = bMid + ((ix - 1) * bLen) / 3, mz = (iz * bW) / 4;
    out.push(spec(`バッテリーモジュール${k}`, 'chassis', worldAssembly([
      mesh(new RoundedBoxGeometry(bLen / 3 - 0.04, moduleH, bW / 2 - 0.04, 2, 0.008), m.battery, [mx, moduleY, mz]),
      mesh(new THREE.BoxGeometry(0.05, connH, 0.08), m.copper, [mx, connY, mz]),
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
      const zHub = s * (W - 0.02 - TIRE_WIDTH - 0.02);
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
