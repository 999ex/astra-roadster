import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cockpitRange, profileAt, uToX } from '../bodyLoft.js';
import { mesh, spec, worldAssembly, seatLayout, gridSurface } from './util.js';
import { lerp } from '../math.js';

export function buildInterior(bp, m) {
  const seat = seatLayout(bp);
  const { u0, u1 } = cockpitRange(bp);
  const f = seat.floor;
  const out = [];

  for (const [name, s] of [['シート右', 1], ['シート左', -1]]) {
    const z = s * seat.z;
    out.push(spec(name, 'interior', worldAssembly([
      mesh(new RoundedBoxGeometry(0.46, 0.1, 0.4, 3, 0.04), m.seat, [seat.x, f + 0.08, z]),
      mesh(new RoundedBoxGeometry(0.1, 0.52, 0.4, 3, 0.04), m.seat, [seat.x - 0.24, f + 0.35, z], [0, 0, 0.22]),
      mesh(new RoundedBoxGeometry(0.08, 0.15, 0.26, 3, 0.035), m.seat, [seat.x - 0.31, f + 0.66, z], [0, 0, 0.22]),
      mesh(new THREE.BoxGeometry(0.012, 0.48, 0.012), m.copper, [seat.x - 0.2, f + 0.35, z + 0.2], [0, 0, 0.22]),
      mesh(new THREE.BoxGeometry(0.012, 0.48, 0.012), m.copper, [seat.x - 0.2, f + 0.35, z - 0.2], [0, 0, 0.22]),
    ]), [0, 0.75, s * 0.3]));
  }

  const uDash = u0 + 0.1 / bp.length;
  const pd = profileAt(bp, uDash);
  const xDash = uToX(bp, u0) - 0.1;
  const yDash = pd.T - 0.12;
  const dashW = Math.min(2 * (seat.z + 0.24), 2 * pd.hole * 0.95);
  out.push(spec('ダッシュボード', 'interior', worldAssembly([
    mesh(new RoundedBoxGeometry(0.28, 0.13, dashW, 3, 0.04), m.interior, [xDash, yDash, 0]),
    mesh(new THREE.BoxGeometry(0.01, 0.012, dashW * 0.9), m.copper, [xDash - 0.141, yDash + 0.02, 0]),
  ]), [0.45, 0.9, 0]));

  const zDrv = -seat.z;
  const xSw = xDash - 0.26, ySw = yDash - 0.04;
  const rimGeom = new THREE.TorusGeometry(0.15, 0.018, 12, 48);
  rimGeom.scale(1, 0.8, 1);
  const swRim = mesh(rimGeom, m.interior, [xSw, ySw, zDrv]);
  swRim.rotation.set(0, Math.PI / 2, 0.35, 'ZYX'); // 運転席に向けてから後ろへ傾ける
  out.push(spec('ステアリング', 'interior', worldAssembly([
    swRim,
    mesh(new THREE.BoxGeometry(0.02, 0.022, 0.26), m.copper, [xSw, ySw, zDrv], [0, 0, 0.35]),
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 12), m.steel, [xSw + 0.1, ySw + 0.03, zDrv], [0, 0, Math.PI / 2 + 0.35]),
  ]), [0.25, 1.05, -0.1]));

  out.push(spec('メーターディスプレイ', 'interior', worldAssembly([
    mesh(new THREE.BoxGeometry(0.012, 0.085, 0.26), m.screen, [xDash - 0.15, yDash + 0.1, zDrv], [0, 0, 0.3]),
  ]), [0.45, 1.25, 0]));

  out.push(spec('センターコンソール', 'interior', worldAssembly([
    mesh(new RoundedBoxGeometry(0.7, 0.14, 0.16, 3, 0.03), m.interior, [seat.x + 0.05, f + 0.07, 0]),
    mesh(new THREE.BoxGeometry(0.6, 0.006, 0.02), m.copper, [seat.x + 0.05, f + 0.143, 0]),
  ]), [0, 0.6, 0]));

  out.push(spec('フロア', 'interior', worldAssembly([
    mesh(gridSurface((s, v) => {
      const u = lerp(u0, u1, v);
      return [uToX(bp, u), f + 0.01, s * profileAt(bp, u).hole * 0.95];
    }, 4, 24), m.interior),
  ]), [0, 0.3, 0]));

  return out;
}
