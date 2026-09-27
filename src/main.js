import * as THREE from 'three';
import { BLUEPRINT } from './blueprint.js';
import { createStage } from './stage.js';
import { applyTheme } from './themes.js';
import { createViewAnimator } from './views.js';
import { createMaterials } from './materials.js';
import { createRegistry } from './registry.js';
import { createExplodeController } from './explode.js';
import { createDrive } from './drive.js';
import { buildExterior } from './parts/exterior.js';
import { buildWheels } from './parts/wheels.js';
import { buildInterior } from './parts/interior.js';
import { buildChassis } from './parts/chassis.js';

const BUILDERS = [buildExterior, buildWheels, buildInterior, buildChassis];

const stage = createStage(document.getElementById('stage'));
applyTheme(stage, 'gallery');
const views = createViewAnimator(stage.camera, stage.controls);
const mats = createMaterials();

const registry = createRegistry();
for (const build of BUILDERS) {
  for (const s of build(BLUEPRINT, mats)) {
    stage.car.add(s.object3d);
    registry.add(s);
  }
}
const explode = createExplodeController(registry);
const drive = createDrive({
  hinges: [['シザードア右', 1], ['シザードア左', -1]].map(([name, side]) => ({ hinge: registry.get(name).object3d.userData.hinge, side })),
  spinners: registry.parts.map((p) => p.object3d.userData.spin).filter(Boolean),
  lights: [{ material: mats.headlight, max: 2.5 }, { material: mats.taillight, max: 3 }],
});

const clock = new THREE.Clock();
stage.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  explode.update(dt);
  drive.update(dt);
  views.update(dt);
  stage.controls.update();
  stage.renderer.render(stage.scene, stage.camera);
});

window.__viewer = { stage, views, registry, explode, drive, applyTheme: (n) => applyTheme(stage, n) };
