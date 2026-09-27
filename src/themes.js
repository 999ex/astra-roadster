import * as THREE from 'three';

export const THEMES = {
  gallery: { bg: ['#141a26', '#06080d'], grid: true, mirror: false, exposure: 1.0, hemi: 0.35, key: 2.2 },
  studio: { bg: ['#f3ebe2', '#d9cdbf'], grid: false, mirror: true, exposure: 1.05, hemi: 0.6, key: 1.8 },
};

function gradientTexture([top, bottom]) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top); grad.addColorStop(1, bottom);
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function applyTheme(stage, name) {
  const th = THEMES[name];
  const old = stage.scene.background;
  stage.scene.background = gradientTexture(th.bg);
  old?.dispose?.();
  stage.floors.grid.visible = th.grid;
  stage.floors.mirror.visible = th.mirror;
  stage.floors.tint.visible = th.mirror;
  stage.renderer.toneMappingExposure = th.exposure;
  stage.lights.hemi.intensity = th.hemi;
  stage.lights.key.intensity = th.key;
  document.body.dataset.theme = name;
  document.querySelectorAll('[data-theme-btn]').forEach((b) => b.classList.toggle('is-active', b.dataset.themeBtn === name));
}
