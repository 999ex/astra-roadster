import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loftGrid, shellInclude, panelRegions, profileAt, uToX, cockpitRange, pointOnSide } from '../bodyLoft.js';
import { lerp } from '../math.js';
import { loftToGeometry, centered, hinged, worldAssembly, mesh, spec, gridSurface, tubeThrough, seatLayout } from './util.js';

export function buildExterior(bp, m) {
  const regions = panelRegions(bp);
  const { u0, u1 } = cockpitRange(bp);
  const panel = (key) => loftToGeometry(loftGrid(bp, { include: regions[key] }));
  const out = [];

  out.push(spec('ボディシェル', 'exterior', centered(loftToGeometry(loftGrid(bp, { include: shellInclude(bp), caps: true })), m.paint), [0, 1.6, 0]));
  out.push(spec('ボンネット', 'exterior', centered(panel('hood'), m.paint), [0.5, 1.25, 0], [0, 0, -0.2]));
  out.push(spec('トランクリッド', 'exterior', centered(panel('trunk'), m.paint), [-0.5, 1.25, 0], [0, 0, 0.2]));

  for (const [name, key, s] of [['シザードア右', 'doorR', 1], ['シザードア左', 'doorL', -1]]) {
    const g = panel(key);
    g.computeBoundingBox();
    const b = g.boundingBox;
    const hingePoint = new THREE.Vector3(b.max.x, b.max.y, (b.min.z + b.max.z) / 2);
    out.push(spec(name, 'exterior', hinged(g, m.paint, hingePoint), [0, 0.8, s * 1.0]));
  }

  const pLip = profileAt(bp, 0.04);
  out.push(spec('フロントバンパー', 'exterior', worldAssembly([
    mesh(new RoundedBoxGeometry(0.22, 0.035, 2 * pLip.zOut * 0.95, 2, 0.012), m.trim, [uToX(bp, 0.03), pLip.Bc + 0.018, 0]),
  ]), [1.0, 0.1, 0]));

  const pD = profileAt(bp, 0.95);
  const xD = uToX(bp, 0.955);
  const diffuser = [mesh(new THREE.BoxGeometry(0.32, 0.04, 2 * pD.zIn), m.trim, [xD, pD.Bc + 0.02, 0])];
  for (let i = 0; i < 5; i++) diffuser.push(mesh(new THREE.BoxGeometry(0.3, 0.09, 0.014), m.trim, [xD, pD.Bc + 0.065, (i - 2) * pD.zIn * 0.4]));
  out.push(spec('リアディフューザー', 'exterior', worldAssembly(diffuser), [-1.0, 0.1, 0]));

  const ub = Math.max(0, u0 - 0.012);
  const pb = profileAt(bp, ub);
  const xb = uToX(bp, ub), yb = pb.T - 0.03;
  const xt = xb - 0.52, yt = yb + 0.36, wb = 0.74 * pb.W, wt = 0.64 * pb.W;
  const glass = gridSurface((s, v) => [lerp(xb, xt, v) - 0.07 * s * s, lerp(yb, yt, v) - 0.02 * s * s, s * lerp(wb, wt, v)], 12, 8);
  const frame = tubeThrough([[xb - 0.07, yb - 0.02, -wb], [xt - 0.07, yt - 0.02, -wt], [xt, yt, 0], [xt - 0.07, yt - 0.02, wt], [xb - 0.07, yb - 0.02, wb]], 0.02);
  out.push(spec('フロントガラス', 'exterior', worldAssembly([mesh(glass, m.glass), mesh(frame, m.trim)]), [0.35, 2.2, 0], [0, 0, 0.2]));

  for (const [name, s] of [['ドアミラー右', 1], ['ドアミラー左', -1]]) {
    const [x, y, z] = pointOnSide(bp, u0 + 0.005, 0.97, s);
    const headGeom = new THREE.SphereGeometry(1, 24, 16);
    headGeom.scale(0.07, 0.045, 0.11);
    out.push(spec(name, 'exterior', worldAssembly([
      mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), m.trim, [x - 0.02, y + 0.03, z + s * 0.05], [Math.PI / 2, 0, 0]),
      mesh(headGeom, m.trim, [x - 0.03, y + 0.07, z + s * 0.14]),
    ]), [0.2, 1.0, s * 1.4]));
  }

  for (const [name, s] of [['ヘッドライト右', 1], ['ヘッドライト左', -1]]) {
    const [x, y, z] = pointOnSide(bp, 0.07, 0.72, s);
    // ブレードの長さ 0.18: 後端をホイールハウスの前（前輪中心 + R + 0.02 より前方）に収め、前輪タイヤに刺さらないようにする
    const bladeLen = 0.18;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(-bladeLen, 0.035); shape.lineTo(-bladeLen + 0.02, 0.05); shape.lineTo(0.02, 0.03); shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    g.translate(0, 0, -0.01);
    out.push(spec(name, 'exterior', worldAssembly([mesh(g, m.headlight, [x + 0.02, y, z + s * 0.005], [0, s * 0.35, 0])]), [0.9, 0.95, s * 0.3]));
  }

  const pT = profileAt(bp, 0.985);
  const xT = uToX(bp, 0.99), yT = pT.T - 0.07, wT = pT.W * 0.85;
  const tailPts = Array.from({ length: 9 }, (_, i) => { const z = -wT + (2 * wT * i) / 8; return [xT + 0.04 * (1 - (z / wT) ** 2), yT, z]; });
  out.push(spec('テールライトバー', 'exterior', worldAssembly([mesh(tubeThrough(tailPts, 0.013), m.taillight)]), [-0.9, 0.95, 0]));

  const pG = profileAt(bp, 0.02);
  const xG = uToX(bp, 0.012), gw = pG.zIn * 1.2;
  const grille = [mesh(new THREE.BoxGeometry(0.02, 0.13, gw), m.interior, [xG - 0.01, pG.Bc + 0.1, 0])];
  for (let i = 0; i < 5; i++) grille.push(mesh(new THREE.BoxGeometry(0.035, 0.01, gw * 0.96), m.trim, [xG, pG.Bc + 0.045 + i * 0.025, 0]));
  out.push(spec('フロントグリル', 'exterior', worldAssembly(grille), [1.35, 0.3, 0]));

  const [wf, wr] = bp.wheels;
  const ua = wf.u + wf.radius / bp.length + 0.03;
  const ue = wr.u - wr.radius / bp.length - 0.03;
  const um = (ua + ue) / 2;
  const len = (ue - ua) * bp.length;
  const pS = profileAt(bp, um);
  for (const [name, s] of [['サイドスカート右', 1], ['サイドスカート左', -1]]) {
    const [x, , z] = pointOnSide(bp, um, 0, s);
    out.push(spec(name, 'exterior', worldAssembly([
      mesh(new RoundedBoxGeometry(len, 0.06, 0.05, 2, 0.015), m.trim, [x, pS.Bo + 0.01, z]),
      mesh(new THREE.BoxGeometry(len * 0.9, 0.006, 0.01), m.copper, [x, pS.Bo + 0.045, z + s * 0.022]),
    ]), [0, 0.25, s * 1.2]));
  }

  const uH = Math.min(0.99, u1 + 0.02);
  const pH = profileAt(bp, uH);
  const xH = uToX(bp, uH);
  const seat = seatLayout(bp);
  const hoops = [-seat.z, seat.z].map((z0) => {
    const pts = Array.from({ length: 9 }, (_, k) => { const a = (Math.PI * k) / 8; return [xH, pH.T - 0.02 + 0.3 * Math.sin(a), z0 - 0.19 * Math.cos(a)]; });
    return mesh(tubeThrough(pts, 0.022), m.trim);
  });
  out.push(spec('ロールフープ', 'exterior', worldAssembly(hoops), [-0.3, 2.0, 0]));

  return out;
}
