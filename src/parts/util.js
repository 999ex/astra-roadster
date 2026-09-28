import * as THREE from 'three';
import { cockpitRange, profileAt, uToX } from '../bodyLoft.js';

// 既定で Y 軸向きの円柱などを Z 軸向き（車幅方向）に倒す
export const alongZ = (g) => { g.rotateX(Math.PI / 2); return g; };

// x区間 [xLo, xHi] 上の車体下面(bottomCenter)の最大値（フレーム/バッテリーの床上クリアランス判定用）
export function maxBcOverX(bp, xLo, xHi, steps = 40) {
  let m = -Infinity;
  for (let i = 0; i <= steps; i++) {
    const x = xLo + ((xHi - xLo) * i) / steps;
    const u = Math.min(1, Math.max(0, (bp.length / 2 - x) / bp.length));
    const p = profileAt(bp, u);
    if (p.Bc > m) m = p.Bc;
  }
  return m;
}

export function loftToGeometry({ positions, indices }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setIndex(new THREE.BufferAttribute(indices, 1));
  g.computeVertexNormals();
  return g;
}

export function mesh(geometry, material, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  return m;
}

export function centered(geometry, material) {
  geometry.computeBoundingBox();
  const c = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-c.x, -c.y, -c.z);
  const outer = new THREE.Group();
  outer.position.copy(c);
  outer.add(new THREE.Mesh(geometry, material));
  return outer;
}

export function worldAssembly(meshes) {
  const box = new THREE.Box3();
  for (const m of meshes) {
    m.updateMatrix();
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix));
  }
  const c = box.getCenter(new THREE.Vector3());
  const outer = new THREE.Group();
  outer.position.copy(c);
  for (const m of meshes) { m.position.sub(c); outer.add(m); }
  return outer;
}

export function hinged(geometry, material, hingePoint) {
  const outer = new THREE.Group();
  outer.position.copy(hingePoint);
  const hinge = new THREE.Group();
  outer.add(hinge);
  const m = new THREE.Mesh(geometry, material);
  m.position.copy(hingePoint).negate();
  hinge.add(m);
  outer.userData.hinge = hinge;
  return outer;
}

export function gridSurface(fn, nu, nv) {
  const pos = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...fn(-1 + (2 * i) / nu, j / nv));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export const tubeThrough = (points, radius, segments = 64) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), segments, radius, 8, false);

export function seatLayout(bp) {
  const { u0, u1 } = cockpitRange(bp);
  const u = u0 + 0.62 * (u1 - u0);
  const p = profileAt(bp, u);
  return { u, x: uToX(bp, u), z: p.hole * 0.52, floor: p.floor };
}

export function spec(name, group, object3d, offset, rotate) {
  object3d.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { name, group, object3d, explode: { offset, rotate } };
}
