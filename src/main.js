import * as THREE from 'three';
import { BLUEPRINT } from './blueprint.js';
import { loftGrid, shellInclude } from './bodyLoft.js';
import { createStage } from './stage.js';
import { applyTheme } from './themes.js';
import { createViewAnimator } from './views.js';
import { createMaterials } from './materials.js';
import { loftToGeometry } from './parts/util.js';

const stage = createStage(document.getElementById('stage'));
applyTheme(stage, 'gallery');
const views = createViewAnimator(stage.camera, stage.controls);
const mats = createMaterials();

const shell = new THREE.Mesh(loftToGeometry(loftGrid(BLUEPRINT, { include: shellInclude(BLUEPRINT), caps: true })), mats.paint);
shell.castShadow = true;
stage.car.add(shell);

const clock = new THREE.Clock();
stage.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  views.update(dt);
  stage.controls.update();
  stage.renderer.render(stage.scene, stage.camera);
});

window.__viewer = { stage, views, applyTheme: (n) => applyTheme(stage, n) };
