import * as THREE from 'three';
import { BLUEPRINT } from './blueprint.js';
import { createStage } from './stage.js';
import { applyTheme } from './themes.js';
import { createViewAnimator } from './views.js';
import { createMaterials } from './materials.js';
import { createRegistry } from './registry.js';
import { createExplodeController } from './explode.js';
import { buildExterior } from './parts/exterior.js';
import { buildWheels } from './parts/wheels.js';
import { buildInterior } from './parts/interior.js';

const BUILDERS = [buildExterior, buildWheels, buildInterior];

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

const clock = new THREE.Clock();
stage.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  explode.update(dt);
  views.update(dt);
  stage.controls.update();
  stage.renderer.render(stage.scene, stage.camera);
});

window.__viewer = { stage, views, registry, explode, applyTheme: (n) => applyTheme(stage, n) };
