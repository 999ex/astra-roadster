import { clamp, easeInOutCubic, approach } from './math.js';

export const GROUP_PHASE = { exterior: 0, interior: 1, wheels: 1, chassis: 2 };
export const STAGGER = 0.4;
export const DURATION = 1.5;

export const localProgress = (t, group) => clamp((t - (GROUP_PHASE[group] / 2) * STAGGER) / (1 - STAGGER));

export function applyExplode(registry, t) {
  for (const p of registry.parts) {
    const e = easeInOutCubic(localProgress(t, p.group));
    const [hx, hy, hz] = p.home.position;
    const [ox, oy, oz] = p.explode.offset;
    const [rx, ry, rz] = p.home.rotation;
    const [ax, ay, az] = p.explode.rotate;
    p.object3d.position.set(hx + ox * e, hy + oy * e, hz + oz * e);
    p.object3d.rotation.set(rx + ax * e, ry + ay * e, rz + az * e);
  }
}

export function createExplodeController(registry) {
  let value = 0;
  let target = 0;
  return {
    get value() { return value; },
    get exploded() { return target === 1; },
    toggle() { target = target === 1 ? 0 : 1; return target === 1; },
    update(dt) {
      const prev = value;
      value = approach(value, target, dt / DURATION);
      if (value !== prev) applyExplode(registry, value);
    },
  };
}
