import { lerp, clamp, easeInOutCubic } from './math.js';

// 上: 真上から。カメラを -X 側にわずかにずらすと、画面の上が +X（車の前）になる
// 横: -Z 側から見ると、画面の左が +X（前）になる（横画像と同じ向き）
export const VIEWS = {
  reset: { position: [5.6, 2.4, 4.8], target: [0, 0.55, 0] },
  top: { position: [-0.001, 9.5, 0], target: [0, 0.4, 0] },
  side: { position: [0, 0.75, -8.6], target: [0, 0.55, 0] },
  front: { position: [8.6, 0.8, 0], target: [0, 0.55, 0] },
};
export const VIEW_DURATION = 0.8;

export function toSpherical([x, y, z], [tx, ty, tz]) {
  const dx = x - tx, dy = y - ty, dz = z - tz;
  const r = Math.hypot(dx, dy, dz);
  return { r, phi: Math.acos(clamp(dy / r, -1, 1)), theta: Math.atan2(dx, dz) };
}

export function fromSpherical({ r, phi, theta }, [tx, ty, tz]) {
  return [tx + r * Math.sin(phi) * Math.sin(theta), ty + r * Math.cos(phi), tz + r * Math.sin(phi) * Math.cos(theta)];
}

export function shortestAngle(a, b) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function interpolateView(from, to, t) {
  const e = easeInOutCubic(t);
  const target = [0, 1, 2].map((i) => lerp(from.target[i], to.target[i], e));
  const a = toSpherical(from.position, from.target);
  const b = toSpherical(to.position, to.target);
  const s = { r: lerp(a.r, b.r, e), phi: lerp(a.phi, b.phi, e), theta: a.theta + shortestAngle(a.theta, b.theta) * e };
  return { position: fromSpherical(s, target), target };
}

export function createViewAnimator(camera, controls) {
  let anim = null;
  return {
    go(name) {
      anim = { from: { position: camera.position.toArray(), target: controls.target.toArray() }, to: VIEWS[name], t: 0 };
    },
    get active() { return anim !== null; },
    update(dt) {
      if (!anim) return;
      anim.t = Math.min(1, anim.t + dt / VIEW_DURATION);
      const v = interpolateView(anim.from, anim.to, anim.t);
      camera.position.set(...v.position);
      controls.target.set(...v.target);
      if (anim.t >= 1) anim = null;
    },
  };
}
