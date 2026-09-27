import { approach, easeInOutCubic, lerp } from './math.js';

export const DOOR_ANGLE = (75 * Math.PI) / 180;
export const DOOR_DURATION = 1.2;
export const WHEEL_SPEED = 6;
export const SPIN_ACCEL = 4;

export function createDrive({ hinges, spinners, lights }) {
  let open = 0;
  let target = 0;
  let speed = 0;
  return {
    get running() { return target === 1; },
    get openness() { return open; },
    get speed() { return speed; },
    toggle() { target = target === 1 ? 0 : 1; return target === 1; },
    update(dt) {
      open = approach(open, target, dt / DOOR_DURATION);
      const e = easeInOutCubic(open);
      for (const { hinge, side } of hinges) {
        hinge.rotation.z = -DOOR_ANGLE * e;
        hinge.rotation.x = -side * 0.12 * e;
      }
      speed = approach(speed, target * WHEEL_SPEED, SPIN_ACCEL * dt);
      for (const s of spinners) s.rotation.z -= speed * dt;
      for (const { material, max } of lights) material.emissiveIntensity = lerp(0, max, e);
    },
  };
}
