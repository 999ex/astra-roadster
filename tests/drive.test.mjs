import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDrive, DOOR_ANGLE } from '../src/drive.js';

const node = () => ({ rotation: { x: 0, y: 0, z: 0 } });

function setup() {
  const hinge = node();
  const spinner = node();
  const material = { emissiveIntensity: 0 };
  const drive = createDrive({ hinges: [{ hinge, side: 1 }], spinners: [spinner], lights: [{ material, max: 2 }] });
  return { hinge, spinner, material, drive };
}

test('始動: 0.6秒でドアが半分開き、ライトが半分点灯、ホイールが回り始める', () => {
  const { hinge, spinner, material, drive } = setup();
  assert.equal(drive.toggle(), true);
  drive.update(0.6);
  assert.ok(Math.abs(drive.openness - 0.5) < 1e-9);
  assert.ok(Math.abs(hinge.rotation.z + DOOR_ANGLE * 0.5) < 1e-9);
  assert.ok(hinge.rotation.x < 0);
  assert.ok(Math.abs(material.emissiveIntensity - 1) < 1e-9);
  assert.ok(spinner.rotation.z < 0);
});

test('十分時間が経つと全開・最高回転になる', () => {
  const { hinge, drive } = setup();
  drive.toggle();
  for (let i = 0; i < 100; i++) drive.update(0.05);
  assert.equal(drive.openness, 1);
  assert.ok(Math.abs(hinge.rotation.z + DOOR_ANGLE) < 1e-9);
  assert.equal(drive.speed, 6);
});

test('停止: ドアが閉じ、消灯し、回転が止まる', () => {
  const { hinge, material, drive } = setup();
  drive.toggle();
  for (let i = 0; i < 100; i++) drive.update(0.05);
  assert.equal(drive.toggle(), false);
  for (let i = 0; i < 100; i++) drive.update(0.05);
  assert.equal(drive.openness, 0);
  assert.equal(hinge.rotation.z, -0);
  assert.equal(material.emissiveIntensity, 0);
  assert.equal(drive.speed, 0);
  assert.equal(drive.running, false);
});
