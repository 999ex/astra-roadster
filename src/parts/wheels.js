import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { profileAt, uToX } from '../bodyLoft.js';
import { mesh, spec } from './util.js';

export const TIRE_WIDTH = 0.24;

const alongZ = (g) => { g.rotateX(Math.PI / 2); return g; };

function spinning(position, children) {
  const outer = new THREE.Group();
  outer.position.set(...position);
  const spin = new THREE.Group();
  for (const c of children) spin.add(c);
  outer.add(spin);
  outer.userData.spin = spin;
  return outer;
}

function tireGeometry(R, w) {
  const ri = 0.72 * R;
  const pts = [[ri, -w / 2], [R - 0.03, -w / 2], [R - 0.005, -w / 2 + 0.02], [R, -w / 2 + 0.05], [R, w / 2 - 0.05], [R - 0.005, w / 2 - 0.02], [R - 0.03, w / 2], [ri, w / 2]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 64);
}

function rimChildren(R, s, m) {
  const ri = 0.72 * R;
  const face = s * (TIRE_WIDTH / 2 - 0.03);
  const kids = [
    mesh(alongZ(new THREE.CylinderGeometry(ri, ri, TIRE_WIDTH * 0.9, 48, 1, true)), m.rim),
    mesh(alongZ(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 24)), m.copper, [0, 0, face]),
    mesh(new THREE.TorusGeometry(ri * 0.97, 0.006, 6, 64), m.copper, [0, 0, face]),
  ];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const spoke = new THREE.BoxGeometry(0.045, ri * 0.92, 0.022);
    spoke.translate(0, ri * 0.46, 0);
    const sp = mesh(spoke, m.rim, [0, 0, face]);
    sp.rotation.set(0, 0.35 * s, a, 'ZYX'); // 自軸まわりにねじってから放射状に配置する
    kids.push(sp);
  }
  return kids;
}

export function buildWheels(bp, m) {
  const [front, rear] = bp.wheels;
  const out = [];
  for (const [axle, wheel] of [['前', front], ['後', rear]]) {
    const R = wheel.radius;
    const x = uToX(bp, wheel.u);
    const W = profileAt(bp, wheel.u).W;
    for (const [side, s] of [['右', 1], ['左', -1]]) {
      const zc = s * (W - 0.02 - TIRE_WIDTH / 2);
      const pos = side + axle;
      const rd = 0.58 * R;
      const zDisc = zc - s * 0.05;
      out.push(spec(`${pos}タイヤ`, 'wheels', spinning([x, R, zc], [mesh(alongZ(tireGeometry(R, TIRE_WIDTH)), m.tire)]), [0, 0.3, s * 0.95]));
      out.push(spec(`${pos}ホイール`, 'wheels', spinning([x, R, zc], rimChildren(R, s, m)), [0, 0.3, s * 0.65]));
      out.push(spec(`${pos}ブレーキディスク`, 'wheels', spinning([x, R, zDisc], [
        mesh(alongZ(new THREE.CylinderGeometry(rd, rd, 0.028, 48)), m.steel),
        mesh(alongZ(new THREE.CylinderGeometry(rd * 0.4, rd * 0.4, 0.06, 32)), m.copper),
      ]), [0, 0.3, s * 0.4]));
      const caliper = new THREE.Group();
      caliper.position.set(x - rd * 0.6, R + rd * 0.6, zDisc);
      caliper.rotation.z = Math.PI / 4;
      caliper.add(mesh(new RoundedBoxGeometry(0.16, 0.09, 0.07, 2, 0.02), m.copper));
      out.push(spec(`${pos}キャリパー`, 'wheels', caliper, [0, 0.45, s * 0.25]));
    }
  }
  return out;
}
